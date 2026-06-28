/**
 * Test ENQ → handshake cu POS VeriFone V200t
 * Trimitem ENQ (0x05) = "Ești acolo?" și vedem ce răspunde POS-ul
 * Dacă răspunde ACK (0x06) = e gata de tranzacție
 * Dacă răspunde EOT (0x04) = nu e gata / ocupat
 */
const { SerialPort } = require('serialport');

const SERIAL_PORT = '/dev/cu.usbserial-FTF2NAV8';
const BAUD_RATE   = 9600;

const STX = 0x02, ETX = 0x03, ACK = 0x06, NAK = 0x15, EOT = 0x04, ENQ = 0x05;

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

function interpretByte(b) {
  const names = { 0x02:'<STX>', 0x03:'<ETX>', 0x04:'<EOT>', 0x05:'<ENQ>', 0x06:'<ACK>', 0x15:'<NAK>' };
  return names[b] || (b >= 32 && b < 127 ? String.fromCharCode(b) : `<0x${b.toString(16).toUpperCase().padStart(2,'0')}>`);
}

function log(msg) { console.log(`[${new Date().toISOString().slice(11,23)}] ${msg}`); }

const port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE, dataBits: 8, parity: 'none', stopBits: 1, autoOpen: false });

let rxBuffer = Buffer.alloc(0);
let step = 0; // 0=sent ENQ, 1=sent MOL10, 2=done

const TIMEOUT = setTimeout(() => {
  log('⏱️ Timeout 60s');
  port.close();
  process.exit(0);
}, 60000);

port.open(err => {
  if (err) { console.error('❌', err.message); process.exit(1); }
  log(`✅ Port deschis ${SERIAL_PORT} @ ${BAUD_RATE}`);
  
  // PASUL 1: Trimite ENQ
  log('📤 Trimit ENQ (0x05) — "ești gata?"');
  port.write(Buffer.from([ENQ]));
  step = 0;
});

port.on('data', chunk => {
  rxBuffer = Buffer.concat([rxBuffer, chunk]);
  const interp = [...chunk].map(interpretByte).join(' ');
  const hex = [...chunk].map(b => b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
  log(`📥 Primit: ${hex}  →  ${interp}`);

  // Procesăm byte cu byte
  for (const byte of chunk) {
    
    if (step === 0) {
      // Aşteptăm răspuns la ENQ
      if (byte === ACK) {
        log('✅ POS răspuns ACK la ENQ — gata de tranzacție!');
        log('📤 Trimit MOL10 (1.00 RON)...');
        const mol10 = buildMOL10(1.00);
        port.write(mol10);
        step = 1;
      } else if (byte === EOT) {
        log('⚠️  POS răspuns EOT la ENQ — terminal nu e gata / modul ECR nu e activ');
        log('    → Încearcă să activezi ECR pe terminal: Menu → Setup → ECR → RS232 → Enable');
        log('    → Sau trimitem MOL10 direct fără ENQ (testăm acum)...');
        // Totuși încearcă MOL10 direct
        setTimeout(() => {
          log('📤 Trimit MOL10 direct (fără ENQ)...');
          const mol10 = buildMOL10(1.00);
          port.write(mol10);
          step = 1;
        }, 1000);
      } else if (byte === NAK) {
        log('⚠️  POS răspuns NAK la ENQ');
      } else {
        log(`   Byte necunoscut la ENQ: 0x${byte.toString(16).toUpperCase()}`);
      }
    }

    else if (step === 1) {
      // Aşteptăm răspuns la MOL10
      if (byte === ACK) {
        log('✅ POS ACK la MOL10 — tranzacție inițiată! Aştept MOL11...');
        step = 2;
      } else if (byte === NAK) {
        log('⚠️  POS NAK la MOL10 — LRC greșit sau format invalid');
      } else if (byte === EOT) {
        log('⚠️  POS EOT la MOL10 — terminal refuză / nu e în mod ECR');
      }
    }

    else if (step === 2) {
      // Aşteptăm MOL11 (frame complet)
      if (byte === STX) {
        log('📦 Frame STX detectat — aştept ETX...');
      } else if (byte === ETX) {
        const stxIdx = rxBuffer.lastIndexOf(STX);
        if (stxIdx >= 0) {
          const etxIdx = rxBuffer.indexOf(ETX, stxIdx);
          const payload = rxBuffer.subarray(stxIdx + 1, etxIdx).toString('ascii');
          log(`📦 Frame: "${payload}"`);
          if (payload.startsWith('MOL11')) {
            log('🎉 MOL11 primit — POS activ, aşteaptă card!');
            port.write(Buffer.from([ACK]));
            log('📤 Trimis ACK pentru MOL11');
          }
        }
      }
    }
  }
});

port.on('error', err => { log(`❌ Eroare: ${err.message}`); clearTimeout(TIMEOUT); });
port.on('close', () => { log('Port închis.'); clearTimeout(TIMEOUT); });
