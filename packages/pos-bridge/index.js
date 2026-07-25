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
const fs             = require('fs');
const path           = require('path');

// ── LOG FILE ──────────────────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, 'pos-bridge.log');

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').split('.')[0];
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch(_) {}
}

function logHex(label, buf) {
  const hex = Buffer.isBuffer(buf) ? buf.toString('hex').match(/../g).join(' ') : String(buf);
  log(`${label}: ${hex}`);
}

log('════════════════════════════════════════════════════');
log('POS Bridge pornit');

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
  log('Porturi seriale disponibile:');
  ports.forEach(p => log(`  ${p.path} | ${p.manufacturer || '-'} | ${p.friendlyName || '-'}`));

  const posPort = ports.find(p => {
    const mfg = (p.manufacturer || '').toLowerCase();
    const fn  = (p.friendlyName || '').toLowerCase();
    return mfg.includes('ftdi') || mfg.includes('cp210') || mfg.includes('prolific') ||
           mfg.includes('ch340') || mfg.includes('silicon lab') ||
           fn.includes('usb serial') || fn.includes('usb-serial') || fn.includes('com');
  });

  if (posPort) {
    log(`✅ Port detectat automat: ${posPort.path}`);
    return posPort.path;
  }

  const firstCom = ports.find(p => p.path.startsWith('COM') && !p.path.includes('BT'));
  if (firstCom) {
    log(`⚠️  Folosesc primul COM disponibil: ${firstCom.path}`);
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
    const fail = (msg)     => { clearTimeout(timer); try { port.close(); } catch(_) {} log(`❌ FAIL: ${msg}`); reject(new Error(msg)); };
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
      if (err) { log(`❌ Nu pot deschide ${portPath}: ${err.message}`); return reject(new Error(`Nu pot deschide ${portPath}: ${err.message}`)); }
      log(`Port ${portPath} deschis @ ${BAUD_RATE} baud`);

      // Trimite MOL10 — inițierea plătii
      const mol10 = buildMsg('M', '10', amountStr + 'RON' + '0'.repeat(20));
      logHex('TX MOL10', mol10);
      port.write(mol10);
      arm(5000, 'ACK la MOL10');
    });

    port.on('data', chunk => {
      if (state === 'DONE' || state === 'FAILED') return; // ignoră datele după finalizare
      logHex('RX', chunk);
      rxBuf = Buffer.concat([rxBuf, chunk]);

      // EOT (0x04) = POS a refuzat mesajul / protocol greșit
      if (rxBuf[0] === 0x04) {
        log('❌ POS a trimis EOT (0x04) — mesajul a fost REFUZAT');
        log('   Posibile cauze: format protocol incorect, POS nu e în mod ECR, sau baud rate greșit');
        state = 'FAILED';
        fail('POS a refuzat mesajul (EOT). Verifică protocolul ECR și configurarea POS-ului.');
        return;
      }

      // NAK (0x15) = POS nu a înțeles mesajul
      if (rxBuf[0] === NAK) {
        log('❌ POS a trimis NAK (0x15) — mesajul nu a fost înțeles');
        state = 'FAILED';
        fail('POS NAK — mesaj neînțeles. Verifică formatul protocolului.');
        return;
      }

      // ACK la MOL10
      if (state === 'WAIT_ACK_10' && rxBuf[0] === ACK) {
        rxBuf = rxBuf.subarray(1);
        state = 'WAIT_MOL11';
        arm(120000, 'MOL11 — aştept cardul');
        onStatus && onStatus('Terminal activat — prezentaţi cardul');
        log('ACK MOL10 ✓ — aştept cardul');
        return;
      }

      // MOL11 — cardul e prezent/introdus
      if (state === 'WAIT_MOL11' && rxBuf.includes(STX)) {
        log('MOL11 primit — trimit ACK');
        logHex('RX MOL11 complet', rxBuf);
        port.write(Buffer.from([ACK]));
        rxBuf = Buffer.alloc(0);
        state = 'WAIT_MOL12';
        arm(120000, 'MOL12 — autorizare GPRS');
        onStatus && onStatus('Comunicare cu banca prin GPRS...');
        log('MOL11 ✓ — autorizez prin GPRS');
        return;
      }

      // MOL12 — rezultatul final
      if (state === 'WAIT_MOL12' && rxBuf.includes(STX)) {
        port.write(Buffer.from([ACK]));
        const raw = rxBuf.toString('ascii');
        logHex('RX MOL12 complet', rxBuf);
        log(`MOL12 RAW ASCII: ${raw}`);
        rxBuf = Buffer.alloc(0);
        state = 'DONE';

        const approved  = raw.includes('.00') || raw.includes('APROBAT') || raw.includes('APPROVED');
        const authMatch = raw.match(/[A-Z0-9]{6}/);
        const authCode  = authMatch ? authMatch[0] : '';

        log(`MOL12 ✓ — ${approved ? '✅ APROBAT' : '❌ REFUZAT'} auth=${authCode}`);

        // Confirmare finală MOL13
        setTimeout(() => {
          const mol13 = buildMsg('M', '13', approved ? '00' : '01');
          logHex('TX MOL13', mol13);
          port.write(mol13);
          setTimeout(() => ok({ success: approved, authCode, raw }), 500);
        }, 300);
      }
    });

    port.on('error', err => { if (state !== 'DONE' && state !== 'FAILED') fail(`Eroare serial: ${err.message}`); });
    port.on('close', () => { if (state !== 'DONE' && state !== 'FAILED') fail('Port COM închis neaşteptat'); });
  });
}

// ── Socket.IO — conectare la Render ──────────────────────────────────────────
async function start() {
  let portPath;
  if (COM_PORT && COM_PORT !== 'auto') {
    portPath = COM_PORT;
    log(`Folosesc portul din config: ${portPath}`);
  } else {
    portPath = await detectPosPort();
  }

  log(`Render:   ${RENDER_URL}`);
  log(`COM Port: ${portPath} @ ${BAUD_RATE} baud`);
  log(`Locație:  ${LOCATION_ID}`);
  log(`Log file: ${LOG_FILE}`);

  const socket = io(RENDER_URL, {
    auth: { bridgeKey: BRIDGE_KEY, locationId: LOCATION_ID },
    reconnection: true,
    reconnectionDelay: 3000,
  });

  socket.on('connect', () => {
    log(`✅ Conectat la Render (${socket.id})`);
    socket.emit('pos_bridge_register', { locationId: LOCATION_ID, port: portPath });
  });

  socket.on('disconnect', reason => {
    log(`⚠️  Deconectat: ${reason} — reconectez...`);
  });

  // Render trimite cerere de plată
  socket.on('pos_payment_request', async ({ orderId, amount, locationId: lid }) => {
    if (lid && lid !== LOCATION_ID) {
      log(`SKIP cerere: locationId=${lid} nu e al nostru (${LOCATION_ID})`);
      return;
    }

    log(`💳 ════ CERERE PLATĂ ════`);
    log(`   orderId:    ${orderId}`);
    log(`   amount:     ${amount} RON`);
    log(`   locationId: ${lid || 'nedefinit'}`);

    socket.emit('pos_bridge_status', { orderId, message: 'Terminal activat — prezentaţi cardul' });

    try {
      const result = await processPayment(amount, portPath, (msg) => {
        log(`STATUS: ${msg}`);
        socket.emit('pos_bridge_status', { orderId, message: msg });
      });
      log(`✅ REZULTAT: ${result.success ? 'APROBAT' : 'REFUZAT'} — auth=${result.authCode}`);
      log(`   RAW: ${result.raw}`);
      socket.emit('pos_payment_result', {
        orderId,
        paid:     result.success,
        authCode: result.authCode,
        code:     result.success ? '0000' : 'DECLINED',
        raw:      result.raw,
      });
    } catch (err) {
      log(`❌ EROARE POS: ${err.message}`);
      socket.emit('pos_payment_result', { orderId, paid: false, error: err.message });
    }
  });
}

start().catch(err => {
  log(`❌ EROARE FATALĂ: ${err.message}`);
  log('Verifică că POS-ul e conectat la USB și driverul e instalat.');
  process.exit(1);
});
