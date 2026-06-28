/**
 * Sniffer raw — descoperim protocolul ECR al V200t Raiffeisen
 * 
 * Strategii testate în ordine:
 *  1. ENQ → ACK → trimitem diferite formate de comandă SALE
 *  2. Logăm TOT ce vine de la POS (raw hex)
 */
const { SerialPort } = require('serialport');

const PORT = '/dev/cu.usbserial-FTF2NAV8';
const BAUD = 9600;

const STX=0x02, ETX=0x03, ACK=0x06, NAK=0x15, EOT=0x04, ENQ=0x05, FS=0x1C;

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

// Format 1: MOL (Hypercom) — deja știm că nu merge
const MOL10 = frame('MOL10.000000000100');

// Format 2: Nexo / ZVT-like — "P" prefix  
// STX + "P" + MSGTYPE(2) + FS + AMOUNT + ETX + LRC
const buildP = (type, amount) => {
  const amt = String(Math.round(amount * 100)).padStart(12, '0');
  return frame(`P${type}${String.fromCharCode(FS)}${amt}`);
};

// Format 3: Simplu numeric — "01" = SALE
const buildNumeric = (cmd, amount) => {
  const amt = String(Math.round(amount * 100)).padStart(12, '0');
  return frame(`${cmd}${amt}`);
};

// Format 4: VeriFone standard 2-digit prefix
// STX + CMD(2) + DATA_LEN(3) + DATA + ETX + LRC
const buildVFI = (cmd, data) => {
  const d = Buffer.from(data, 'ascii');
  const lenStr = String(d.length).padStart(3, '0');
  return frame(`${cmd}${lenStr}${data}`);
};

// Format 5: Printec / Romanian acquirer format
// STX + "0" + CMD(3) + FS + AMOUNT(12) + ETX + LRC  
const buildPrintec = (cmd, amount) => {
  const amt = String(Math.round(amount * 100)).padStart(12, '0');
  return frame(`0${cmd}${String.fromCharCode(FS)}${amt}`);
};

const candidates = [
  { name: 'MOL10 (Hypercom)',           buf: MOL10 },
  { name: 'P01+FS+amount (P-prefix)',    buf: buildP('01', 1.00) },
  { name: '01+amount (numeric)',         buf: buildNumeric('01', 1.00) },
  { name: '10+amount (numeric)',         buf: buildNumeric('10', 1.00) },
  { name: 'P001+amount',                buf: frame('P001000000000100') },
  { name: 'VFI 01 SALE',               buf: buildVFI('01', '000000000100') },
  { name: 'Printec 001+FS+amount',      buf: buildPrintec('001', 1.00) },
  { name: 'ENQ only — ascult POS',      buf: null }, // doar ascultăm
];

function interp(b) {
  const n={0x02:'<STX>',0x03:'<ETX>',0x04:'<EOT>',0x05:'<ENQ>',0x06:'<ACK>',0x15:'<NAK>',0x1C:'<FS>'};
  return n[b] || (b>=32&&b<127?String.fromCharCode(b):`<${b.toString(16).toUpperCase().padStart(2,'0')}>`);
}

function hexLine(buf) {
  return [...buf].map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ') +
    '  →  ' + [...buf].map(interp).join(' ');
}

function ts() { return new Date().toISOString().slice(11,23); }

const port = new SerialPort({ path: PORT, baudRate: BAUD, dataBits:8, parity:'none', stopBits:1, autoOpen:false });

let candidateIdx = 0;
let waitingResponse = false;
let rxBuf = Buffer.alloc(0);
let responseTimer;

function sendNext() {
  if (candidateIdx >= candidates.length) {
    console.log('\n══════════════════════════════════════');
    console.log('Test complet. Analizează output-ul de mai sus.');
    console.log('Caută care format a primit ACK (0x06) în loc de EOT (0x04)');
    port.close();
    return;
  }

  const c = candidates[candidateIdx];
  console.log(`\n[${ts()}] ═══ TEST ${candidateIdx+1}/${candidates.length}: ${c.name} ═══`);
  
  // Reset
  rxBuf = Buffer.alloc(0);
  waitingResponse = true;
  clearTimeout(responseTimer);

  if (c.buf === null) {
    // Doar ascultăm 5s
    console.log(`[${ts()}] 👂 Ascult ce trimite POS spontan (5s)...`);
    responseTimer = setTimeout(() => {
      console.log(`[${ts()}] (nimic primit spontan)`);
      candidateIdx++;
      sendNext();
    }, 5000);
    return;
  }

  // Pas 1: ENQ
  port.write(Buffer.from([ENQ]), () => {
    console.log(`[${ts()}] 📤 ENQ`);
    
    // Aştept ACK la ENQ, apoi trimit comanda
    const enqTimer = setTimeout(() => {
      console.log(`[${ts()}] ⏱ Timeout ENQ — skip`);
      candidateIdx++;
      sendNext();
    }, 3000);

    const onEnqResp = (data) => {
      clearTimeout(enqTimer);
      port.removeListener('data', onEnqResp);
      
      if (data[0] === ACK) {
        console.log(`[${ts()}] 📥 ACK ← ENQ OK`);
        console.log(`[${ts()}] 📤 ${c.name}: ${hexLine(c.buf)}`);
        port.write(c.buf);
        
        // Aştept răspuns la comandă (5s)
        responseTimer = setTimeout(() => {
          console.log(`[${ts()}] ⏱ Timeout — niciun răspuns complet`);
          candidateIdx++;
          sendNext();
        }, 5000);
      } else {
        console.log(`[${ts()}] 📥 Resp ENQ: ${hexLine(data)} — POS nu e gata, skip`);
        candidateIdx++;
        setTimeout(sendNext, 500);
      }
    };

    port.once('data', onEnqResp);
  });
}

let collecting = false;
port.on('data', chunk => {
  if (!waitingResponse) return;
  rxBuf = Buffer.concat([rxBuf, chunk]);
  console.log(`[${ts()}] 📥 ${hexLine(chunk)}`);

  // Dacă primim EOT sau NAK — înseamnă că formatul NU e recunoscut
  if (chunk.includes(EOT)) {
    console.log(`[${ts()}] ❌ EOT — format NERECUNOSCUT`);
    clearTimeout(responseTimer);
    waitingResponse = false;
    candidateIdx++;
    setTimeout(sendNext, 1000);
    return;
  }

  if (chunk.includes(NAK)) {
    console.log(`[${ts()}] ⚠️ NAK — LRC greșit sau format parțial înțeles (FORMAT PROMIȚĂTOR!)`);
    clearTimeout(responseTimer);
    waitingResponse = false;
    candidateIdx++;
    setTimeout(sendNext, 1000);
    return;
  }

  // ACK după comandă = FORMAT CORECT!
  if (chunk.includes(ACK)) {
    clearTimeout(responseTimer);
    console.log(`[${ts()}] 🎉 ACK — FORMAT RECUNOSCUT! → "${candidates[candidateIdx].name}"`);
    // Continuăm să ascultăm frame-ul complet
    responseTimer = setTimeout(() => {
      waitingResponse = false;
      candidateIdx++;
      setTimeout(sendNext, 1000);
    }, 10000);
  }

  // Frame STX...ETX complet?
  const stxI = rxBuf.indexOf(STX);
  const etxI = rxBuf.indexOf(ETX, stxI + 1);
  if (stxI >= 0 && etxI > stxI && rxBuf.length > etxI + 1) {
    const payload = rxBuf.subarray(stxI+1, etxI).toString('ascii');
    console.log(`[${ts()}] 📦 Frame complet: "${payload}"`);
    clearTimeout(responseTimer);
    waitingResponse = false;
    candidateIdx++;
    setTimeout(sendNext, 2000);
  }
});

port.open(err => {
  if (err) { console.error('❌', err.message); process.exit(1); }
  console.log(`✅ Port: ${PORT} @ ${BAUD}`);
  console.log('🔍 Testăm formate ECR cunoscute...\n');
  setTimeout(sendNext, 500);
});

port.on('error', err => console.error('❌', err.message));
setTimeout(() => { console.log('\nTimeout global 3min'); port.close(); process.exit(0); }, 180000);
