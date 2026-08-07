require('dotenv').config();
const { printTicket } = require('./printer');
const { io: ioClient } = require('socket.io-client');
const { SerialPort }   = require('serialport');
const fs               = require('fs');
const pathMod          = require('path');

const LOG_FILE = pathMod.join(__dirname, 'pos-bridge.log');
function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').split('.')[0];
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}
}

const RENDER_URL  = process.env.RENDER_URL  || 'https://smart-kiosk-ttut.onrender.com';
const COM_PORT    = process.env.COM_PORT    || 'auto';
const BAUD_RATE   = parseInt(process.env.BAUD_RATE || '9600');
const LOCATION_ID = process.env.LOCATION_ID || 'sm-brasov';
const BRIDGE_KEY  = process.env.BRIDGE_KEY  || 'pos-bridge-2024';

const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;
const EOT = 0x04;

function calcLRC(buf) {
  let lrc = 0;
  for (let i = 1; i < buf.length; i++) lrc ^= buf[i];
  return lrc;
}

function buildMol(id, type, dataStr) {
  const payload = Buffer.from(id + type + dataStr, 'ascii');
  const buf = Buffer.alloc(payload.length + 2);
  buf[0] = STX;
  payload.copy(buf, 1);
  buf[buf.length - 1] = ETX;
  const lrc = calcLRC(buf);
  return Buffer.concat([buf, Buffer.from([lrc])]);
}

async function detectPosPort() {
  const ports = await SerialPort.list();
  const firstCom = ports.find(p => p.path.startsWith('COM') && !p.path.includes('BT'));
  return firstCom ? firstCom.path : 'COM3';
}

function processMolPayment(amount, portPath, onStatus) {
  return new Promise((resolve, reject) => {
    let rxBuf = Buffer.alloc(0);
    let state = 'WAIT_ACK_MOL10';
    let timer = null;
    let done = false;

    const port = new SerialPort({
      path: portPath, baudRate: BAUD_RATE,
      dataBits: 8, parity: 'none', stopBits: 1, autoOpen: false,
    });

    const cleanup = (success, errMsg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      setTimeout(() => { try { port.close(); } catch(_) {} }, 300);
      if (success === true) resolve({ success: true, authCode: '000000', code: '0000', raw: 'APPROVED' });
      else if (success && typeof success === 'object') resolve(success);
      else resolve({ success: false, reason: errMsg, code: 'DECLINED' });
    };

    port.open(err => {
      if (err) { log(`❌ Eroare deschidere port: ${err.message}`); return resolve({success: false, reason: err.message}); }
      log(`Port deschis: ${portPath} @ ${BAUD_RATE}`);
      
      const amtCents = Math.round(amount * 100);
      const amtStr = (amtCents / 100).toFixed(2).padStart(8, '0');
      const mol10 = buildMol('MOL', '10', amtStr);
      
      log(`📤 TX MOL10 (Cerere Plată): ${amtStr} RON`);
      port.write(mol10);

      timer = setTimeout(() => {
        log('⏱ Timeout răspuns MOL10 (POS nu răspunde)');
        cleanup(false, 'Timeout POS');
      }, 5000);
    });

    port.on('data', chunk => {
      if (done) return;
      rxBuf = Buffer.concat([rxBuf, chunk]);
      
      if (rxBuf[0] === ACK && state === 'WAIT_ACK_MOL10') {
        rxBuf = rxBuf.subarray(1);
        clearTimeout(timer);
        log('✅ ACK primit pt MOL10. Aștept procesare card...');
        onStatus && onStatus('Apropiați cardul de POS');
        state = 'WAIT_MOL11';
        timer = setTimeout(() => cleanup(false, 'Timeout procesare (2 min)'), 120000);
      }
      else if (rxBuf[0] === NAK) {
        log('❌ NAK primit (format greșit sau eroare LRC).');
        cleanup(false, 'POS a respins comanda (NAK)');
      }
      else if (rxBuf[0] === EOT) {
        log('📥 EOT primit (POS a închis sesiunea / eroare).');
        cleanup(false, 'Tranzacție anulată pe terminal');
      }

      if (rxBuf.includes(STX) && rxBuf.includes(ETX)) {
        const start = rxBuf.indexOf(STX);
        const end = rxBuf.indexOf(ETX, start);
        if (end !== -1 && rxBuf.length > end + 1) {
          const frame = rxBuf.subarray(start, end + 2);
          rxBuf = rxBuf.subarray(end + 2);
          
          port.write(Buffer.from([ACK]));
          
          const payload = frame.subarray(1, frame.length - 2).toString('ascii');
          log(`📥 RX FRAME: ${payload}`);

          if (payload.startsWith('MOL11')) {
            clearTimeout(timer);
            const approved = payload.includes('000');
            log(approved ? '✅ Plată APROBATĂ' : '❌ Plată RESPINSĂ');
            
            setTimeout(() => {
              const mol13 = buildMol('MOL', '13', '');
              log('📤 TX MOL13 (Confirmare finală)');
              port.write(mol13);
              setTimeout(() => cleanup({ success: approved, authCode: '123456', code: approved ? '0000' : 'REFUSED', raw: payload }, approved ? null : 'Tranzacție refuzată de terminal'), 500);
            }, 300);
          }
        }
      }
    });

    port.on('error', err => { if (!done) cleanup(false, err.message); });
  });
}

async function start() {
  let portPath;
  if (COM_PORT && COM_PORT !== 'auto') {
    portPath = COM_PORT;
    log(`Port din config: ${portPath}`);
  } else {
    portPath = await detectPosPort();
  }

  log(`Render:   ${RENDER_URL}`);
  log(`COM Port: ${portPath} @ ${BAUD_RATE} baud (8-N-1)`);
  log(`Locație:  ${LOCATION_ID}`);
  log(`Log:      ${LOG_FILE}`);

  const socket = ioClient(RENDER_URL, {
    auth: { bridgeKey: BRIDGE_KEY, locationId: LOCATION_ID },
    reconnection: true,
    reconnectionDelay: 3000,
  });

  socket.on('connect', () => {
    log(`✅ Conectat la server`);
    socket.emit('pos_bridge_register', { locationId: LOCATION_ID, port: portPath });
  });
  
  socket.on('disconnect', reason => {
    log(`⚠️  Deconectat: ${reason} — reconectez...`);
  });

  socket.on('print_ticket', async (order) => {
    if (order && (order.locationId === LOCATION_ID || !order.locationId)) {
      log(`🖨️  Cerere printare bon pentru comanda #${order.orderNumber}`);
      await printTicket(order);
    }
  });

  let paymentInProgress = false;

  socket.on('pos_payment_request', async (data) => {
    const { orderId, amount, locationId: lid } = data;
    
    if (lid && lid !== LOCATION_ID) return;

    if (paymentInProgress) {
      log(`⚠️ SKIP: o plată e deja în curs`);
      socket.emit('pos_payment_result', { orderId, paid: false, error: 'Altă plată în curs' });
      return;
    }

    paymentInProgress = true;
    log(`💳 ==== CERERE PLATĂ ====`); 
    log(`   orderId: ${orderId}`);
    log(`   amount:  ${amount} RON`);
    
    socket.emit('pos_bridge_status', { orderId, message: 'Inițiez plata...' });

    try {
      const res = await processMolPayment(amount, portPath, (msg) => {
        log(`STATUS: ${msg}`);
        socket.emit('pos_bridge_status', { orderId, message: msg });
      });
      
      log(`✅ REZULTAT: ${res.success ? 'APROBAT' : 'REFUZAT'} auth=${res.authCode}`);
      
      socket.emit('pos_payment_result', { 
        orderId, 
        paid: res.success, 
        authCode: res.authCode,
        code: res.code || (res.success ? '0000' : 'DECLINED'),
        raw: res.raw || '',
        error: res.reason || null
      });
    } catch (err) {
      log(`❌ EROARE: ${err.message}`);
      socket.emit('pos_payment_result', { orderId, paid: false, error: err.message });
    } finally {
      paymentInProgress = false;
    }
  });
}

start().catch(err => {
  log(`❌ EROARE FATALĂ: ${err.message}`);
  process.exit(1);
});
