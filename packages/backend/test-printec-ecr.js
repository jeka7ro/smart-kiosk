/**
 * Test Protocol ECR Printec — VeriFone V200t / Raiffeisen România
 *
 * Parametri seriali PRINTEC (confirmat din documentatie):
 *   Baud:   2400
 *   Data:   8 bits
 *   Parity: None  
 *   Stop:   1
 *   Flow:   None
 *
 * Format mesaj Printec ECR:
 *   STX | ClassMsg(1) | MsgType(2) | FS | Amount(12) | FS | Currency(3) | ETX | LRC
 *
 * ClassMsg: '0' = Request ECR→POS, '1' = Response POS→ECR
 * MsgType:  '00' = Sale/Purchase
 * Currency: '946' = RON
 * Amount:   12 cifre, right-justified, zero-padded (fără virgulă)
 */

const { SerialPort } = require('serialport');

const PORT   = '/dev/cu.usbserial-FTF2NAV8';
const BAUD   = 2400;   // ← Printec standard = 2400!
const AMOUNT = parseFloat(process.argv[2]) || 1.00;

const STX=0x02, ETX=0x03, ACK=0x06, NAK=0x15, EOT=0x04, FS=0x1C;

function lrc(buf) {
  let x = 0;
  for (let i = 1; i < buf.length - 1; i++) x ^= buf[i];
  return x;
}

function frame(payload) {
  const p = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'ascii');
  const f = Buffer.alloc(p.length + 3);
  f[0] = STX; p.copy(f, 1); f[f.length-2] = ETX; f[f.length-1] = lrc(f);
  return f;
}

// Construim payload-ul Printec pentru SALE:
// '0' (Request) + '00' (Sale) + FS + Amount(12) + FS + '946' (RON)
function buildSale(amountRon) {
  const cents  = Math.round(amountRon * 100);
  const amtStr = String(cents).padStart(12, '0');
  const parts  = ['0', '00', amtStr, '946'];
  // Joinem cu FS (0x1C)
  const joined = parts.join(String.fromCharCode(FS));
  return frame(joined);
}

// Variante alternative de testat
function buildSaleVariant2(amountRon) {
  // Unele implementări: ClassMsg + MsgType fără FS la început
  const cents  = Math.round(amountRon * 100);
  const amtStr = String(cents).padStart(12, '0');
  // STX + '000' + FS + amount + FS + '946' + ETX + LRC
  const joined = '000' + String.fromCharCode(FS) + amtStr + String.fromCharCode(FS) + '946';
  return frame(joined);
}

function buildSaleVariant3(amountRon) {
  // Format simplu: '0' + '01' + FS + amount
  const cents  = Math.round(amountRon * 100);
  const amtStr = String(cents).padStart(12, '0');
  const joined = '001' + String.fromCharCode(FS) + amtStr;
  return frame(joined);
}

function interp(b) {
  const n={0x02:'<STX>',0x03:'<ETX>',0x04:'<EOT>',0x05:'<ENQ>',0x06:'<ACK>',0x15:'<NAK>',0x1C:'<FS>'};
  return n[b]||(b>=32&&b<127?String.fromCharCode(b):`<${b.toString(16).toUpperCase().padStart(2,'0')}>`);
}

function hexLine(buf) {
  const hex = [...buf].map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
  const asc = [...buf].map(interp).join(' ');
  return `\n   HEX: ${hex}\n   ASC: ${asc}`;
}

function ts() { return new Date().toISOString().slice(11,23); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

const tests = [
  { name: 'Printec SALE 8N1@2400: 0|00|FS|amount|FS|946', buf: buildSale(AMOUNT) },
  { name: 'Printec SALE varianta 000|FS|amount|FS|946',    buf: buildSaleVariant2(AMOUNT) },
  { name: 'Printec SALE varianta 001|FS|amount',           buf: buildSaleVariant3(AMOUNT) },
];

let testIdx = 0;
let port;
let rxBuf = Buffer.alloc(0);
let waiting = false;
let respTimer;

function done() {
  log('─────────────────────────────────────────────────────');
  log('Teste complete. Verifică care format a primit ACK.');
  if (port && port.isOpen) port.close();
}

function nextTest() {
  if (testIdx >= tests.length) { done(); return; }
  const t = tests[testIdx];
  rxBuf = Buffer.alloc(0);
  waiting = true;
  clearTimeout(respTimer);

  log(`\n══ TEST ${testIdx+1}/${tests.length}: ${t.name} ══`);
  log(`📤 Frame:${hexLine(t.buf)}`);
  
  port.write(t.buf, err => {
    if (err) { log(`❌ Write: ${err.message}`); testIdx++; setTimeout(nextTest, 500); return; }
    log('📡 Trimis. Aştept răspuns (8s)...');
    respTimer = setTimeout(() => {
      log('⏱ Timeout — EOT sau niciun răspuns');
      waiting = false; testIdx++;
      setTimeout(nextTest, 1500);
    }, 8000);
  });
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  Printec ECR Protocol — VeriFone V200t / Raiffeisen RO');
console.log(`  Port: ${PORT}  |  Baud: ${BAUD}  |  8N1`);
console.log(`  Sumă: ${AMOUNT.toFixed(2)} RON`);
console.log('═══════════════════════════════════════════════════════════\n');

port = new SerialPort({ path: PORT, baudRate: BAUD, dataBits:8, parity:'none', stopBits:1, autoOpen:false });

port.open(err => {
  if (err) { console.error('❌', err.message); process.exit(1); }
  log(`✅ Port deschis: ${PORT} @ ${BAUD} baud, 8N1`);
  setTimeout(nextTest, 500);
});

port.on('data', chunk => {
  if (!waiting) return;
  rxBuf = Buffer.concat([rxBuf, chunk]);
  log(`📥 ${hexLine(chunk)}`);

  if (chunk.includes(EOT)) {
    log('❌ EOT — format nerecunoscut'); clearTimeout(respTimer);
    waiting = false; testIdx++; setTimeout(nextTest, 1500); return;
  }
  if (chunk.includes(NAK)) {
    log('⚠️ NAK — format parțial corect (LRC sau câmp greșit)!'); clearTimeout(respTimer);
    waiting = false; testIdx++; setTimeout(nextTest, 1500); return;
  }
  if (chunk.includes(ACK)) {
    log('🎉 ACK! FORMAT CORECT! Aştept răspuns complet...'); clearTimeout(respTimer);
    respTimer = setTimeout(() => { waiting = false; testIdx++; setTimeout(nextTest, 1500); }, 15000);
  }

  // Frame complet?
  const si = rxBuf.indexOf(STX), ei = rxBuf.indexOf(ETX, si+1);
  if (si>=0 && ei>si && rxBuf.length>ei+1) {
    const payload = rxBuf.subarray(si+1,ei).toString('ascii');
    log(`📦 Frame complet: "${payload}"`);
    clearTimeout(respTimer);
    
    // Răspuns ACK la POS
    port.write(Buffer.from([ACK]));
    log('📤 ACK trimis înapoi la POS');
    
    waiting = false; testIdx++;
    setTimeout(nextTest, 2000);
  }
});

port.on('error', err => log(`❌ ${err.message}`));
setTimeout(() => { log('Timeout global 3min'); port.close(); process.exit(0); }, 180000);
