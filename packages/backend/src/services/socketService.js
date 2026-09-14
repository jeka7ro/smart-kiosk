/**
 * Socket.IO Service
 * Manages real-time communication between backend, kiosk, QR web, and kitchen display
 */

let _io = null;
const connectedKiosks = new Map(); // socketId -> { socketId, locationId, kioskId, screen, ip, connectedAt, lastPing }
const pendingPings = new Map(); // pingId -> { startTime, resolve }

function getLiveKiosksSummary() {
  const now = Date.now();
  const summary = {};
  for (const [sid, k] of connectedKiosks.entries()) {
    const ageMs = now - (k.lastPing || k.connectedAt || now);
    const isLive = ageMs < 45000; // live if heard from in last 45 seconds
    const locId = k.locationId || 'unknown';
    if (!summary[locId]) {
      summary[locId] = {
        locationId: locId,
        isLive: false,
        online: false,
        onlineCount: 0,
        devices: [],
        lastSeen: 0,
        secondsAgo: null,
        screen: null
      };
    }
    const s = summary[locId];
    if (isLive) {
      s.isLive = true;
      s.online = true;
      s.onlineCount += 1;
      if (k.screen) s.screen = k.screen;
    }
    const pingTime = k.lastPing || k.connectedAt || 0;
    if (!s.lastSeen || pingTime > s.lastSeen) {
      s.lastSeen = pingTime;
      s.secondsAgo = Math.max(0, Math.round(ageMs / 1000));
    }
    s.devices.push({
      socketId: sid,
      kioskId: k.kioskId || '1',
      screen: k.screen || 'activ',
      isLive,
      connectedAt: k.connectedAt,
      lastPing: k.lastPing,
      ip: k.ip
    });
  }
  return summary;
}

function broadcastLiveKiosks() {
  if (_io) {
    _io.to('admin').emit('kiosks_live_status', getLiveKiosksSummary());
  }
}

async function pingKioskLocation(locationId, timeoutMs = 3500) {
  if (!_io) throw new Error('Socket.io server not initialized');
  const pingId = `ping_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (pendingPings.has(pingId)) {
        pendingPings.delete(pingId);
        resolve({
          ok: false,
          error: 'Tableta kiosk nu a răspuns în timp util (timeout)',
          latencyMs: timeoutMs
        });
      }
    }, timeoutMs);

    pendingPings.set(pingId, {
      startTime,
      resolve: (res) => {
        clearTimeout(timer);
        resolve(res);
      }
    });

    _io.to(`kiosk-${locationId}`).emit('kiosk_ping', { pingId, locationId, timestamp: startTime });
    _io.emit(`kiosk_ping_${locationId}`, { pingId, locationId, timestamp: startTime });
  });
}

function initSocket(io) {
  _io = io;

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Kitchen Display joins — both legacy 'join' and new 'join_room' events
    socket.on('join', ({ role, locationId, kioskId, screen }) => {
      if (role === 'kitchen') {
        socket.join(`kitchen-${locationId}`);
        console.log(`[Socket] Kitchen joined: kitchen-${locationId}`);
      } else if (role === 'kiosk') {
        socket.join(`kiosk-${locationId}`);
        const info = {
          socketId: socket.id,
          locationId: String(locationId || ''),
          kioskId: String(kioskId || '1'),
          screen: screen || 'welcome',
          ip: socket.handshake.headers['x-forwarded-for'] || socket.handshake.address,
          connectedAt: Date.now(),
          lastPing: Date.now()
        };
        connectedKiosks.set(socket.id, info);
        socket._kioskInfo = info;
        console.log(`[Socket] 🟢 Kiosk connected: location=${locationId} kiosk=${info.kioskId} sid=${socket.id}`);
        broadcastLiveKiosks();
      } else if (role === 'admin') {
        socket.join('admin');
        socket.emit('kiosks_live_status', getLiveKiosksSummary());
      }
    });

    // Kiosk Heartbeat (sent periodically every 10-15s)
    socket.on('kiosk_heartbeat', (data) => {
      if (!data) return;
      const k = connectedKiosks.get(socket.id) || socket._kioskInfo || {
        socketId: socket.id,
        locationId: String(data.locationId || ''),
        kioskId: String(data.kioskId || '1'),
        connectedAt: Date.now(),
        ip: socket.handshake.headers['x-forwarded-for'] || socket.handshake.address
      };
      k.lastPing = Date.now();
      if (data.locationId) k.locationId = String(data.locationId);
      if (data.kioskId) k.kioskId = String(data.kioskId);
      if (data.screen) k.screen = String(data.screen);
      connectedKiosks.set(socket.id, k);
      socket._kioskInfo = k;
      broadcastLiveKiosks();
    });

    // Kiosk Pong (reply to live ping test)
    socket.on('kiosk_pong', (data) => {
      if (data && data.pingId && pendingPings.has(data.pingId)) {
        const p = pendingPings.get(data.pingId);
        pendingPings.delete(data.pingId);
        const latency = Date.now() - p.startTime;
        p.resolve({
          ok: true,
          latencyMs: latency,
          screen: data.screen || 'activ',
          socketId: socket.id,
          locationId: data.locationId || socket._kioskInfo?.locationId
        });
      }
    });

    // KDS simplified join (just joins global kitchen room)
    socket.on('join_room', (room) => {
      socket.join(room);
      console.log(`[Socket] ${socket.id} joined room: ${room}`);
    });

    // KDS updates order status — broadcast to everyone
    socket.on('update_order_status', ({ orderId, status }) => {
      io.emit('order_status_updated', { orderId, status });
    });

    // Kitchen marks order as ready → notify kiosk/QR client
    socket.on('order_ready', ({ orderId, locationId }) => {
      io.to(`kiosk-${locationId}`).emit('order_ready', { orderId });
      io.to('admin').emit('order_ready', { orderId, locationId });
    });

    // POS Bridge trimite status intermediar (ex: „așteptați cardul")
    socket.on('pos_bridge_status', ({ orderId, message }) => {
      if (orderId) io.emit(`payment_status_${orderId}`, { message });
    });

    // POS Bridge trimite rezultatul plății
    socket.on('pos_payment_result', (data) => {
      const { orderId, paid, authCode, responseCode, code, refNum, receiptNo, cardNo, txDate, error, raw, locationId, amount } = data;
      console.log(`[Socket] 💳 POS result: orderId=${orderId} paid=${paid} auth=${authCode || '-'} code=${responseCode || code || '-'}`);
      
      // Salvează în POS Logs
      try {
        const { addPosLog } = require('../routes/posLogs');
        const logEntry = addPosLog({
          orderId,
          locationId: locationId || socket._posLocationId || '',
          amount: amount || 0,
          paid,
          receiptNo,
          responseCode: responseCode || code || '',
          authCode: authCode || '',
          refNum: refNum || '',
          cardNo: cardNo || '',
          txDate: txDate || '',
          error: error || null,
          gateway: 'raiffeisen',
          raw: raw || null,
        });
        // Emit to admin for live updates
        io.to('admin').emit('pos_log_new', logEntry);
      } catch (e) {
        console.error('[POS Logs] Error saving:', e.message);
      }

      io.emit(`payment_confirmed_${orderId}`, {
        paid,
        responseCode: responseCode || code,
        authCode,
        refNum,
        cardNo,
        error: paid ? undefined : (error || 'Plată refuzată'),
      });
    });

    // POS Bridge unsolicited data (e.g., manual refunds)
    socket.on('pos_unsolicited_data', (data) => {
      const { locationId, payload } = data;
      console.log(`[Socket] ℹ️ Unsolicited POS data from ${locationId}: ${payload}`);
      
      try {
        const { addPosLog } = require('../routes/posLogs');
        const logEntry = addPosLog({
          locationId: locationId || socket._posLocationId || '',
          amount: 0,
          paid: true,
          status: 'unsolicited',
          raw: payload,
          gateway: 'raiffeisen',
        });
        io.to('admin').emit('pos_log_new', logEntry);
      } catch (e) {
        console.error('[POS Logs] Error saving unsolicited data:', e.message);
      }
    });

    // Salvăm locationId pe socket la register
    socket.on('pos_bridge_register', (origHandler => ({ locationId, port }) => {
      socket._posLocationId = locationId;
      origHandler({ locationId, port });
    })(({ locationId, port }) => {
      const { getLocationAliases } = require('../utils/locations');
      const aliases = getLocationAliases(locationId);
      for (const a of aliases) {
        socket.join(`pos-bridge-${a}`);
      }
      console.log(`[Socket] 🔌 POS Bridge registered: location=${locationId} (${aliases.length} aliases) port=${port || '?'} sid=${socket.id}`);
    }));

    // ─── Printer Logs (from bridge) ────────────────────────────────────────────
    socket.on('printer_log', async (entry) => {
      try {
        const { addPrinterLog } = require('../routes/printerLogs');
        const logEntry = await addPrinterLog(entry);
        io.to('admin').emit('printer_log_new', logEntry);
      } catch (e) {
        console.error('[Printer Logs] Error saving printer log:', e.message);
      }
    });

    // ─── Port Scans (from bridge at startup) ─────────────────────────────────
    socket.on('port_scan', async (entry) => {
      try {
        const { addPortScan } = require('../routes/portScans');
        const scanEntry = await addPortScan(entry);
        io.to('admin').emit('port_scan_new', scanEntry);
      } catch (e) {
        console.error('[Port Scan] Error saving scan:', e.message);
      }
    });

    socket.on('disconnect', () => {
      if (connectedKiosks.has(socket.id)) {
        const k = connectedKiosks.get(socket.id);
        connectedKiosks.delete(socket.id);
        console.log(`[Socket] 🔴 Kiosk disconnected: location=${k?.locationId} sid=${socket.id}`);
        broadcastLiveKiosks();
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

function emitToKitchen(locationId, event, data) {
  if (_io) _io.to(`kitchen-${locationId}`).emit(event, data);
}

function emitToAll(event, data) {
  if (_io) _io.emit(event, data);
}

module.exports = { 
  initSocket, 
  emitToKitchen, 
  emitToAll, 
  getLiveKiosksSummary, 
  broadcastLiveKiosks, 
  pingKioskLocation 
};
