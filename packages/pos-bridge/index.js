/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SMART KIOSK — POS Bridge                                      ║
 * ║  Protocol: Printec ECR v3.9.3 (VeriFone V200t / Raiffeisen)    ║
 * ║  Serial:   8-N-1 @ 9600 bps                                    ║
 * ║  Frame:    DLE STX <CMD> DLE ETX LRC                           ║
 * ║                                                                  ║
 * ║  PORNIRE: dublu-click pe start-windows.bat                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const { io: ioClient } = require('socket.io-client');
const { SerialPort }   = require('serialport');
const fs               = require('fs');
const pathMod          = require('path');

// ── LOG FILE ──────────────────────────────────────────────────────────────────
const LOG_FILE = pathMod.join(__dirname, 'pos-bridge.log');

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').split('.')[0];
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}
}

function hexLine(buf) {
  return [...buf].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

log('════════════════════════════════════════════════════');
log('POS Bridge pornit (Printec ECR v3.9.3)');

// ── Config ────────────────────────────────────────────────────────────────────
const RENDER_URL  = process.env.RENDER_URL  || 'https://smart-kiosk-ttut.onrender.com';
const COM_PORT    = process.env.COM_PORT    || 'auto';
const BAUD_RATE   = parseInt(process.env.BAUD_RATE || '9600');
const LOCATION_ID = process.env.LOCATION_ID || 'sm-brasov';
const BRIDGE_KEY  = process.env.BRIDGE_KEY  || 'pos-bridge-2024';

// ── Control Characters ────────────────────────────────────────────────────────
const DLE = 0x10, STX = 0x02, ETX = 0x03, ACK = 0x06, NAK = 0x15, EOT = 0x04, ENQ = 0x05, FS = 0x1C;

// ── Frame helpers (Printec protocol) ──────────────────────────────────────────
function calcLRC(cmdBytes) {
  let b = 0;
  for (const byte of cmdBytes) b ^= byte;
  return b;
}

function buildFrame(cmdBytes) {
  const lrc = calcLRC(cmdBytes);
  return Buffer.from([DLE, STX, ...cmdBytes, DLE, ETX, lrc]);
}

// LOGIN:  KLASSE=06, INST=00, DLNG=00
const LOGIN_FRAME = buildFrame([0x06, 0x00, 0x00]);

// SALE:   KLASSE=06, INST=01, DLNG=21(0x15), Data: Amount(12) + ArticleCode(3) + Quantity(6)
function buildSale(amountRon) {
  const cents   = Math.round(amountRon * 100);
  const amtStr  = String(cents).padStart(12, '0');
  const dataStr = amtStr + '000' + '000000'; // 21 bytes total
  return buildFrame([0x06, 0x01, 0x15, ...Buffer.from(dataStr, 'ascii')]);
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
           fn.includes('usb serial') || fn.includes('usb-serial');
  });

  if (posPort) { log(`✅ Port detectat: ${posPort.path}`); return posPort.path; }

  const firstCom = ports.find(p => p.path.startsWith('COM') && !p.path.includes('BT'));
  if (firstCom) { log(`⚠️  Folosesc primul COM: ${firstCom.path}`); return firstCom.path; }

  throw new Error('Nu am găsit niciun port serial!');
}

// ── Printec ECR Payment State Machine ─────────────────────────────────────────
function processPayment(amount, portPath, onStatus) {
  return new Promise((resolve, reject) => {
    let rxBuf      = Buffer.alloc(0);
    let state      = 'IDLE';
    let stateTimer = null;
    let done       = false;

    const saleFrame = buildSale(amount);
    log(`SALE frame: ${hexLine(saleFrame)}`);

    const setState = (s) => { state = s; log(`  ─ State: ${s}`); };

    const arm = (ms, lbl) => {
      clearTimeout(stateTimer);
      stateTimer = setTimeout(() => {
        if (done) return;
        log(`⏱ TIMEOUT: ${lbl}`);
        try { port.write(Buffer.from([EOT])); } catch (_) {}
        cleanup(false, `Timeout: ${lbl}`);
      }, ms);
    };

    const cleanup = (success, errMsg) => {
      if (done) return;
      done = true;
      clearTimeout(stateTimer);
      setTimeout(() => { try { port.close(); } catch (_) {} }, 300);
      if (success) {
        resolve(success);
      } else {
        reject(new Error(errMsg || 'Plată eșuată'));
      }
    };

    const port = new SerialPort({
      path: portPath, baudRate: BAUD_RATE,
      dataBits: 8, parity: 'none', stopBits: 1,
      autoOpen: false,
    });

    // ── ECR inițiază schimb: ENQ → ACK → Frame → ACK → EOT ──
    let pendingFrame = null;
    let pendingNext  = '';
    let pendingLabel = '';

    function ecrInitiate(frame, nextState, label) {
      log(`📤 ENQ (${label})`);
      port.write(Buffer.from([ENQ]));
      pendingFrame = frame;
      pendingNext  = nextState;
      pendingLabel = label;
      setState(`WAIT_ACK_ENQ_${nextState}`);
      arm(3000, `ACK la ENQ (${label})`);
    }

    port.open(err => {
      if (err) { log(`❌ Nu pot deschide ${portPath}: ${err.message}`); return reject(new Error(err.message)); }
      log(`Port ${portPath} deschis @ ${BAUD_RATE} baud (8-N-1)`);

      // Pasul 1: LOGIN
      ecrInitiate(LOGIN_FRAME, 'LOGIN', 'LOGIN');
    });

    port.on('data', chunk => {
      if (done) return;
      rxBuf = Buffer.concat([rxBuf, chunk]);
      log(`📥 RX: ${hexLine(chunk)}`);

      while (rxBuf.length > 0 && !done) {
        const b = rxBuf[0];

        // ── ACK după ENQ-ul nostru ────────────────────────────────────────
        if (b === ACK && state.startsWith('WAIT_ACK_ENQ_')) {
          rxBuf = rxBuf.subarray(1);
          clearTimeout(stateTimer);
          log(`✅ ACK la ENQ (${pendingLabel}). Trimit frame...`);
          log(`📤 TX: ${hexLine(pendingFrame)}`);
          port.write(pendingFrame);
          setState(`WAIT_ACK_FRAME_${pendingNext}`);
          arm(3000, `ACK la frame (${pendingLabel})`);
          break;
        }

        // ── ACK după frame-ul nostru ──────────────────────────────────────
        if (b === ACK && state.startsWith('WAIT_ACK_FRAME_')) {
          rxBuf = rxBuf.subarray(1);
          clearTimeout(stateTimer);
          const ns = state.replace('WAIT_ACK_FRAME_', '');

          if (ns === 'LOGIN') {
            log(`✅ LOGIN frame confirmat. Trimit EOT. Aștept răspuns LOGIN...`);
            port.write(Buffer.from([EOT]));
            setState('WAIT_LOGIN_RESP_ENQ');
            arm(10000, 'ENQ răspuns LOGIN');
          } else if (ns === 'SALE') {
            log(`✅ SALE frame confirmat. Trimit EOT. Aștept card...`);
            port.write(Buffer.from([EOT]));
            onStatus && onStatus('Terminal activat — prezentaţi cardul');
            setState('WAIT_RESULT');
            arm(120000, 'rezultat tranzacție (2min)');
          }
          break;
        }

        // ── NAK ──────────────────────────────────────────────────────────
        if (b === NAK) {
          rxBuf = rxBuf.subarray(1);
          log('⚠️ NAK primit');
          break;
        }

        // ── EOT ──────────────────────────────────────────────────────────
        if (b === EOT) {
          rxBuf = rxBuf.subarray(1);
          log('📥 EOT');
          break;
        }

        // ── ENQ de la POS (POS vrea să trimită) ──────────────────────────
        if (b === ENQ) {
          rxBuf = rxBuf.subarray(1);
          clearTimeout(stateTimer);
          log(`📥 ENQ de la POS (state=${state})`);
          port.write(Buffer.from([ACK]));
          log(`📤 ACK (răspund la ENQ)`);

          if (state === 'WAIT_LOGIN_RESP_ENQ') {
            setState('WAIT_POS_FRAME_LOGIN');
            arm(5000, 'frame LOGIN response');
          } else if (state === 'WAIT_RESULT') {
            setState('WAIT_POS_FRAME_RESULT');
            arm(120000, 'frame rezultat');
          }
          break;
        }

        // ── Frame DLE STX ... DLE ETX LRC ────────────────────────────────
        if (b === DLE && rxBuf.length >= 2 && rxBuf[1] === STX) {
          // Caută DLE ETX
          let frameEnd = -1;
          for (let i = 2; i < rxBuf.length - 1; i++) {
            if (rxBuf[i] === DLE && rxBuf[i + 1] === ETX && rxBuf.length > i + 2) {
              frameEnd = i + 2; // inclusiv LRC
              break;
            }
          }
          if (frameEnd < 0) break; // frame incomplet, așteptăm mai mult

          const cmdBytes    = rxBuf.subarray(2, frameEnd - 2);
          const receivedLRC = rxBuf[frameEnd];
          const calcedLRC   = calcLRC(cmdBytes);
          rxBuf = rxBuf.subarray(frameEnd + 1);

          log(`📦 Frame: ${hexLine(cmdBytes)}`);
          log(`   LRC: recv=0x${(receivedLRC||0).toString(16).toUpperCase()} calc=0x${calcedLRC.toString(16).toUpperCase()} ${receivedLRC === calcedLRC ? '✅' : '❌'}`);

          if (receivedLRC === calcedLRC) {
            port.write(Buffer.from([ACK]));
          } else {
            port.write(Buffer.from([NAK]));
            log('📤 NAK (LRC greșit)');
            break;
          }

          const klasse = cmdBytes[0];
          const instr  = cmdBytes[1];
          const data   = cmdBytes.subarray(3);

          // ── LOGIN Response ──────────────────────────────────────────────
          if ((klasse === 0x80 || klasse === 0x84) && state === 'WAIT_POS_FRAME_LOGIN') {
            const ok = (klasse === 0x80) || (klasse === 0x84 && cmdBytes[1] === 0x00);
            log(`LOGIN response: ${ok ? '✅ OK' : '❌ FAIL'}`);
            port.write(Buffer.from([EOT]));

            if (ok) {
              log('✅ LOGIN reușit! Inițiez SALE...');
              onStatus && onStatus('Login OK — inițiez plata...');
              setTimeout(() => ecrInitiate(saleFrame, 'SALE', 'SALE'), 500);
            } else {
              cleanup(false, 'LOGIN eșuat');
            }
            break;
          }

          // ── Intermediate: SALE ack from POS ─────────────────────────────
          if ((klasse === 0x80 || klasse === 0x84) && state === 'WAIT_POS_FRAME_RESULT') {
            log('POS a confirmat SALE. Aștept card (2 min)...');
            port.write(Buffer.from([EOT]));
            onStatus && onStatus('Terminal activat — prezentaţi cardul');
            setState('WAIT_RESULT');
            arm(120000, 'rezultat după SALE confirm');
            break;
          }

          // ── PIN Entry notification ──────────────────────────────────────
          if (klasse === 0x05 && instr === 0x01) {
            log('🔒 Client introduce PIN-ul...');
            port.write(Buffer.from([EOT]));
            onStatus && onStatus('Introduceți PIN-ul pe terminal');
            setState('WAIT_RESULT');
            arm(120000, 'rezultat după PIN');
            break;
          }

          // ── Begin Auth notification ─────────────────────────────────────
          if (klasse === 0x05 && instr === 0x02) {
            log('🌐 Comunicare cu banca...');
            port.write(Buffer.from([EOT]));
            onStatus && onStatus('Comunicare cu banca...');
            setState('WAIT_RESULT');
            arm(120000, 'rezultat după auth');
            break;
          }

          // ── Authorization End (0x06 0x0F) — REZULTAT FINAL ──────────────
          if (klasse === 0x06 && instr === 0x0F) {
            log('═══════════════════════════════════════');
            log('  REZULTAT TRANZACȚIE');
            log('═══════════════════════════════════════');

            const payload  = data.subarray(1); // skip length byte
            const refNum   = payload.subarray(0, 12).toString('ascii').trim();
            const termId   = payload.subarray(12, 20).toString('ascii').trim();
            const txDate   = payload.subarray(20, 32).toString('ascii').trim();
            const txAmount = payload.subarray(32, 44).toString('ascii').trim();
            const currency = payload.subarray(44, 47).toString('ascii').trim();
            const authCode = payload.subarray(47, 53).toString('ascii').trim();
            const respCode = payload.subarray(53, 57).toString('ascii').trim();

            const varPart   = payload.subarray(57).toString('ascii');
            const varFields = varPart.split(String.fromCharCode(FS));

            const approved = respCode === '0000';

            log(`  Ref:       ${refNum}`);
            log(`  Terminal:  ${termId}`);
            log(`  Date:      ${txDate}`);
            log(`  Amount:    ${txAmount} ${currency}`);
            log(`  Auth Code: ${authCode}`);
            log(`  Resp Code: ${respCode} → ${approved ? '✅ APROBAT' : '❌ REFUZAT'}`);
            if (varFields[0]) log(`  Resp Text: ${varFields[0]}`);
            if (varFields[1]) log(`  Card:      ${varFields[1]}`);
            log('═══════════════════════════════════════');

            port.write(Buffer.from([EOT]));
            cleanup(
              { success: approved, authCode, respCode, refNum, raw: hexLine(cmdBytes) },
              approved ? null : `Refuzat: ${respCode} ${varFields[0] || ''}`
            );
            break;
          }

          // ── Refusal (0x06 0x1E) ─────────────────────────────────────────
          if (klasse === 0x06 && instr === 0x1E) {
            log(`❌ REFUZ de la POS (cod: 0x${(data[0] || 0).toString(16)})`);
            port.write(Buffer.from([EOT]));
            cleanup(false, `POS refusal: 0x${(data[0] || 0).toString(16)}`);
            break;
          }

          // ── Unknown frame ───────────────────────────────────────────────
          log(`  Frame necunoscut: klasse=0x${klasse.toString(16)} instr=0x${instr.toString(16)}`);
          port.write(Buffer.from([EOT]));

          // Dacă suntem în WAIT_RESULT, revenim la așteptare
          if (state.startsWith('WAIT_')) {
            setState('WAIT_RESULT');
            arm(120000, 'rezultat (fallback)');
          }
          break;
        }

        // Byte necunoscut — skip
        rxBuf = rxBuf.subarray(1);
      }
    });

    port.on('error', err => { if (!done) { log(`❌ Port error: ${err.message}`); cleanup(false, err.message); } });
    port.on('close', () => { log('Port închis.'); });
  });
}

// ── Socket.IO — conectare la Render ──────────────────────────────────────────
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
    log(`✅ Conectat la Render (${socket.id})`);
    socket.emit('pos_bridge_register', { locationId: LOCATION_ID, port: portPath });
  });

  socket.on('disconnect', reason => {
    log(`⚠️  Deconectat: ${reason} — reconectez...`);
  });

  // Render trimite cerere de plată
  let paymentInProgress = false;

  socket.on('pos_payment_request', async ({ orderId, amount, locationId: lid }) => {
    if (lid && lid !== LOCATION_ID) {
      log(`SKIP: locationId=${lid} != ${LOCATION_ID}`);
      return;
    }

    if (paymentInProgress) {
      log(`⚠️ SKIP: o plată e deja în curs`);
      socket.emit('pos_payment_result', { orderId, paid: false, error: 'Altă plată în curs' });
      return;
    }

    paymentInProgress = true;
    log(`💳 ════ CERERE PLATĂ ════`);
    log(`   orderId: ${orderId}`);
    log(`   amount:  ${amount} RON`);

    socket.emit('pos_bridge_status', { orderId, message: 'Inițiez plata...' });

    try {
      const result = await processPayment(amount, portPath, (msg) => {
        log(`STATUS: ${msg}`);
        socket.emit('pos_bridge_status', { orderId, message: msg });
      });

      log(`✅ REZULTAT: ${result.success ? 'APROBAT' : 'REFUZAT'} auth=${result.authCode}`);
      socket.emit('pos_payment_result', {
        orderId,
        paid:     result.success,
        authCode: result.authCode,
        code:     result.respCode || (result.success ? '0000' : 'DECLINED'),
        raw:      result.raw || '',
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
