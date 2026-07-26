require('dotenv').config();
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

const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;
const EOT = 0x04;

function calcLRC(buf) {
  let lrc = 0;
  for (let i = 1; i < buf.length; i++) lrc ^= buf[i];
  return lrc;
}

function buildMol(id, type, dataStr) {
  const payload = Buffer.from(id + type + dataStr, 'ascii');
  const buf = Buffer.alloc(payload.length + 2);
  buf[0] = STX;
  payload.copy(buf, 1);
  buf[buf.length - 1] = ETX;
  const lrc = calcLRC(buf);
  return Buffer.concat([buf, Buffer.from([lrc])]);
}

async function detectPosPort() {
  const ports = await SerialPort.list();
  const firstCom = ports.find(p => p.path.startsWith('COM') && !p.path.includes('BT'));
  return firstCom ? firstCom.path : 'COM3';
}

function processMolPayment(amount, portPath, onStatus) {
  return new Promise((resolve, reject) => {
    let rxBuf = Buffer.alloc(0);
    let state = 'WAIT_ACK_MOL10';
    let timer = null;
    let done = false;

    const port = new SerialPort({
      path: portPath, baudRate: BAUD_RATE,
      dataBits: 8, parity: 'none', stopBits: 1, autoOpen: false,
    });

    const cleanup = (success, errMsg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      setTimeout(() => { try { port.close(); } catch(_) {} }, 300);
      if (success === true) resolve({ success: true, authCode: '000000', code: '0000' });
      else if (success && typeof success === 'object') resolve(success);
      else reject(new Error(errMsg || 'Eroare tranzacție'));
    };

    port.open(err => {
      if (err) { log(`❌ Eroare deschidere port: ${err.message}`); return reject(err); }
      log(`Port deschis: ${portPath} @ ${BAUD_RATE}`);
      
      const amtCents = Math.round(amount * 100);
      const amtStr = (amtCents / 100).toFixed(2).padStart(8, '0');
      // Formatul corect MOL Purchase: ID="MOL" Type="10" Data=Amount
      const mol10 = buildMol('MOL', '10', amtStr);
      
      log(`📤 TX MOL10 (Cerere Plată): ${amtStr} RON`);
      port.write(mol10);

      timer = setTimeout(() => {
        log('⏱ Timeout răspuns MOL10 (POS nu răspunde)');
        cleanup(false, 'Timeout POS');
      }, 5000);
    });

    port.on('data', chunk => {
      if (done) return;
      rxBuf = Buffer.concat([rxBuf, chunk]);
      
      if (rxBuf[0] === ACK && state === 'WAIT_ACK_MOL10') {
        rxBuf = rxBuf.subarray(1);
        clearTimeout(timer);
        log('✅ ACK primit pt MOL10. Aștept procesare card...');
        onStatus && onStatus('Apropiați cardul');
        state = 'WAIT_MOL11';
        timer = setTimeout(() => cleanup(false, 'Timeout procesare (2 min)'), 120000);
      }
      else if (rxBuf[0] === NAK) {
        log('❌ NAK primit (format greșit sau eroare LRC).');
        cleanup(false, 'POS a respins comanda (NAK)');
      }
      else if (rxBuf[0] === EOT) {
        log('📥 EOT primit (POS a închis sesiunea / eroare).');
        cleanup(false, 'Eroare terminal / EOT');
      }

      // Cautăm frame de la POS
      if (rxBuf.includes(STX) && rxBuf.includes(ETX)) {
        const start = rxBuf.indexOf(STX);
        const end = rxBuf.indexOf(ETX, start);
        if (end !== -1 && rxBuf.length > end + 1) {
          const frame = rxBuf.subarray(start, end + 2); // include LRC
          rxBuf = rxBuf.subarray(end + 2);
          
          port.write(Buffer.from([ACK])); // Confirmăm primirea
          
          const payload = frame.subarray(1, frame.length - 2).toString('ascii');
          log(`📥 RX FRAME: ${payload}`);

          if (payload.startsWith('MOL11')) {
            clearTimeout(timer);
            const approved = payload.includes('000'); // '000' = success in protocol
            log(approved ? '✅ Plată APROBATĂ' : '❌ Plată RESPINSĂ');
            
            // Confirmăm cu MOL13 (End of Session)
            setTimeout(() => {
              const mol13 = buildMol('MOL', '13', '');
              log('📤 TX MOL13 (Confirmare finală)');
              port.write(mol13);
              setTimeout(() => cleanup({ success: approved, authCode: '123456', raw: payload }, approved ? null : 'Refuzat'), 500);
            }, 300);
          }
        }
      }
    });

    port.on('error', err => { if (!done) cleanup(false, err.message); });
  });
}

async function start() {
  const portPath = await detectPosPort();
  const socket = ioClient(RENDER_URL, { auth: { bridgeKey: BRIDGE_KEY, locationId: LOCATION_ID } });

  log(`Bridge v3 | Locație: ${LOCATION_ID} | Port: ${portPath}`);

  socket.on('connect', () => {
    log(`✅ Conectat la server`);
    socket.emit('pos_bridge_register', { locationId: LOCATION_ID, port: portPath });
  });

  socket.on('pos_payment_request', async (data) => {
    log(`==== AM PRIMIT CEREREA DE LA KIOSK ====`); // Asta trebuie sa apara obligatoriu!
    const { orderId, amount, locationId: lid } = data;
    
    if (lid && lid !== LOCATION_ID) return;

    log(`💳 Inițiez plata: ${amount} RON`);
    socket.emit('pos_bridge_status', { orderId, message: 'Se trimite la POS...' });

    try {
      const res = await processMolPayment(amount, portPath, (msg) => {
        socket.emit('pos_bridge_status', { orderId, message: msg });
      });
      socket.emit('pos_payment_result', { orderId, paid: res.success, authCode: res.authCode });
    } catch (err) {
      log(`❌ EROARE: ${err.message}`);
      socket.emit('pos_payment_result', { orderId, paid: false, error: err.message });
    }
  });
}

start();
