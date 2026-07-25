/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SMART KIOSK — POS Bridge (Serial COM + GPRS)                  ║
 * ║  Rulează pe PC-ul Windows din restaurant.                       ║
 * ║  POS Raiffeisen conectat prin COM serial (USB-Serial adapter).  ║
 * ║  POS comunică cu banca prin GPRS propriu.                      ║
 * ║                                                                  ║
 * ║  PORNIRE: dublu-click pe start-windows.bat                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const { io }        = require('socket.io-client');
const { SerialPort } = require('serialport');

// ── Config ────────────────────────────────────────────────────────────────────
const RENDER_URL  = process.env.RENDER_URL  || 'https://smart-kiosk-ttut.onrender.com';
const COM_PORT    = process.env.COM_PORT    || 'auto';   // ex: COM3, COM4, sau 'auto'
const BAUD_RATE   = parseInt(process.env.BAUD_RATE || '9600');
const LOCATION_ID = process.env.LOCATION_ID || 'brasov';
const BRIDGE_KEY  = process.env.BRIDGE_KEY  || 'pos-bridge-2024';

// ── Protocol ECR (STX/ETX/LRC) ───────────────────────────────────────────────
const STX = 0x02, ETX = 0x03, ACK = 0x06, NAK = 0x15;

function calcLRC(buf) {
  let lrc = 0;
  for (let i = 1; i < buf.length - 1; i++) lrc ^= buf[i];
  return lrc;
}

function buildMsg(msgId, msgType, payload) {
  const msgBuf = Buffer.from(msgId + msgType + '.' + payload, 'ascii');
  const out    = Buffer.alloc(msgBuf.length + 3);
  out[0] = STX;
  msgBuf.copy(out, 1);
  out[out.length - 2] = ETX;
  out[out.length - 1] = calcLRC(out);
  return out;
}

// ── Auto-detectare port COM ───────────────────────────────────────────────────
async function detectPosPort() {
  const ports = await SerialPort.list();
  console.log('[POS Bridge] Porturi seriale disponibile:');
  ports.forEach(p => console.log(`  ${p.path} | ${p.manufacturer || '-'} | ${p.friendlyName || '-'}`));

  // Caută adaptor USB-Serial (FTDI, CP210x, Prolific, CH340 — comune cu POS-uri)
  const posPort = ports.find(p => {
    const mfg = (p.manufacturer || '').toLowerCase();
    const fn  = (p.friendlyName || '').toLowerCase();
    return mfg.includes('ftdi') || mfg.includes('cp210') || mfg.includes('prolific') ||
           mfg.includes('ch340') || mfg.includes('silicon lab') ||
           fn.includes('usb serial') || fn.includes('usb-serial') || fn.includes('com');
  });

  if (posPort) {
    console.log(`[POS Bridge] ✅ Port detectat automat: ${posPort.path}`);
    return posPort.path;
  }

  // Fallback: primul COM disponibil (altul decât Bluetooth)
  const firstCom = ports.find(p => p.path.startsWith('COM') && !p.path.includes('BT'));
  if (firstCom) {
    console.log(`[POS Bridge] ⚠️  Folosesc primul COM disponibil: ${firstCom.path}`);
    return firstCom.path;
  }

  throw new Error('Nu am găsit niciun port serial! Verifică că POS-ul e conectat.');
}

// ── Plată prin COM serial (protocol ECR Raiffeisen MOL) ──────────────────────
async function processPayment(amount, portPath, onStatus) {
  return new Promise((resolve, reject) => {
    const amountStr = String(Math.round(amount * 100)).padStart(12, '0');
    let rxBuf = Buffer.alloc(0);
    let state = 'WAIT_ACK_10';
    let timer;

    const arm  = (ms, lbl) => { clearTimeout(timer); timer = setTimeout(() => fail(`Timeout: ${lbl}`), ms); };
    const fail = (msg)     => { clearTimeout(timer); try { port.close(); } catch(_) {} reject(new Error(msg)); };
    const ok   = (r)       => { clearTimeout(timer); try { port.close(); } catch(_) {} resolve(r); };

    const port = new SerialPort({
      path:     portPath,
      baudRate: BAUD_RATE,
      dataBits: 8,
      parity:   'none',
      stopBits: 1,
      autoOpen: false,
    });

    port.open(err => {
      if (err) return reject(new Error(`Nu pot deschide ${portPath}: ${err.message}`));
      console.log(`[POS Bridge] Port ${portPath} deschis @ ${BAUD_RATE} baud`);

      // Trimite MOL10 — inițierea plătii
      const mol10 = buildMsg('M', '10', amountStr + 'RON' + '0'.repeat(20));
      port.write(mol10);
      arm(5000, 'ACK la MOL10');
    });

    port.on('data', chunk => {
      rxBuf = Buffer.concat([rxBuf, chunk]);

      // ACK la MOL10
      if (state === 'WAIT_ACK_10' && rxBuf[0] === ACK) {
        rxBuf = rxBuf.subarray(1);
        state = 'WAIT_MOL11';
        arm(120000, 'MOL11 — aştept cardul');
        onStatus && onStatus('Terminal activat — prezentaţi cardul');
        console.log('[POS Bridge] ACK MOL10 ✓ — aştept cardul (GPRS activ)');
        return;
      }

      // MOL11 — cardul e prezent/introdus
      if (state === 'WAIT_MOL11' && rxBuf.includes(STX)) {
        port.write(Buffer.from([ACK]));
        rxBuf = Buffer.alloc(0);
        state = 'WAIT_MOL12';
        arm(120000, 'MOL12 — autorizare GPRS');
        onStatus && onStatus('Comunicare cu banca prin GPRS...');
        console.log('[POS Bridge] MOL11 ✓ — autorizez prin GPRS');
        return;
      }

      // MOL12 — rezultatul final
      if (state === 'WAIT_MOL12' && rxBuf.includes(STX)) {
        port.write(Buffer.from([ACK]));
        const raw = rxBuf.toString('ascii');
        rxBuf = Buffer.alloc(0);
        state = 'DONE';

        const approved  = raw.includes('.00') || raw.includes('APROBAT') || raw.includes('APPROVED');
        const authMatch = raw.match(/[A-Z0-9]{6}/);
        const authCode  = authMatch ? authMatch[0] : '';

        console.log(`[POS Bridge] MOL12 ✓ — ${approved ? '✅ APROBAT' : '❌ REFUZAT'} auth=${authCode}`);

        // Confirmare finală MOL13
        setTimeout(() => {
          port.write(buildMsg('M', '13', approved ? '00' : '01'));
          setTimeout(() => ok({ success: approved, authCode, raw }), 500);
        }, 300);
      }
    });

    port.on('error', err => fail(`Eroare serial: ${err.message}`));
    port.on('close', () => { if (state !== 'DONE') fail('Port COM închis neaşteptat'); });
  });
}

// ── Socket.IO — conectare la Render ──────────────────────────────────────────
async function start() {
  // Determină portul COM
  let portPath;
  if (COM_PORT && COM_PORT !== 'auto') {
    portPath = COM_PORT;
    console.log(`[POS Bridge] Folosesc portul din config: ${portPath}`);
  } else {
    portPath = await detectPosPort();
  }

  console.log(`\n🔗 POS Bridge pornit`);
  console.log(`   Render:   ${RENDER_URL}`);
  console.log(`   COM Port: ${portPath} @ ${BAUD_RATE} baud`);
  console.log(`   Locație:  ${LOCATION_ID}`);
  console.log(`   GPRS:     POS comunică direct cu banca\n`);

  const socket = io(RENDER_URL, {
    auth: { bridgeKey: BRIDGE_KEY, locationId: LOCATION_ID },
    reconnection: true,
    reconnectionDelay: 3000,
  });

  socket.on('connect', () => {
    console.log(`✅ Conectat la Render (${socket.id})`);
    socket.emit('pos_bridge_register', { locationId: LOCATION_ID, port: portPath });
  });

  socket.on('disconnect', reason => {
    console.log(`⚠️  Deconectat: ${reason} — reconectez...`);
  });

  // Render trimite cerere de plată
  socket.on('pos_payment_request', async ({ orderId, amount, locationId: lid }) => {
    if (lid && lid !== LOCATION_ID) return; // nu e pentru noi

    console.log(`\n💳 Cerere plată: ${amount} RON (orderId=${orderId})`);

    socket.emit('pos_bridge_status', { orderId, message: 'Terminal activat — prezentaţi cardul' });

    try {
      const result = await processPayment(amount, portPath, (msg) => {
        socket.emit('pos_bridge_status', { orderId, message: msg });
      });
      console.log(`✅ ${result.success ? 'APROBAT' : 'REFUZAT'} — ${result.authCode}`);
      socket.emit('pos_payment_result', {
        orderId,
        paid:     result.success,
        authCode: result.authCode,
        code:     result.success ? '0000' : 'DECLINED',
        raw:      result.raw,
      });
    } catch (err) {
      console.error(`❌ Eroare: ${err.message}`);
      socket.emit('pos_payment_result', { orderId, paid: false, error: err.message });
    }
  });
}

start().catch(err => {
  console.error('\n❌ EROARE FATALĂ:', err.message);
  console.error('Verifică că POS-ul e conectat la USB și driverul e instalat.\n');
  process.exit(1);
});
