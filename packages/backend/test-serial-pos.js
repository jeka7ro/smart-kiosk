/**
 * Test comunicare serială POS VeriFone V200t (Raiffeisen ECR Protocol MOL)
 * Portul detectat: /dev/cu.usbserial-FTF2NAV8
 *
 * Utilizare:
 *   node test-serial-pos.js [PORT] [BAUD] [SUMA_RON]
 *   node test-serial-pos.js /dev/cu.usbserial-FTF2NAV8 9600 1
 *
 * Ce face:
 *   1. Deschide portul serial
 *   2. Trimite MOL10 (payment request) cu suma specificată
 *   3. Loghează TOT ce primește de la POS (raw hex + ASCII)
 *   4. Încearcă să interpreteze răspunsul
 */

const { SerialPort } = require('serialport');

const SERIAL_PORT = process.argv[2] || '/dev/cu.usbserial-FTF2NAV8';
const BAUD_RATE   = parseInt(process.argv[3]) || 9600;
const AMOUNT_RON  = parseFloat(process.argv[4]) || 1.00;

const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;

function calculateLRC(buffer) {
  let lrc = 0;
  for (let i = 1; i < buffer.length - 1; i++) lrc ^= buffer[i];
  return lrc;
}

function buildMOL10(amountRon) {
  const cents = Math.round(amountRon * 100);
  const amountStr = String(cents).padStart(12, '0');
  const payload = 'MOL10.' + amountStr;
  const payloadBuf = Buffer.from(payload, 'ascii');
  const frame = Buffer.alloc(payloadBuf.length + 3);
  frame[0] = STX;
  payloadBuf.copy(frame, 1);
  frame[frame.length - 2] = ETX;
  frame[frame.length - 1] = calculateLRC(frame);
  return frame;
}

function hexDump(buf) {
  const hex = [...buf].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  const ascii = [...buf].map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
  return `HEX: ${hex}\nASC: ${ascii}`;
}

function interpretByte(b) {
  if (b === STX) return '<STX>';
  if (b === ETX) return '<ETX>';
  if (b === ACK) return '<ACK>';
  if (b === NAK) return '<NAK>';
  if (b >= 32 && b < 127) return String.fromCharCode(b);
  return `<0x${b.toString(16).toUpperCase().padStart(2,'0')}>`;
}

console.log('═══════════════════════════════════════════════════════');
console.log('  Test Serial POS — VeriFone V200t / Raiffeisen ECR');
console.log('═══════════════════════════════════════════════════════');
console.log(`  Port:    ${SERIAL_PORT}`);
console.log(`  Baud:    ${BAUD_RATE}`);
console.log(`  Sumă:    ${AMOUNT_RON.toFixed(2)} RON`);
console.log('═══════════════════════════════════════════════════════\n');

// Listăm porturile disponibile mai întâi
SerialPort.list().then(ports => {
  console.log('📋 Porturi seriale detectate:');
  ports.forEach(p => {
    const isCurrent = p.path === SERIAL_PORT;
    console.log(`  ${isCurrent ? '→' : ' '} ${p.path} ${p.manufacturer ? '| ' + p.manufacturer : ''} ${p.serialNumber ? '| SN:' + p.serialNumber : ''}`);
  });
  console.log('');
  startTest();
});

function startTest() {
  const port = new SerialPort({
    path: SERIAL_PORT,
    baudRate: BAUD_RATE,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    autoOpen: false,
  });

  let rxBuffer = Buffer.alloc(0);
  let finished = false;

  const timeout = setTimeout(() => {
    if (!finished) {
      console.log('\n⏱️  Timeout 30s — niciun răspuns de la POS.');
      console.log('   Verifică:');
      console.log('   • Cablul DB9 e conectat la portul ECR/COM al V200t (nu la alimentare!)');
      console.log('   • Modul ECR Serial este activat pe terminal (Setup > ECR > Serial)');
      console.log('   • Baud rate-ul se potrivește (încearcă 2400 sau 115200 dacă 9600 nu merge)');
      port.close();
      process.exit(0);
    }
  }, 30000);

  port.open((err) => {
    if (err) {
      console.error(`❌ Nu pot deschide portul: ${err.message}`);
      clearTimeout(timeout);
      process.exit(1);
    }

    console.log(`✅ Port deschis: ${SERIAL_PORT} @ ${BAUD_RATE} baud\n`);

    const frame = buildMOL10(AMOUNT_RON);
    console.log('📤 Trimit MOL10 (Payment Request):');
    console.log(hexDump(frame));
    console.log(`   Payload: MOL10.${String(Math.round(AMOUNT_RON * 100)).padStart(12,'0')}`);
    console.log('');

    port.write(frame, (writeErr) => {
      if (writeErr) {
        console.error(`❌ Eroare scriere: ${writeErr.message}`);
      } else {
        console.log('✅ Frame trimis! Aştept răspuns POS...\n');
        console.log('─────────────────────────────────────────────────────');
        console.log('📥 DATE PRIMITE DE LA POS:');
        console.log('─────────────────────────────────────────────────────');
      }
    });
  });

  port.on('data', (chunk) => {
    rxBuffer = Buffer.concat([rxBuffer, chunk]);
    
    // Afișăm raw imediat
    const chunkHex = [...chunk].map(b => b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
    const chunkInterp = [...chunk].map(interpretByte).join(' ');
    console.log(`[${new Date().toISOString().slice(11,23)}] RAW: ${chunkHex}`);
    console.log(`[${new Date().toISOString().slice(11,23)}]     ${chunkInterp}`);

    // Interpretare simplă
    const hasACK = rxBuffer.includes(ACK);
    const hasNAK = rxBuffer.includes(NAK);
    const hasSTX = rxBuffer.includes(STX);
    const hasETX = rxBuffer.indexOf(ETX) > rxBuffer.indexOf(STX);

    if (hasNAK) {
      console.log('\n⚠️  POS a răspuns cu NAK — LRC greșit sau mesaj refuzat');
    }

    if (hasACK) {
      console.log('\n✅ POS a trimis ACK — mesajul MOL10 a fost acceptat!');
      // Trimite ACK înapoi dacă POS-ul trimite un frame
    }

    if (hasSTX && hasETX) {
      const stxIdx = rxBuffer.indexOf(STX);
      const etxIdx = rxBuffer.indexOf(ETX, stxIdx);
      if (etxIdx > stxIdx) {
        const payload = rxBuffer.subarray(stxIdx + 1, etxIdx).toString('ascii');
        const lrc = rxBuffer[etxIdx + 1];
        console.log(`\n📦 Frame complet detectat:`);
        console.log(`   Payload: "${payload}"`);
        console.log(`   LRC: 0x${lrc ? lrc.toString(16).toUpperCase() : 'N/A'}`);
        
        if (payload.startsWith('MOL11')) {
          console.log('   → MOL11: POS activat, aşteaptă card!');
          port.write(Buffer.from([ACK]));
          console.log('   → Trimis ACK pentru MOL11');
        } else if (payload.startsWith('MOL12')) {
          const rc = payload.slice(6, 8);
          console.log(`   → MOL12: Răspuns autorizare, cod="${rc}" (${rc==='00'?'APROBAT':'REFUZAT'})`);
          port.write(Buffer.from([ACK]));
        }
        
        finished = true;
        clearTimeout(timeout);
        
        setTimeout(() => {
          console.log('\n─────────────────────────────────────────────────────');
          console.log('📊 BUFFER TOTAL PRIMIT:');
          console.log(hexDump(rxBuffer));
          port.close();
          process.exit(0);
        }, 2000);
      }
    }
  });

  port.on('error', (err) => {
    console.error(`❌ Eroare port serial: ${err.message}`);
    clearTimeout(timeout);
  });

  port.on('close', () => {
    if (!finished) {
      console.log('\nPort serial închis.');
    }
  });
}
