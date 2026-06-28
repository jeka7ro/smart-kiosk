/**
 * Printec ECR Protocol v3.9.3 — IMPLEMENTARE CORECTĂ
 * VeriFone V200t / Raiffeisen România
 *
 * APPENDIX C — Parametri seriali:
 *   Speed:        9600 bps
 *   Data bits:    8
 *   Parity:       None
 *   Stop bits:    1
 *   Flow control: None
 *
 * Frame format (NU STX...ETX ci DLE STX...DLE ETX !):
 *   DLE(0x10) STX(0x02) <COMMAND> DLE(0x10) ETX(0x03) LRC
 *
 * LRC = XOR doar pe COMMAND bytes (fără DLE STX / DLE ETX)
 *
 * Flow SALE:
 *   1. ECR→POS: ENQ
 *   2. POS→ECR: ACK
 *   3. ECR→POS: DLE STX 06 00 00 DLE ETX LRC  (LOGIN)
 *   4. POS→ECR: ACK
 *   5. ECR→POS: EOT
 *   6. POS→ECR: ENQ
 *   7. ECR→POS: ACK
 *   8. POS→ECR: DLE STX 80/84 XX 00 DLE ETX LRC  (LOGIN response)
 *   9. ECR→POS: ACK
 *  10. ECR→POS: EOT
 *  11. ECR→POS: ENQ
 *  12. POS→ECR: ACK
 *  13. ECR→POS: DLE STX 06 01 15 <amount12><'000'><'000000'> DLE ETX LRC (SALE)
 *  14. POS→ECR: ACK
 *  15. ECR→POS: EOT
 *  --- POS procesează tranzacția ---
 *  ... eventual 05 01 00 (PinEntry) și 05 02 00 (BeginAuth) ...
 *  16. POS→ECR: ENQ
 *  17. ECR→POS: ACK
 *  18. POS→ECR: DLE STX 06 0F XX <result data> DLE ETX LRC  (Authorization End)
 *  19. ECR→POS: ACK
 *  20. ECR→POS: EOT  → DONE
 */

const { SerialPort } = require('serialport');

const PORT   = '/dev/cu.usbserial-FTF2NAV8';
const BAUD   = 9600;
const AMOUNT = parseFloat(process.argv[2]) || 1.00;

// Control characters
const DLE = 0x10;
const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;
const EOT = 0x04;
const ENQ = 0x05;
const FS  = 0x1C;

// ─── Frame helpers ────────────────────────────────────────────────────────────

/** LRC = XOR de toți octeții din command (fără DLE STX și DLE ETX) */
function calcLRC(cmdBytes) {
  let b = 0;
  for (const byte of cmdBytes) b ^= byte;
  return b;
}

/**
 * Construiește un frame Printec complet:
 * DLE STX <cmdBytes> DLE ETX LRC
 * @param {number[]} cmdBytes - array de bytes ai comenzii
 */
function buildFrame(cmdBytes) {
  const lrc = calcLRC(cmdBytes);
  return Buffer.from([DLE, STX, ...cmdBytes, DLE, ETX, lrc]);
}

// ─── Comenzi ECR → POS ────────────────────────────────────────────────────────

/** LOGIN: KLASSE=06, INST=00, DLNG=00 */
const LOGIN_FRAME = buildFrame([0x06, 0x00, 0x00]);

/** LOGOUT: KLASSE=06, INST=02, DLNG=00 */
const LOGOUT_FRAME = buildFrame([0x06, 0x02, 0x00]);

/**
 * SALE: KLASSE=06, INST=01, DLNG=21(0x15)
 * Data: Amount(12) + ArticleCode(3='000') + Quantity(6='000000')
 */
function buildSale(amountRon) {
  const cents  = Math.round(amountRon * 100);
  const amtStr = String(cents).padStart(12, '0');
  // Command bytes: 06 01 15 + amount(12) + '000'(3) + '000000'(6)
  const dataStr = amtStr + '000' + '000000'; // 21 bytes
  const dataBytes = [...Buffer.from(dataStr, 'ascii')];
  return buildFrame([0x06, 0x01, 0x15, ...dataBytes]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function interp(b) {
  const n = {0x02:'<STX>',0x03:'<ETX>',0x04:'<EOT>',0x05:'<ENQ>',
             0x06:'<ACK>',0x10:'<DLE>',0x15:'<NAK>',0x1C:'<FS>'};
  return n[b] || (b >= 32 && b < 127 ? String.fromCharCode(b) : `<${b.toString(16).toUpperCase().padStart(2,'0')}>`);
}
function hexLine(buf) {
  return [...buf].map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ')
       + '  →  ' + [...buf].map(interp).join(' ');
}
function ts() { return new Date().toISOString().slice(11,23); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

// ─── Protocol State Machine ───────────────────────────────────────────────────

const port = new SerialPort({ path:PORT, baudRate:BAUD, dataBits:8, parity:'none', stopBits:1, autoOpen:false });
let rxBuf   = Buffer.alloc(0);
let state   = 'IDLE';
let done    = false;
let stateTimer;

function setState(s) {
  state = s;
  log(`  ─ State: ${s}`);
}

function cleanup(success) {
  done = true;
  clearTimeout(stateTimer);
  setTimeout(() => { if (port.isOpen) port.close(); }, 300);
  if (success) log('\n🎉 Tranzacție completă!');
}

function timeout(msg, ms = 5000) {
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    log(`⏱ TIMEOUT (${msg})`);
    port.write(Buffer.from([EOT]));
    cleanup(false);
  }, ms);
}

// ─── Message Exchange Helpers ─────────────────────────────────────────────────

/** ECR inițiază un schimb: ENQ → aștept ACK → trimit frame → ACK → EOT */
function ecrInitiate(frameToSend, nextState, label) {
  log(`\n📤 [ECR→POS] ENQ (inițiere: ${label})`);
  port.write(Buffer.from([ENQ]));
  setState(`WAIT_ACK_FOR_ENQ_${nextState}`);
  timeout(`ACK la ENQ (${label})`, 2000);
  // stocăm frame-ul de trimis
  port._pendingFrame = frameToSend;
  port._nextState    = nextState;
  port._label        = label;
}

/** ECR răspunde la ENQ primit de la POS */
function ecrRespondToENQ() {
  log(`📤 [ECR→POS] ACK (răspuns la ENQ de la POS)`);
  port.write(Buffer.from([ACK]));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Printec ECR v3.9.3 — VeriFone V200t / Raiffeisen România');
console.log(`  Port: ${PORT}  Baud: ${BAUD}  8N1`);
console.log(`  Sumă: ${AMOUNT.toFixed(2)} RON`);
console.log('═══════════════════════════════════════════════════════════════\n');

log('Frame-uri:');
log(`  LOGIN:  ${hexLine(LOGIN_FRAME)}`);
const saleFrame = buildSale(AMOUNT);
log(`  SALE:   ${hexLine(saleFrame)}`);
log('');

port.open(err => {
  if (err) { console.error('❌', err.message); process.exit(1); }
  log(`✅ Port deschis: ${PORT} @ ${BAUD} 8N1\n`);

  // PASUL 1: Trimitere LOGIN
  ecrInitiate(LOGIN_FRAME, 'LOGIN', 'LOGIN');
});

port.on('data', chunk => {
  if (done) return;
  rxBuf = Buffer.concat([rxBuf, chunk]);
  log(`📥 ${hexLine(chunk)}`);

  // Procesăm byte cu byte
  while (rxBuf.length > 0 && !done) {
    const b = rxBuf[0];

    // ─── ACK de la POS după ENQ-ul nostru ─────────────────────────────────
    if (b === ACK && state.startsWith('WAIT_ACK_FOR_ENQ_')) {
      rxBuf = rxBuf.subarray(1);
      clearTimeout(stateTimer);
      const frame = port._pendingFrame;
      const ns    = port._nextState;
      const lbl   = port._label;
      log(`✅ POS a acceptat ENQ (${lbl}). Trimit frame...`);
      log(`📤 [ECR→POS] ${hexLine(frame)}`);
      port.write(frame, () => {
        // Aștept ACK la frame
        setState(`WAIT_ACK_FOR_FRAME_${ns}`);
        timeout(`ACK la frame (${lbl})`, 2000);
      });
      break;
    }

    // ─── ACK de la POS după frame-ul nostru ───────────────────────────────
    if (b === ACK && state.startsWith('WAIT_ACK_FOR_FRAME_')) {
      rxBuf = rxBuf.subarray(1);
      clearTimeout(stateTimer);
      const ns = state.replace('WAIT_ACK_FOR_FRAME_', '');

      if (ns === 'LOGIN') {
        log(`✅ POS a confirmat LOGIN frame. Trimit EOT...`);
        port.write(Buffer.from([EOT]));
        setState('WAIT_LOGIN_RESPONSE_ENQ');
        timeout('ENQ de la POS (răspuns LOGIN)', 10000);

      } else if (ns === 'SALE') {
        log(`✅ POS a confirmat SALE frame. Trimit EOT. Aștept card...`);
        port.write(Buffer.from([EOT]));
        setState('WAIT_CARD_OR_RESULT');
        timeout('rezultat tranzacție', 120000); // 2 min pentru card

      } else if (ns === 'FINAL_ACK') {
        log(`✅ ECR a confirmat rezultatul final. Trimit EOT.`);
        port.write(Buffer.from([EOT]));
        cleanup(true);
      }
      break;
    }

    // ─── NAK ──────────────────────────────────────────────────────────────
    if (b === NAK) {
      rxBuf = rxBuf.subarray(1);
      log('⚠️ NAK primit — LRC greșit?');
      break;
    }

    // ─── EOT ──────────────────────────────────────────────────────────────
    if (b === EOT) {
      rxBuf = rxBuf.subarray(1);
      log('📥 EOT de la POS');
      break;
    }

    // ─── ENQ de la POS (POS inițiează schimb) ─────────────────────────────
    if (b === ENQ) {
      rxBuf = rxBuf.subarray(1);
      clearTimeout(stateTimer);
      log(`📥 [POS→ECR] ENQ (state=${state})`);

      if (state === 'WAIT_LOGIN_RESPONSE_ENQ') {
        ecrRespondToENQ();
        setState('WAIT_LOGIN_RESPONSE_FRAME');
        timeout('frame LOGIN response', 3000);

      } else if (state === 'WAIT_CARD_OR_RESULT') {
        ecrRespondToENQ();
        setState('WAIT_POS_FRAME');
        timeout('card/rezultat (2min)', 120000); // 2 minute pentru card
      }
      break;
    }

    // ─── Frame DLE STX ... DLE ETX de la POS ──────────────────────────────
    if (b === DLE) {
      // Caută DLE STX la offset 0
      if (rxBuf.length >= 2 && rxBuf[1] === STX) {
        // Caută DLE ETX
        let frameEnd = -1;
        for (let i = 2; i < rxBuf.length - 1; i++) {
          if (rxBuf[i] === DLE && rxBuf[i+1] === ETX && rxBuf.length > i + 2) {
            frameEnd = i + 2; // inclusiv LRC
            break;
          }
        }
        if (frameEnd < 0) break; // frame incomplet

        const cmdBytes = rxBuf.subarray(2, frameEnd - 2); // între DLE STX și DLE ETX
        const receivedLRC = rxBuf[frameEnd];
        const calcedLRC   = calcLRC(cmdBytes);
        rxBuf = rxBuf.subarray(frameEnd + 1);

        log(`📦 Frame primit: CMD=${hexLine(cmdBytes)}`);
        log(`   LRC primit=0x${receivedLRC.toString(16).toUpperCase()} calc=0x${calcedLRC.toString(16).toUpperCase()} ${receivedLRC===calcedLRC?'✅':'❌ MISMATCH'}`);

        // Trimite ACK sau NAK
        if (receivedLRC === calcedLRC) {
          port.write(Buffer.from([ACK]));
          log('📤 ACK trimis la POS');
        } else {
          port.write(Buffer.from([NAK]));
          log('📤 NAK trimis (LRC greșit)');
          break;
        }

        // Interpretare comandă
        const klasse = cmdBytes[0];
        const instr  = cmdBytes[1];
        const dlng   = cmdBytes[2];
        const data   = cmdBytes.subarray(3);

        if (klasse === 0x80 || klasse === 0x84) {
          // Răspuns de la POS
          const aprw = cmdBytes[1];
          const ok   = (klasse === 0x80) || (klasse === 0x84 && aprw === 0x00);
          log(`  → Răspuns POS: KKRW=0x${klasse.toString(16).toUpperCase()} APRW=0x${aprw.toString(16).toUpperCase()} → ${ok ? '✅ OK' : '❌ EROARE (cod=' + aprw + ')'}`);

          // Dacă suntem în WAIT_POS_FRAME (după SALE) = POS a confirmat SALE, acum aşteaptă cardul
          if (state === 'WAIT_POS_FRAME') {
            log('  → SALE confirmat de POS. Terminal aşteaptă card (2min)...');
            port.write(Buffer.from([EOT]));
            setState('WAIT_CARD_OR_RESULT');
            timeout('card/rezultat (2min)', 120000);
            break;
          }

          if (state === 'WAIT_LOGIN_RESPONSE_FRAME') {
            port.write(Buffer.from([EOT]));
            if (ok) {
              log('✅ LOGIN reușit! Inițiez SALE...');
              setTimeout(() => ecrInitiate(saleFrame, 'SALE', 'SALE'), 1000);
            } else {
              log('❌ LOGIN eșuat!'); cleanup(false);
            }
          }

        } else if (klasse === 0x06 && instr === 0x0F) {
          // Authorization End — rezultatul final
          log('\n══════════════════════════════════════════════');
          log('  REZULTAT FINAL TRANZACȚIE');
          log('══════════════════════════════════════════════');
          // Parse Appendix B fields
          const str = data.toString('ascii');
          const xx  = data[0]; // length
          const payload = data.subarray(1);
          log(`  Raw data: ${hexLine(payload)}`);

          // Câmpuri fixe
          const refNum    = payload.subarray(0, 12).toString('ascii');
          const termId    = payload.subarray(12, 20).toString('ascii');
          const txDate    = payload.subarray(20, 32).toString('ascii');
          const amount    = payload.subarray(32, 44).toString('ascii');
          const currency  = payload.subarray(44, 47).toString('ascii');
          const authCode  = payload.subarray(47, 53).toString('ascii');
          const respCode  = payload.subarray(53, 57).toString('ascii');
          
          // Câmpuri variabile separate prin FS
          const varPart   = payload.subarray(57).toString('ascii');
          const varFields = varPart.split(String.fromCharCode(FS));

          log(`  Ref Number:   "${refNum}"`);
          log(`  Terminal ID:  "${termId}"`);
          log(`  Date/Time:    "${txDate}"`);
          log(`  Amount:       "${amount}" ${currency}`);
          log(`  Auth Code:    "${authCode}"`);
          log(`  Resp Code:    "${respCode}" → ${respCode.trim() === '0000' ? '✅ APROBAT' : '❌ REFUZAT'}`);
          if (varFields[0]) log(`  Resp Text:    "${varFields[0]}"`);
          if (varFields[1]) log(`  Card No:      "${varFields[1]}"`);
          if (varFields[2]) log(`  Cardholder:   "${varFields[2]}"`);
          if (varFields[3]) log(`  Pin/Receipt:  "${varFields[3]}"`);
          log('══════════════════════════════════════════════\n');

          port.write(Buffer.from([EOT]));
          cleanup(respCode.trim() === '0000');

        } else if (klasse === 0x06 && instr === 0x1E) {
          // Refusal
          log(`❌ REFUZ de la POS (cod eroare: 0x${data[0].toString(16).toUpperCase()})`);
          port.write(Buffer.from([EOT]));
          cleanup(false);

        } else if (klasse === 0x05 && instr === 0x01) {
          // PIN Entry notification
          log('🔒 POS: Client introduce PIN-ul...');
          port.write(Buffer.from([EOT]));
          setState('WAIT_CARD_OR_RESULT');
          timeout('rezultat după PIN', 120000);

        } else if (klasse === 0x05 && instr === 0x02) {
          // Begin Auth notification
          log('🌐 POS: Comunicare cu banca...');
          port.write(Buffer.from([EOT]));
          setState('WAIT_CARD_OR_RESULT');
          timeout('rezultat după auth', 120000);

        } else {
          log(`  Frame necunoscut: klasse=0x${klasse.toString(16)} instr=0x${instr.toString(16)}`);
          port.write(Buffer.from([EOT]));
        }
        break;
      }
    }

    // Byte necunoscut — skip
    rxBuf = rxBuf.subarray(1);
  }
});

port.on('error', err => { log(`❌ Port error: ${err.message}`); cleanup(false); });
port.on('close', () => { log('Port închis.'); clearTimeout(stateTimer); });

// Timeout global 10 minute
setTimeout(() => { log('Timeout global 10min'); cleanup(false); }, 600000);
