/**
 * POS Bridge — Printec ECR v3.9.3 (VeriFone V200t Serial)
 * ─────────────────────────────────────────────────────────
 * Bridge între Smart Kiosk (pe Render) și POS VeriFone V200t prin COM serial.
 * Protocolul: Printec ECR v3.9.3 cu DLE STX framing + ENQ/ACK handshake.
 */
require('dotenv').config();
const { printTicket } = require('./printer');
const { io: ioClient } = require('socket.io-client');
const { SerialPort }   = require('serialport');
const fs               = require('fs');
const pathMod          = require('path');

function log(msg) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  
  const logFile = pathMod.join(__dirname, `pos-bridge-${yyyy}-${mm}-${dd}.log`);
  
  const ts = `${yyyy}-${mm}-${dd} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(logFile, line + '\n'); } catch (_) {}
}

const RENDER_URL  = process.env.RENDER_URL  || 'https://smart-kiosk-ttut.onrender.com';
const COM_PORT    = process.env.COM_PORT    || 'auto';
const BAUD_RATE   = parseInt(process.env.BAUD_RATE || '9600');
const LOCATION_ID = process.env.LOCATION_ID || 'sm-brasov';
const BRIDGE_KEY  = process.env.BRIDGE_KEY  || 'pos-bridge-2024';

// ── Printec ECR v3.9.3 Control Characters ────────────────────────────────────
const DLE = 0x10;
const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;
const EOT = 0x04;
const ENQ = 0x05;
const FS  = 0x1C;

// ── Printec Frame Helpers ────────────────────────────────────────────────────
/** LRC = XOR al tuturor octeților din command (fără DLE STX / DLE ETX) */
function calcLRC(cmdBytes) {
  let b = 0;
  for (const byte of cmdBytes) b ^= byte;
  return b;
}

/** Construiește frame Printec: DLE STX <cmdBytes> DLE ETX LRC */
function buildFrame(cmdBytes) {
  const lrc = calcLRC(cmdBytes);
  return Buffer.from([DLE, STX, ...cmdBytes, DLE, ETX, lrc]);
}

/** Extrage frame DLE STX...DLE ETX din buffer */
function extractFrame(buf, startOffset = 0) {
  for (let i = startOffset; i < buf.length - 1; i++) {
    if (buf[i] === DLE && buf[i + 1] === STX) {
      for (let j = i + 2; j < buf.length - 1; j++) {
        if (buf[j] === DLE && buf[j + 1] === ETX && buf.length > j + 2) {
          const cmdBytes = buf.subarray(i + 2, j);
          const lrcByte  = buf[j + 2];
          const frameEnd = j + 3;
          return { cmdBytes, lrcByte, frameEnd };
        }
      }
      break; // frame incomplet
    }
  }
  return null;
}

async function detectPosPort() {
  const ports = await SerialPort.list();
  const firstCom = ports.find(p => p.path.startsWith('COM') && !p.path.includes('BT'));
  return firstCom ? firstCom.path : 'COM3';
}

// ── Printec ECR v3.9.3 Payment ───────────────────────────────────────────────
function processPrintecPayment(amount, portPath, onStatus) {
  if (!amount || amount <= 0) throw new Error('Sumă invalidă');

  // ── Build frames ──
  const LOGIN_FRAME = buildFrame([0x06, 0x00, 0x00]);

  const cents   = Math.round(amount * 100);
  const amtStr  = String(cents).padStart(12, '0');
  // SALE: 06 01 15 + amount(12) + '000'(3 - article code) + '000000'(6 - quantity)
  const saleCmd = [0x06, 0x01, 0x15, ...Buffer.from(amtStr + '000' + '000000', 'ascii')];
  const SALE_FRAME = buildFrame(saleCmd);

  return new Promise((resolve, reject) => {
    let port;
    let rxBuf    = Buffer.alloc(0);
    let state    = 'IDLE';
    let finished = false;
    let stateTimer;

    const cleanup = () => {
      clearTimeout(stateTimer);
      try { if (port && port.isOpen) port.close(); } catch (_) {}
    };

    const fail = (msg) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error(msg));
    };

    const succeed = (result) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(result);
    };

    const setState = (s) => { state = s; };

    const armTimeout = (msg, ms) => {
      clearTimeout(stateTimer);
      stateTimer = setTimeout(() => fail(`Timeout: ${msg}`), ms);
    };

    try {
      port = new SerialPort({
        path: portPath,
        baudRate: BAUD_RATE,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false,
      });
    } catch (e) {
      return reject(new Error(`Nu pot crea portul serial: ${e.message}`));
    }

    /** ECR inițiază: ENQ → aștept ACK → trimit frame → aștept ACK → EOT */
    const ecrSend = (frame, nextState, label, timeoutMs = 3000) => {
      const hexStr = [...frame].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      log(`📤 ENQ → (${label})`);
      log(`📤 Frame pregătit [${frame.length} bytes]: ${hexStr}`);
      port.write(Buffer.from([ENQ]));
      setState(`WAIT_ENQ_ACK__${nextState}`);
      port._pendingFrame = frame;
      port._nextLabel    = label;
      port._nextState    = nextState;
      armTimeout(`ACK la ENQ (${label})`, timeoutMs);
    };

    const ecrAck = () => port.write(Buffer.from([ACK]));

    // ── Data handler ──────────────────────────────────────────────────────
    port.on('data', (chunk) => {
      if (finished) return;
      // Debug RAW
      const hexStr = [...chunk].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      log(`📥 RAW RX [${chunk.length} bytes]: ${hexStr}`);
      rxBuf = Buffer.concat([rxBuf, chunk]);

      while (rxBuf.length > 0 && !finished) {
        const b = rxBuf[0];

        // ── ACK la ENQ-ul nostru ─────────────────────────────────────
        if (b === ACK && state.startsWith('WAIT_ENQ_ACK__')) {
          rxBuf = rxBuf.subarray(1);
          clearTimeout(stateTimer);
          const frame = port._pendingFrame;
          const ns    = port._nextState;
          const lbl   = port._nextLabel;
          log(`✅ ACK ← POS la ENQ (${lbl}). Trimit frame...`);
          port.write(frame);
          setState(`WAIT_FRAME_ACK__${ns}`);
          armTimeout(`ACK la frame (${lbl})`, 3000);
          break;
        }

        // ── ACK la frame-ul nostru ───────────────────────────────────
        if (b === ACK && state.startsWith('WAIT_FRAME_ACK__')) {
          rxBuf = rxBuf.subarray(1);
          clearTimeout(stateTimer);
          const ns = state.replace('WAIT_FRAME_ACK__', '');

          if (ns === 'LOGIN') {
            log('✅ LOGIN frame acceptat → EOT');
            port.write(Buffer.from([EOT]));
            setState('WAIT_POS_ENQ__LOGIN_RESP');
            armTimeout('ENQ răspuns LOGIN', 5000);
          } else if (ns === 'SALE') {
            log('✅ SALE frame acceptat → EOT. Aștept card (2min)...');
            onStatus && onStatus('Terminal activat — apropiați cardul');
            port.write(Buffer.from([EOT]));
            setState('WAIT_POS_ENQ__RESULT');
            armTimeout('card/rezultat tranzacție', 120000);
          } else if (ns === 'FINAL_ACK') {
            log('✅ Rezultat confirmat → EOT → Done');
            port.write(Buffer.from([EOT]));
          }
          break;
        }

        // ── NAK ──────────────────────────────────────────────────────
        if (b === NAK) {
          rxBuf = rxBuf.subarray(1);
          log('⚠ NAK primit');
          break;
        }

        // ── EOT de la POS ────────────────────────────────────────────
        if (b === EOT) {
          rxBuf = rxBuf.subarray(1);
          log('📥 EOT ← POS');
          break;
        }

        // ── ENQ de la POS (POS inițiază schimb) ─────────────────────
        if (b === ENQ) {
          rxBuf = rxBuf.subarray(1);
          clearTimeout(stateTimer);
          log(`📥 ENQ ← POS (state=${state})`);
          ecrAck();

          if (state === 'WAIT_POS_ENQ__LOGIN_RESP') {
            setState('WAIT_POS_FRAME__LOGIN_RESP');
            armTimeout('frame LOGIN response', 3000);
          } else if (state === 'WAIT_POS_ENQ__RESULT') {
            setState('WAIT_POS_FRAME__RESULT');
            armTimeout('frame rezultat', 5000);
          }
          break;
        }

        // ── Frame DLE STX...DLE ETX de la POS ────────────────────────
        if (b === DLE && rxBuf.length >= 2 && rxBuf[1] === STX) {
          const extracted = extractFrame(rxBuf);
          if (!extracted) break; // incomplet

          const { cmdBytes, lrcByte, frameEnd } = extracted;
          rxBuf = rxBuf.subarray(frameEnd);
          clearTimeout(stateTimer);

          const calcedLRC = calcLRC(cmdBytes);
          if (lrcByte !== calcedLRC) {
            log(`⚠ LRC mismatch! recv=0x${lrcByte.toString(16)} calc=0x${calcedLRC.toString(16)}`);
            port.write(Buffer.from([NAK]));
            break;
          }

          // ACK frame valid
          port.write(Buffer.from([ACK]));

          const klasse = cmdBytes[0];
          const instr  = cmdBytes[1];
          const data   = cmdBytes.subarray(3); // după klasse, instr, dlng

          log(`📥 Frame: klasse=0x${klasse.toString(16)} instr=0x${instr.toString(16)} data=[${data.length} bytes]`);

          // ── LOGIN response (80/84) ──────────────────────────────
          if ((klasse === 0x80 || klasse === 0x84) && state === 'WAIT_POS_FRAME__LOGIN_RESP') {
            const ok = (klasse === 0x80) || (klasse === 0x84 && instr === 0x00);
            if (ok) {
              log('✅ LOGIN OK → EOT → inițiez SALE');
              port.write(Buffer.from([EOT]));
              setTimeout(() => ecrSend(SALE_FRAME, 'SALE', 'SALE', 3000), 1000);
            } else {
              fail(`LOGIN refuzat de POS (APRW=0x${instr.toString(16)})`);
            }
            break;
          }

          // ── PIN Entry (05 01) ────────────────────────────────────
          if (klasse === 0x05 && instr === 0x01) {
            log('📥 PIN Entry — clientul introduce PIN-ul');
            onStatus && onStatus('Introduceți PIN-ul');
            port.write(Buffer.from([EOT]));
            setState('WAIT_POS_ENQ__RESULT');
            armTimeout('rezultat după PIN', 120000);
            break;
          }

          // ── Begin Auth (05 02) ───────────────────────────────────
          if (klasse === 0x05 && instr === 0x02) {
            log('📥 Begin Auth — comunicare cu banca');
            onStatus && onStatus('Comunicare cu banca...');
            port.write(Buffer.from([EOT]));
            setState('WAIT_POS_ENQ__RESULT');
            armTimeout('rezultat după auth', 120000);
            break;
          }

          // ── Authorization End (06 0F) ────────────────────────────
          if (klasse === 0x06 && instr === 0x0F) {
            const payload = data;
            const refNum   = payload.subarray(0, 12).toString('ascii').trim();
            const termId   = payload.subarray(12, 20).toString('ascii').trim();
            const txDate   = payload.subarray(20, 32).toString('ascii').trim();
            const amtField = payload.subarray(32, 44).toString('ascii').trim();
            const currency = payload.subarray(44, 47).toString('ascii').trim();
            const authCode = payload.subarray(47, 53).toString('ascii').trim();
            const respCode = payload.subarray(53, 57).toString('ascii').trim();

            const varStr    = payload.subarray(57).toString('ascii');
            const varFields = varStr.split(String.fromCharCode(FS));
            const respText  = (varFields[0] || '').trim();
            const cardNo    = (varFields[1] || '').trim();

            const approved = respCode === '0000';
            log('════════════════════════════════════════════');
            log(`📥 Authorization End:`);
            log(`   Response Code: ${respCode} (${approved ? 'APROBAT' : 'RESPINS'})`);
            log(`   Auth Code:     ${authCode}`);
            log(`   Ref Number:    ${refNum}`);
            log(`   Card:          ${cardNo}`);
            log(`   Amount:        ${amtField} ${currency}`);
            log(`   Date:          ${txDate}`);
            log(`   Terminal:      ${termId}`);
            log(approved ? '✅ PLATĂ APROBATĂ!' : `❌ PLATĂ RESPINSĂ (cod: ${respCode})`);
            log('════════════════════════════════════════════');

            port.write(Buffer.from([EOT]));
            succeed({
              success: approved, code: respCode, authCode, refNum,
              cardNo, txDate, amount: amtField, currency, termId, respText,
              raw: payload.toString('hex'),
            });
            break;
          }

          // ── Refusal (06 1E) ──────────────────────────────────────
          if (klasse === 0x06 && instr === 0x1E) {
            const errCode = data[0];
            log(`❌ Refusal de la POS, cod=0x${errCode.toString(16)}`);
            port.write(Buffer.from([EOT]));
            succeed({
              success: false, code: errCode.toString(16).toUpperCase(),
              authCode: '', refNum: '', reason: 'Tranzacție refuzată de terminal',
            });
            break;
          }

          // Frame necunoscut
          log(`📥 Frame necunoscut: klasse=0x${klasse.toString(16)} instr=0x${instr.toString(16)}`);
          port.write(Buffer.from([EOT]));
          setState('WAIT_POS_ENQ__RESULT');
          armTimeout('rezultat', 120000);
          break;
        }

        // DLE singur — așteptăm STX (vine fragmentat)
        if (b === DLE) {
          break; // nu consuma DLE, așteaptă restul frame-ului
        }

        // Byte necunoscut — skip
        rxBuf = rxBuf.subarray(1);
      }
    });

    port.on('error', (err) => {
      log(`❌ Port error: ${err.message}`);
      fail(`Eroare port serial: ${err.message}`);
    });

    port.on('close', () => {
      if (!finished) fail('Port serial închis neașteptat');
    });

    // Timeout global 10 minute
    const globalTimeout = setTimeout(() => fail('Timeout global 10min'), 600000);
    port.once('close', () => clearTimeout(globalTimeout));

    // ── Pornire ──────────────────────────────────────────────────────────
    port.open((err) => {
      if (err) return fail(`Nu pot deschide portul serial: ${err.message}`);
      log(`Port deschis: ${portPath} @ ${BAUD_RATE} baud (8-N-1)`);
      log(`Sumă: ${amount.toFixed(2)} RON (${cents} bani)`);
      // Pasul 1: LOGIN (06 00 00) — apoi SALE
      ecrSend(LOGIN_FRAME, 'LOGIN', 'LOGIN', 3000);
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function start() {
  const portPath = (COM_PORT && COM_PORT !== 'auto') ? COM_PORT : await detectPosPort();
  const socket = ioClient(RENDER_URL, { auth: { bridgeKey: BRIDGE_KEY, locationId: LOCATION_ID } });

  log('════════════════════════════════════════════');
  log('POS Bridge pornit (Printec ECR v3.9.3)');
  log(`Port din config: ${COM_PORT}`);
  log(`Render:    ${RENDER_URL}`);
  log(`COM Port:  ${portPath} @ ${BAUD_RATE} baud (8-N-1)`);
  log(`Locație:   ${LOCATION_ID}`);
  log(`Log:       ${LOG_FILE}`);

  socket.on('connect', () => {
    log(`✅ Conectat la Render (${socket.id})`);
    socket.emit('pos_bridge_register', { locationId: LOCATION_ID, port: portPath });
  });

  socket.on('disconnect', (reason) => {
    log(`⚠ Deconectat: ${reason}`);
  });

  socket.on('pos_payment_request', async (data) => {
    log('════════════════════════════════════════════');
    log('==== AM PRIMIT CEREREA DE LA KIOSK ====');
    const { orderId, amount, locationId: lid } = data;

    if (lid && lid !== LOCATION_ID) {
      log(`⏭ Ignorat — locație diferită (${lid} vs ${LOCATION_ID})`);
      return;
    }

    log(`💳 Inițiez plata: ${amount} RON | Order: ${orderId}`);
    socket.emit('pos_bridge_status', { orderId, message: 'Se trimite la POS...' });

    try {
      const res = await processPrintecPayment(amount, portPath, (msg) => {
        log(`📡 Status → Kiosk: ${msg}`);
        socket.emit('pos_bridge_status', { orderId, message: msg });
      });

      log(`Rezultat final: success=${res.success} code=${res.code} auth=${res.authCode}`);
      socket.emit('pos_payment_result', {
        orderId,
        locationId: LOCATION_ID,
        amount,
        paid: res.success,
        responseCode: res.code,
        authCode: res.authCode,
        refNum: res.refNum,
        cardNo: res.cardNo,
        txDate: res.txDate,
        error: res.success ? undefined : (res.reason || `Plată refuzată (cod: ${res.code})`),
      });
    } catch (err) {
      log(`❌ EROARE: ${err.message}`);
      socket.emit('pos_payment_result', { orderId, locationId: LOCATION_ID, amount, paid: false, error: err.message });
    }
  });

  socket.on('print_ticket', async ({ order }) => {
    log('════════════════════════════════════════════');
    log(`==== PRINT TICKET COMANDA #${order?.orderNumber} ====`);
    if (!order) return;
    try {
      await printTicket(order);
    } catch (err) {
      log(`❌ Eroare la printare tichet: ${err.message}`);
    }
  });
}

start();
