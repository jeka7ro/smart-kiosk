/**
 * Test POS VeriFone V200t — Protocol MOL ECR corect
 * Parametri CORECTI conform documentatia Hypercom T7/FIP11 v1.06:
 *   Baud:   9600
 *   Data:   7 bits  ← ERA GREȘIT 8!
 *   Parity: Even    ← ERA GREȘIT None!
 *   Stop:   1
 *
 * Flow:
 *   ECR → POS: MOL10.<amount 12 digits>  (Initiate Transaction)
 *   POS → ECR: ACK
 *   POS → ECR: MOL11.                    (Initiate Response)
 *   ECR → POS: ACK
 *   POS → ECR: MOL12.<RC><PAN><FS><...>  (Authorization Result)
 *   ECR → POS: ACK
 *   ECR → POS: MOL13.                    (Authorization Acknowledgment)
 *   POS → ECR: ACK
 */
const { SerialPort } = require('serialport');

const PORT = '/dev/cu.usbserial-FTF2NAV8';
const BAUD = 9600;
const AMOUNT = parseFloat(process.argv[2]) || 1.00;

const STX=0x02, ETX=0x03, ACK=0x06, NAK=0x15, EOT=0x04, FS=0x1C;

function lrc(buf) {
  let x = 0;
  for (let i = 1; i < buf.length - 1; i++) x ^= buf[i];
  return x;
}

function frame(payload) {
  const p = Buffer.from(payload, 'ascii');
  const f = Buffer.alloc(p.length + 3);
  f[0] = STX; p.copy(f, 1); f[f.length-2] = ETX; f[f.length-1] = lrc(f);
  return f;
}

function interp(b) {
  const n={0x02:'<STX>',0x03:'<ETX>',0x04:'<EOT>',0x05:'<ENQ>',0x06:'<ACK>',0x15:'<NAK>',0x1C:'<FS>'};
  return n[b]||(b>=32&&b<127?String.fromCharCode(b):`<${b.toString(16).toUpperCase().padStart(2,'0')}>`);
}

function ts() { return new Date().toISOString().slice(11,23); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

const cents = Math.round(AMOUNT * 100);
const amtStr = String(cents).padStart(12, '0');
const MOL10 = frame(`MOL10.${amtStr}`);
const MOL13 = frame('MOL13.');

console.log('═══════════════════════════════════════════════════════════');
console.log('  MOL ECR Protocol — VeriFone V200t / Raiffeisen');
console.log('  Parametri: 9600 baud, 7 data bits, Even parity, 1 stop');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  Sumă: ${AMOUNT.toFixed(2)} RON  →  ${amtStr} cenți`);
console.log('');

const port = new SerialPort({
  path: PORT,
  baudRate: BAUD,
  dataBits: 7,      // ← 7 biți conform documentație
  parity: 'even',  // ← Even parity conform documentație
  stopBits: 1,
  autoOpen: false,
});

let rxBuf = Buffer.alloc(0);
let state = 'WAIT_ACK_10';
let done = false;

const TOUT = setTimeout(() => {
  if (!done) {
    log('⏱ Timeout 90s');
    port.close();
    process.exit(0);
  }
}, 90000);

port.open(err => {
  if (err) { console.error('❌', err.message); process.exit(1); }
  log(`✅ Port deschis: ${PORT} @ 9600, 7E1`);
  log(`📤 Trimitere MOL10 (${AMOUNT.toFixed(2)} RON):`);
  log(`   HEX: ${[...MOL10].map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ')}`);
  port.write(MOL10, err => err && log(`❌ Write err: ${err.message}`));
});

port.on('data', chunk => {
  rxBuf = Buffer.concat([rxBuf, chunk]);
  log(`📥 RAW: ${[...chunk].map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ')}  →  ${[...chunk].map(interp).join(' ')}`);

  let offset = 0;
  while (offset < rxBuf.length) {
    const b = rxBuf[offset];

    if (b === ACK) {
      if (state === 'WAIT_ACK_10') {
        log('✅ ACK ← MOL10 acceptat! Aştept MOL11...');
        state = 'WAIT_11';
      } else if (state === 'WAIT_ACK_13') {
        log('✅ ACK ← MOL13 confirmat. Tranzacție completă!');
        done = true; clearTimeout(TOUT); port.close();
      }
      offset++; continue;
    }

    if (b === NAK) {
      log('⚠️ NAK — LRC sau format greșit');
      offset++; continue;
    }

    if (b === EOT) {
      log('⛔ EOT — terminal refuză / nu e în modul ECR');
      offset++; continue;
    }

    if (b === STX) {
      const etxI = rxBuf.indexOf(ETX, offset + 1);
      if (etxI < 0 || rxBuf.length <= etxI + 1) break; // incomplet
      
      const payload = rxBuf.subarray(offset + 1, etxI).toString('ascii');
      const frameLrc = rxBuf[etxI + 1];
      log(`📦 Frame: "${payload}"  LRC=0x${frameLrc.toString(16).toUpperCase()}`);
      
      // ACK imediat
      port.write(Buffer.from([ACK]));
      log('📤 ACK trimis');
      
      if (payload.startsWith('MOL11.')) {
        log('🟡 MOL11 — POS activ, clientul poate introduce cardul...');
        state = 'WAIT_12';
      } else if (payload.startsWith('MOL12.')) {
        const rc = payload.slice(6, 8);
        const approved = rc === '00' || rc === '0 ' || rc.trim() === '0';
        log(`${approved ? '🎉' : '❌'} MOL12 — Cod răspuns: "${rc}" → ${approved ? 'APROBAT' : 'REFUZAT'}`);
        log(`   Payload complet: ${payload}`);
        
        // Parse câmpuri
        const parts = payload.slice(6).split(String.fromCharCode(FS));
        if (parts.length > 0) log(`   Response Code: "${parts[0].slice(0,2)}"`);
        if (parts.length > 1) log(`   PAN: "${parts[0].slice(2)}" | Expiry: "${parts[1]}"`);
        
        // Trimitere MOL13 (acknowledgment final)
        log('📤 Trimitere MOL13 (Authorization Acknowledgment)...');
        port.write(MOL13, err => err && log(`❌ ${err.message}`));
        state = 'WAIT_ACK_13';
      } else {
        log(`   Frame necunoscut — ignorat`);
      }
      
      offset = etxI + 2; continue;
    }

    offset++;
  }
  if (offset > 0) rxBuf = rxBuf.subarray(offset);
});

port.on('error', err => log(`❌ ${err.message}`));
port.on('close', () => { clearTimeout(TOUT); log('Port închis.'); });
