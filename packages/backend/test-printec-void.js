/**
 * VOID (Anulare) — Printec ECR v3.9.3
 * 
 * Comanda VOID: KLASSE=06, INST=0x30, DLNG=0x12 (18 bytes)
 * Data: Amount(12) + ReceiptNumber(6)
 * 
 * Chitanțe aprobate de anulat:
 *   012340 — 1.00 RON (APROBAT, Mastercard)
 */

const { SerialPort } = require('serialport');

const PORT   = '/dev/cu.usbserial-FTF2NAV8';
const BAUD   = 9600;

// ─── Date tranzacții de anulat ────────────────────────────────────────────────
// Modifică după caz:
const AMOUNT     = process.argv[2] || '1.00';       // ex: 1.00
const RECEIPT_NR = process.argv[3] || '012340';      // nr chitanță de pe bon

// Control characters
const DLE=0x10, STX=0x02, ETX=0x03, ACK=0x06, NAK=0x15, EOT=0x04, ENQ=0x05;

function calcLRC(cmdBytes) { let b=0; for(const x of cmdBytes) b^=x; return b; }
function buildFrame(cmdBytes) { const lrc=calcLRC(cmdBytes); return Buffer.from([DLE,STX,...cmdBytes,DLE,ETX,lrc]); }

function extractFrame(buf) {
  for(let i=0;i<buf.length-1;i++) {
    if(buf[i]===DLE&&buf[i+1]===STX) {
      for(let j=i+2;j<buf.length-1;j++) {
        if(buf[j]===DLE&&buf[j+1]===ETX&&buf.length>j+2) {
          return { cmdBytes:buf.subarray(i+2,j), lrcByte:buf[j+2], frameEnd:j+3 };
        }
      }
      break;
    }
  }
  return null;
}

const LOGIN_FRAME = buildFrame([0x06, 0x00, 0x00]);

function buildVoid(amountRon, receiptNr) {
  const cents  = Math.round(parseFloat(amountRon) * 100);
  const amtStr = String(cents).padStart(12, '0');
  const rcpStr = String(receiptNr).padStart(6, '0');
  // VOID: 06 30 12 + amount(12) + receipt(6)  → DLNG=0x12=18
  const dataBytes = [...Buffer.from(amtStr + rcpStr, 'ascii')];
  return buildFrame([0x06, 0x30, 0x12, ...dataBytes]);
}

function interp(b) {
  const n={0x02:'<STX>',0x03:'<ETX>',0x04:'<EOT>',0x05:'<ENQ>',0x06:'<ACK>',0x10:'<DLE>',0x15:'<NAK>',0x1C:'<FS>'};
  return n[b]||(b>=32&&b<127?String.fromCharCode(b):`<${b.toString(16).toUpperCase().padStart(2,'0')}>`);
}
function hexLine(buf) { return [...buf].map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ')+'  →  '+[...buf].map(interp).join(' '); }
function ts() { return new Date().toISOString().slice(11,23); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

const VOID_FRAME = buildVoid(AMOUNT, RECEIPT_NR);

console.log('═══════════════════════════════════════════════════════════════');
console.log('  VOID (Anulare) — Printec ECR v3.9.3 — VeriFone V200t');
console.log(`  Chitanță: ${RECEIPT_NR}  |  Sumă: ${AMOUNT} RON`);
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  LOGIN:  ${hexLine(LOGIN_FRAME)}`);
console.log(`  VOID:   ${hexLine(VOID_FRAME)}`);
console.log('');

const port = new SerialPort({path:PORT,baudRate:BAUD,dataBits:8,parity:'none',stopBits:1,autoOpen:false});
let rxBuf=Buffer.alloc(0), state='IDLE', done=false, stateTimer;

const cleanup = () => { clearTimeout(stateTimer); try{if(port.isOpen)port.close();}catch(_){} };
const fail = (msg) => { if(done)return; done=true; cleanup(); log(`❌ ${msg}`); };
const succeed = (result) => { if(done)return; done=true; cleanup(); log(`\n🎉 VOID REUȘIT! ${JSON.stringify(result,null,2)}`); };
const setState = (s) => { state=s; log(`  ─ State: ${s}`); };
const arm = (msg,ms) => { clearTimeout(stateTimer); stateTimer=setTimeout(()=>fail(`Timeout: ${msg}`),ms); };

let pendingFrame, nextLabel, nextState;

const ecrSend = (frame,ns,lbl,ms=3000) => {
  log(`\n📤 ENQ → (${lbl})`);
  port.write(Buffer.from([ENQ]));
  setState(`WAIT_ENQ_ACK__${ns}`);
  pendingFrame=frame; nextLabel=lbl; nextState=ns;
  arm(`ACK la ENQ (${lbl})`,ms);
};

port.open(err => {
  if(err){console.error('❌',err.message);process.exit(1);}
  log(`✅ Port deschis @ ${BAUD} 8N1`);
  ecrSend(LOGIN_FRAME,'LOGIN','LOGIN');
});

port.on('data', chunk => {
  if(done)return;
  rxBuf=Buffer.concat([rxBuf,chunk]);
  log(`📥 ${hexLine(chunk)}`);

  while(rxBuf.length>0&&!done) {
    const b=rxBuf[0];

    if(b===ACK&&state.startsWith('WAIT_ENQ_ACK__')) {
      rxBuf=rxBuf.subarray(1); clearTimeout(stateTimer);
      log(`ACK ← ENQ ok (${nextLabel}). Trimit frame...`);
      port.write(pendingFrame);
      setState(`WAIT_FRAME_ACK__${nextState}`);
      arm(`ACK la frame (${nextLabel})`,3000); break;
    }

    if(b===ACK&&state.startsWith('WAIT_FRAME_ACK__')) {
      rxBuf=rxBuf.subarray(1); clearTimeout(stateTimer);
      const ns=state.replace('WAIT_FRAME_ACK__','');
      if(ns==='LOGIN') {
        log('LOGIN ok → EOT'); port.write(Buffer.from([EOT]));
        setState('WAIT_POS_ENQ__LOGIN_RESP'); arm('răspuns LOGIN',5000);
      } else if(ns==='VOID') {
        log('VOID frame acceptat! → EOT. Aștept confirmare card...'); port.write(Buffer.from([EOT]));
        setState('WAIT_POS_ENQ__RESULT'); arm('rezultat VOID',120000);
      } break;
    }

    if(b===EOT){rxBuf=rxBuf.subarray(1);log('EOT ←');break;}
    if(b===NAK){rxBuf=rxBuf.subarray(1);log('⚠ NAK');break;}

    if(b===ENQ) {
      rxBuf=rxBuf.subarray(1); clearTimeout(stateTimer);
      log(`ENQ ← (state=${state})`);
      port.write(Buffer.from([ACK]));
      if(state==='WAIT_POS_ENQ__LOGIN_RESP'){setState('WAIT_POS_FRAME__LOGIN_RESP');arm('frame LOGIN resp',3000);}
      else if(state==='WAIT_POS_ENQ__RESULT'){setState('WAIT_POS_FRAME__RESULT');arm('frame rezultat',5000);}
      break;
    }

    if(b===DLE&&rxBuf.length>=2&&rxBuf[1]===STX) {
      const ex=extractFrame(rxBuf);
      if(!ex)break;
      const {cmdBytes,lrcByte,frameEnd}=ex;
      rxBuf=rxBuf.subarray(frameEnd); clearTimeout(stateTimer);
      const calc=calcLRC(cmdBytes);
      if(lrcByte!==calc){port.write(Buffer.from([NAK]));log('NAK → LRC wrong');break;}
      port.write(Buffer.from([ACK]));
      const kl=cmdBytes[0],ins=cmdBytes[1],data=cmdBytes.subarray(3);
      log(`📦 Frame: ${hexLine(cmdBytes)}`);

      // LOGIN response
      if((kl===0x80||kl===0x84)&&state==='WAIT_POS_FRAME__LOGIN_RESP') {
        const ok=kl===0x80||(kl===0x84&&ins===0x00);
        if(ok){log('✅ LOGIN OK → EOT → VOID');port.write(Buffer.from([EOT]));setTimeout(()=>ecrSend(VOID_FRAME,'VOID','VOID',3000),800);}
        else fail(`LOGIN refuzat: APRW=0x${ins.toString(16)}`);
        break;
      }

      // VOID result (06 0F = Authorization End)
      if(kl===0x06&&ins===0x0F) {
        const payload=data; // XX=DLNG, data starts directly with fields
        const refNum  =payload.subarray(0,12).toString('ascii').trim();
        const termId  =payload.subarray(12,20).toString('ascii').trim();
        const txDate  =payload.subarray(20,32).toString('ascii').trim();
        const amtF    =payload.subarray(32,44).toString('ascii').trim();
        const currency=payload.subarray(44,47).toString('ascii').trim();
        const authCode=payload.subarray(47,53).toString('ascii').trim();
        const respCode=payload.subarray(53,57).toString('ascii').trim();
        const varStr  =payload.subarray(57).toString('ascii');
        const vf      =varStr.split(String.fromCharCode(0x1C));
        const approved=respCode==='0000'||respCode.startsWith('00');
        port.write(Buffer.from([EOT]));
        succeed({success:approved,respCode,authCode,refNum,amount:amtF,currency,receiptText:vf[0]});
        break;
      }

      // Refusal (06 1E)
      if(kl===0x06&&ins===0x1E) {
        log(`❌ VOID REFUZAT de POS, cod=0x${data[0].toString(16).toUpperCase()}`);
        port.write(Buffer.from([EOT])); fail('VOID refuzat'); break;
      }

      // Interim (05 01 PIN, 05 02 BeginAuth, 80 00 00)
      if(kl===0x05&&ins===0x01){log('🔒 PIN Entry...');port.write(Buffer.from([EOT]));setState('WAIT_POS_ENQ__RESULT');arm('după PIN',120000);break;}
      if(kl===0x05&&ins===0x02){log('🌐 Comunicare bancă...');port.write(Buffer.from([EOT]));setState('WAIT_POS_ENQ__RESULT');arm('după auth',120000);break;}
      if(kl===0x80||kl===0x84){
        log('80/84 intermediar → EOT');
        port.write(Buffer.from([EOT]));
        setState('WAIT_POS_ENQ__RESULT'); arm('rezultat',120000); break;
      }
      log('Frame necunoscut → EOT');
      port.write(Buffer.from([EOT])); break;
    }
    rxBuf=rxBuf.subarray(1);
  }
});

port.on('error',err=>fail(`Port: ${err.message}`));
setTimeout(()=>fail('Timeout global 10min'),600000);
