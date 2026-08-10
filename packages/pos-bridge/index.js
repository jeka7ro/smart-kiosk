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

const DLE = 0x10;
const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;
const EOT = 0x04;
const ENQ = 0x05;
const FS  = 0x1C;

let globalPort = null;
let currentTransactionResolve = null;
let currentTransactionTimer = null;
let rxBuf = Buffer.alloc(0);
let state = 'IDLE';
let enqRetries = 0;
let pendingFrame = null;
let nextState = null;
let currentLabel = null;

function calcLRC(cmdBytes) {
  let b = 0;
  for (const byte of cmdBytes) b ^= byte;
  return b;
}

function buildFrame(cmdBytes) {
  const lrc = calcLRC(cmdBytes);
  return Buffer.from([DLE, STX, ...cmdBytes, DLE, ETX, lrc]);
}

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
      break;
    }
  }
  return null;
}

async function detectPosPort() {
  const ports = await SerialPort.list();
  const firstCom = ports.find(p => p.path.startsWith('COM') && !p.path.includes('BT'));
  return firstCom ? firstCom.path : 'COM3';
}

function ecrSend(frame, ns, label, timeoutMs = 3000) {
  if (enqRetries === 0) {
    const hexStr = [...frame].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    log(`📤 Frame pregătit [${frame.length} bytes]: ${hexStr}`);
  }
  log(`📤 ENQ → (${label}) [Încercare ${enqRetries + 1}/3]`);
  
  globalPort.write(Buffer.from([ENQ]));
  state = `WAIT_ENQ_ACK__${ns}`;
  pendingFrame = frame;
  nextState    = ns;
  currentLabel = label;
  
  clearTimeout(currentTransactionTimer);
  currentTransactionTimer = setTimeout(() => {
    enqRetries++;
    if (enqRetries < 3) {
      log(`⚠️ Timeout ACK la ENQ. Reîncercăm (${enqRetries}/3)...`);
      ecrSend(frame, ns, label, timeoutMs);
    } else {
      enqRetries = 0;
      if (currentTransactionResolve) {
        currentTransactionResolve({ success: false, reason: 'POS-ul nu răspunde (Timeout).', code: 'DECLINED' });
      }
    }
  }, timeoutMs);
}

function processPrintecPayment(amount, onStatus) {
  return new Promise((resolve) => {
    if (!globalPort || !globalPort.isOpen) {
       return resolve({ success: false, reason: 'Portul POS nu este deschis', code: 'DECLINED' });
    }
    if (state !== 'IDLE') {
       return resolve({ success: false, reason: 'O tranzacție este deja în curs', code: 'DECLINED' });
    }

    rxBuf = Buffer.alloc(0);
    enqRetries = 0;
    
    currentTransactionResolve = (res) => {
      clearTimeout(currentTransactionTimer);
      // Wait a bit to ensure EOTs are drained to POS before marking IDLE
      globalPort.drain(() => {
        state = 'IDLE';
        currentTransactionResolve = null;
        resolve(res);
      });
    };

    const succeed = (result) => {
      if (currentTransactionResolve) currentTransactionResolve(result);
    };

    const fail = (msg) => {
      if (currentTransactionResolve) {
        clearTimeout(currentTransactionTimer);
        globalPort.drain(() => {
          state = 'IDLE';
          currentTransactionResolve({ success: false, reason: msg, code: 'DECLINED' });
          currentTransactionResolve = null;
        });
      }
    };

    const cents   = Math.round(amount * 100);
    const amtStr  = String(cents).padStart(12, '0');
    const saleCmd = [0x06, 0x01, 0x15, ...Buffer.from(amtStr + '000' + '000000', 'ascii')];
    const SALE_FRAME = buildFrame(saleCmd);

    log(`Sumă: ${amount.toFixed(2)} RON (${cents} bani)`);
    log('📤 Trimit EOT pentru WakeUp/Cancel POS...');
    globalPort.write(Buffer.from([EOT]));
    
    // Assign status callback to global port so data handler can use it
    globalPort.currentStatusCallback = onStatus;
    globalPort.currentSucceed = succeed;
    globalPort.currentFail = fail;
    globalPort.currentSALE_FRAME = SALE_FRAME;

    setTimeout(() => {
      ecrSend(buildFrame([0x06, 0x00, 0x00]), 'LOGIN', 'LOGIN', 5000);
    }, 500);
  });
}

async function start() {
  const portPath = (COM_PORT && COM_PORT !== 'auto') ? COM_PORT : await detectPosPort();
  const socket = ioClient(RENDER_URL, { auth: { bridgeKey: BRIDGE_KEY, locationId: LOCATION_ID } });

  log('════════════════════════════════════════════');
  log('Bridge v7.0 (Curat - fara auto-settlement)');
  log(`Port din config: ${COM_PORT}`);
  log(`Render:    ${RENDER_URL}`);
  log(`COM Port:  ${portPath} @ ${BAUD_RATE} baud (8-N-1)`);
  log(`Locație:   ${LOCATION_ID}`);
  log('════════════════════════════════════════════');

  socket.on('connect', () => {
    log(`✅ Conectat la Render (${socket.id})`);
    socket.emit('pos_bridge_register', { locationId: LOCATION_ID, port: portPath });
  });

  socket.on('disconnect', (reason) => {
    log(`⚠ Deconectat: ${reason}`);
  });

  globalPort = new SerialPort({
    path: portPath, baudRate: BAUD_RATE,
    dataBits: 8, parity: 'none', stopBits: 1, autoOpen: true,
  });

  globalPort.on('open', () => {
    log(`✅ Port serial deschis global: ${portPath} @ ${BAUD_RATE}`);
  });

  globalPort.on('error', err => {
    log(`❌ Eroare port serial: ${err.message}`);
    if (currentTransactionResolve) {
      currentTransactionResolve({ success: false, reason: err.message, code: 'DECLINED' });
    }
  });

  globalPort.on('data', (chunk) => {
    if (state === 'IDLE') return; // Ignore data outside transaction

    const hexStr = [...chunk].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    log(`📥 RAW RX [${chunk.length} bytes]: ${hexStr}`);
    rxBuf = Buffer.concat([rxBuf, chunk]);

    const succeed = globalPort.currentSucceed;
    const fail = globalPort.currentFail;
    const onStatus = globalPort.currentStatusCallback;
    const SALE_FRAME = globalPort.currentSALE_FRAME;

    while (rxBuf.length > 0) {
      const b = rxBuf[0];

      if (b === ACK && state.startsWith('WAIT_ENQ_ACK__')) {
        rxBuf = rxBuf.subarray(1);
        clearTimeout(currentTransactionTimer);
        enqRetries = 0;
        
        log(`✅ ACK ← POS la ENQ (${currentLabel}). Trimit frame...`);
        globalPort.write(pendingFrame);
        state = `WAIT_FRAME_ACK__${nextState}`;
        
        currentTransactionTimer = setTimeout(() => fail(`Timeout ACK la frame (${currentLabel})`), 3000);
        break;
      }

      if (b === ACK && state.startsWith('WAIT_FRAME_ACK__')) {
        rxBuf = rxBuf.subarray(1);
        clearTimeout(currentTransactionTimer);
        const ns = state.replace('WAIT_FRAME_ACK__', '');

        if (ns === 'LOGIN') {
          log('✅ LOGIN frame acceptat → EOT');
          globalPort.write(Buffer.from([EOT]));
          state = 'WAIT_POS_ENQ__LOGIN_RESP';
          currentTransactionTimer = setTimeout(() => fail('Timeout ENQ răspuns LOGIN'), 5000);
        } else if (ns === 'SALE') {
          log('✅ SALE frame acceptat → EOT. Aștept card (2min)...');
          onStatus && onStatus('Terminal activat — apropiați cardul');
          globalPort.write(Buffer.from([EOT]));
          state = 'WAIT_POS_ENQ__RESULT';
          currentTransactionTimer = setTimeout(() => fail('Timeout card/rezultat tranzacție'), 120000);
        } else if (ns === 'SETTLEMENT') {
          log('✅ SETTLEMENT frame acceptat → EOT. Aștept răspuns...');
          globalPort.write(Buffer.from([EOT]));
          state = 'WAIT_POS_ENQ__SETTLEMENT_RESP';
          currentTransactionTimer = setTimeout(() => fail('Timeout settlement'), 120000);
        } else if (ns === 'FINAL_ACK') {
          log('✅ Rezultat confirmat → EOT → Done');
          globalPort.write(Buffer.from([EOT]));
          // Wait for POS to clear before next transaction
          setTimeout(() => succeed({ success: true }), 100);
        }
        break;
      }

      if (b === NAK) {
        rxBuf = rxBuf.subarray(1);
        log('⚠ NAK primit');
        break;
      }

      if (b === EOT) {
        rxBuf = rxBuf.subarray(1);
        log('📥 EOT ← POS');
        break;
      }

      if (b === ENQ) {
        rxBuf = rxBuf.subarray(1);
        clearTimeout(currentTransactionTimer);
        log(`📥 ENQ ← POS (state=${state})`);
        globalPort.write(Buffer.from([ACK]));

        if (state === 'WAIT_POS_ENQ__LOGIN_RESP') {
          state = 'WAIT_POS_FRAME__LOGIN_RESP';
          currentTransactionTimer = setTimeout(() => fail('Timeout frame LOGIN response'), 3000);
        } else if (state === 'WAIT_POS_ENQ__RESULT') {
          state = 'WAIT_POS_FRAME__RESULT';
          currentTransactionTimer = setTimeout(() => fail('Timeout frame rezultat'), 5000);
        } else if (state === 'WAIT_POS_ENQ__SETTLEMENT_RESP') {
          state = 'WAIT_POS_FRAME__SETTLEMENT_RESP';
          currentTransactionTimer = setTimeout(() => fail('Timeout frame settlement'), 5000);
        }
        break;
      }

      if (b === DLE && rxBuf.length >= 2 && rxBuf[1] === STX) {
        const extracted = extractFrame(rxBuf);
        if (!extracted) break; // incomplete

        const { cmdBytes, lrcByte, frameEnd } = extracted;
        rxBuf = rxBuf.subarray(frameEnd);
        clearTimeout(currentTransactionTimer);

        const calcedLRC = calcLRC(cmdBytes);
        if (lrcByte !== calcedLRC) {
          log(`⚠ LRC mismatch!`);
          globalPort.write(Buffer.from([NAK]));
          break;
        }

        globalPort.write(Buffer.from([ACK]));

        const klasse = cmdBytes[0];
        const instr  = cmdBytes[1];
        const data   = cmdBytes.subarray(3);

        log(`📥 Frame: klasse=0x${klasse.toString(16)} instr=0x${instr.toString(16)}`);

        if ((klasse === 0x80 || klasse === 0x84) && state === 'WAIT_POS_FRAME__LOGIN_RESP') {
          const ok = (klasse === 0x80) || (klasse === 0x84 && instr === 0x00);
          if (ok) {
            log('✅ LOGIN OK → EOT → inițiez SALE');
            globalPort.write(Buffer.from([EOT]));
            setTimeout(() => ecrSend(SALE_FRAME, 'SALE', 'SALE', 3000), 1000);
          } else {
            fail(`LOGIN refuzat de POS (APRW=0x${instr.toString(16)})`);
          }
          break;
        }

        if ((klasse === 0x80 || klasse === 0x84) && state === 'WAIT_POS_FRAME__SETTLEMENT_RESP') {
          log('✅ SETTLEMENT OK → EOT → Finalizat');
          globalPort.write(Buffer.from([EOT]));
          setTimeout(() => succeed({ success: true, reason: 'Settlement OK' }), 100);
          break;
        }

        if (klasse === 0x05 && instr === 0x01) {
          log('📥 PIN Entry — clientul introduce PIN-ul');
          onStatus && onStatus('Introduceți PIN-ul');
          state = 'WAIT_POS_ENQ__RESULT';
          currentTransactionTimer = setTimeout(() => fail('Timeout rezultat după PIN'), 120000);
          break;
        }

        if (klasse === 0x05 && instr === 0x02) {
          log('📥 Begin Auth — comunicare cu banca');
          onStatus && onStatus('Comunicare cu banca...');
          state = 'WAIT_POS_ENQ__RESULT';
          currentTransactionTimer = setTimeout(() => fail('Timeout rezultat după auth'), 120000);
          break;
        }

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
          const cardNo    = (varFields[1] || '').trim();

          const approved = respCode === '0000';
          log(`📥 Auth End: Code=${respCode} Auth=${authCode} Card=${cardNo}`);

          globalPort.write(Buffer.from([EOT]));
          succeed({
            success: approved, code: respCode, authCode, refNum,
            txDate, amount: amtField, currency, termId, cardNo,
            raw: payload.toString('hex'),
          });
          break;
        }

        if (klasse === 0x06 && instr === 0x1E) {
          const errCode = data[0];
          log(`❌ Refusal de la POS, cod=0x${errCode.toString(16)}`);
          
          let explicitReason = `Tranzacție refuzată (Cod: 0x${errCode.toString(16).toUpperCase()})`;
          if (errCode === 0xA0) explicitReason = 'POS-ul trebuie resetat manual sau Închidere de Zi.';

          succeed({ success: false, code: errCode.toString(16).toUpperCase(), authCode: '', refNum: '', reason: explicitReason });
          break;
        }

        log(`📥 Frame necunoscut: klasse=0x${klasse.toString(16)}`);
        state = 'WAIT_POS_ENQ__RESULT';
        currentTransactionTimer = setTimeout(() => fail('Timeout rezultat necunoscut'), 120000);
        break;
      }

      if (b === DLE) break;

      rxBuf = rxBuf.subarray(1);
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
    log(`💳 ==== CERERE PLATĂ ==== orderId: ${orderId} | amount: ${amount} RON`);
    
    socket.emit('pos_bridge_status', { orderId, message: 'Inițiez plata...' });

    try {
      const res = await processPrintecPayment(amount, (msg) => {
        log(`STATUS: ${msg}`);
        socket.emit('pos_bridge_status', { orderId, message: msg });
      });
      
      log(`✅ REZULTAT: ${res.success ? 'APROBAT' : 'REFUZAT'} auth=${res.authCode}`);
      
      socket.emit('pos_payment_result', { 
        orderId, 
        locationId: lid || LOCATION_ID,
        amount,
        paid: res.success, 
        authCode: res.authCode,
        refNum: res.refNum,
        cardNo: res.cardNo,
        txDate: res.txDate,
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

  socket.on('print_ticket', async (order) => {
    if (order && (order.locationId === LOCATION_ID || !order.locationId)) {
      log(`🖨️  Cerere printare bon pentru comanda #${order.orderNumber}`);
      await printTicket(order);
    }
  });

  // Remote Settlement / End of Day - clears POS memory (fixes 0xA0 error)
  socket.on('pos_settlement', async (data) => {
    const { locationId: lid } = data || {};
    if (lid && lid !== LOCATION_ID) return;

    if (paymentInProgress || state !== 'IDLE') {
      log('⚠️ Nu pot face Settlement, altă operație în curs');
      socket.emit('pos_settlement_result', { success: false, error: 'Altă operație în curs' });
      return;
    }

    log('🔄 ==== SETTLEMENT / ÎNCHIDERE DE ZI ====');
    paymentInProgress = true;

    try {
      const result = await new Promise((resolve) => {
        rxBuf = Buffer.alloc(0);
        enqRetries = 0;

        currentTransactionResolve = (res) => {
          clearTimeout(currentTransactionTimer);
          globalPort.drain(() => {
            state = 'IDLE';
            currentTransactionResolve = null;
            resolve(res);
          });
        };

        globalPort.currentSucceed = (r) => { if (currentTransactionResolve) currentTransactionResolve(r); };
        globalPort.currentFail = (msg) => {
          if (currentTransactionResolve) {
            clearTimeout(currentTransactionTimer);
            globalPort.drain(() => {
              state = 'IDLE';
              currentTransactionResolve({ success: false, reason: msg, code: 'DECLINED' });
              currentTransactionResolve = null;
            });
          }
        };
        globalPort.currentStatusCallback = null;
        globalPort.currentSALE_FRAME = null;

        // Settlement command: class 0x06, instruction 0x50
        const settlementCmd = [0x06, 0x50, 0x00];
        const SETTLE_FRAME = buildFrame(settlementCmd);

        log('📤 Trimit EOT pentru WakeUp...');
        globalPort.write(Buffer.from([EOT]));

        setTimeout(() => {
          log('📤 Trimit Settlement frame...');
          ecrSend(SETTLE_FRAME, 'SETTLEMENT', 'SETTLEMENT', 10000);
        }, 500);

        // Long timeout for settlement (can take up to 2 minutes)
        setTimeout(() => {
          if (currentTransactionResolve) {
            currentTransactionResolve({ success: true, reason: 'Settlement trimis (timeout normal)' });
          }
        }, 120000);
      });

      log(`🔄 Settlement result: ${JSON.stringify(result)}`);
      socket.emit('pos_settlement_result', { success: true, result });
    } catch (err) {
      log(`❌ Settlement error: ${err.message}`);
      socket.emit('pos_settlement_result', { success: false, error: err.message });
    } finally {
      paymentInProgress = false;
    }
  });
}

start().catch(err => {
  log(`❌ EROARE FATALĂ: ${err.message}`);
  process.exit(1);
});
