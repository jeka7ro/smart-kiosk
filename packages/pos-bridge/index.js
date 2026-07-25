/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SMART KIOSK — POS Bridge                                       ║
 * ║  Rulează pe PC-ul din restaurant. Face legătura dintre           ║
 * ║  Render (cloud) și terminalul Raiffeisen POS local (TCP/IP).    ║
 * ║                                                                  ║
 * ║  PORNIRE: node index.js                                         ║
 * ║  CONFIG:  editează .env sau variabilele de mai jos              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const { io }  = require('socket.io-client');
const net     = require('net');

// ── Config ────────────────────────────────────────────────────────────────────
const RENDER_URL    = process.env.RENDER_URL    || 'https://smart-kiosk-ttut.onrender.com';
const POS_IP        = process.env.POS_IP        || '192.168.1.100'; // IP-ul POS Raiffeisen în rețea locală
const POS_PORT      = parseInt(process.env.POS_PORT || '1000');
const LOCATION_ID   = process.env.LOCATION_ID  || 'brasov';        // ID-ul locației acestui kiosk
const BRIDGE_KEY    = process.env.BRIDGE_KEY    || 'pos-bridge-2024';

// ── Protocol Raiffeisen ECR ───────────────────────────────────────────────────
const STX = 0x02, ETX = 0x03, ACK = 0x06, NAK = 0x15;

function calcLRC(buf) {
  let lrc = 0;
  for (let i = 1; i < buf.length - 1; i++) lrc ^= buf[i];
  return lrc;
}

function buildMsg(msgId, msgType, payload) {
  const msg = msgId + msgType + '.' + payload;
  const msgBuf = Buffer.from(msg, 'ascii');
  const out = Buffer.alloc(msgBuf.length + 3);
  out[0] = STX;
  msgBuf.copy(out, 1);
  out[out.length - 2] = ETX;
  out[out.length - 1] = calcLRC(out);
  return out;
}

function processRaiffeisenPayment(amount) {
  return new Promise((resolve, reject) => {
    const amountStr = String(Math.round(amount * 100)).padStart(12, '0');
    const client = new net.Socket();
    let buf = Buffer.alloc(0);
    let state = 'WAIT_ACK_10';
    let timer;

    const fail  = (msg) => { clearTimeout(timer); client.destroy(); reject(new Error(msg)); };
    const ok    = (r)   => { clearTimeout(timer); client.destroy(); resolve(r); };
    const arm   = (ms, label) => { clearTimeout(timer); timer = setTimeout(() => fail(`Timeout: ${label}`), ms); };

    client.connect(POS_PORT, POS_IP, () => {
      console.log(`[POS Bridge] Conectat la POS ${POS_IP}:${POS_PORT}`);
      // Trimite MOL10 (inițierea plătii)
      const mol10 = buildMsg('M', '10', amountStr + 'RON' + '0'.repeat(20));
      client.write(mol10);
      arm(5000, 'ACK la MOL10');
    });

    client.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);

      // ACK la MOL10
      if (state === 'WAIT_ACK_10' && buf[0] === ACK) {
        buf = buf.subarray(1);
        state = 'WAIT_MOL11';
        arm(120000, 'MOL11 (card)');
        console.log('[POS Bridge] ACK MOL10 ✓ — aştept cardul');
        return;
      }

      // MOL11 — terminal gata pentru card
      if (state === 'WAIT_MOL11' && buf.includes(STX)) {
        client.write(Buffer.from([ACK]));
        buf = Buffer.alloc(0);
        state = 'WAIT_MOL12';
        arm(120000, 'MOL12 (rezultat)');
        console.log('[POS Bridge] MOL11 ✓ — cardul introdus, procesez');
        return;
      }

      // MOL12 — rezultatul tranzacției
      if (state === 'WAIT_MOL12' && buf.includes(STX)) {
        client.write(Buffer.from([ACK]));
        const raw = buf.toString('ascii');
        buf = Buffer.alloc(0);
        state = 'DONE';

        // Parsează rezultatul: aprobat dacă conține '00' cod răspuns
        const approved = raw.includes('.00') || raw.includes('APROBAT') || raw.includes('APPROVED');
        const authCode = (raw.match(/[A-Z0-9]{6}/) || [''])[0];

        console.log(`[POS Bridge] MOL12 ✓ — ${approved ? '✅ APROBAT' : '❌ REFUZAT'} (${authCode})`);

        // Trimite MOL13 (confirmare)
        setTimeout(() => {
          client.write(buildMsg('M', '13', approved ? '00' : '01'));
          ok({ success: approved, authCode, raw });
        }, 300);
      }
    });

    client.on('error', (e) => fail(`Eroare TCP: ${e.message}`));
    client.on('close', () => { if (state !== 'DONE') fail('Conexiune POS închisă neașteptat'); });
  });
}

// ── Socket.IO — conectare la Render ──────────────────────────────────────────
console.log(`\n🔗 POS Bridge pornit`);
console.log(`   Render:   ${RENDER_URL}`);
console.log(`   POS:      ${POS_IP}:${POS_PORT}`);
console.log(`   Locație:  ${LOCATION_ID}\n`);

const socket = io(RENDER_URL, {
  auth: { bridgeKey: BRIDGE_KEY, locationId: LOCATION_ID },
  reconnection: true,
  reconnectionDelay: 3000,
});

socket.on('connect', () => {
  console.log(`✅ Conectat la Render (${socket.id})`);
  socket.emit('pos_bridge_register', { locationId: LOCATION_ID });
});

socket.on('disconnect', (reason) => {
  console.log(`⚠️  Deconectat de la Render: ${reason} — reconectez...`);
});

// Render trimite cerere de plată → bridge procesează → trimite rezultatul înapoi
socket.on('pos_payment_request', async ({ orderId, amount, locationId }) => {
  if (locationId !== LOCATION_ID) return; // nu e pentru noi
  
  console.log(`\n💳 Cerere plată: orderId=${orderId} amount=${amount} RON`);
  socket.emit('pos_bridge_status', { orderId, message: 'Terminal POS activat — aşteptaţi cardul' });

  try {
    const result = await processRaiffeisenPayment(amount);
    console.log(`✅ Plată ${result.success ? 'APROBATĂ' : 'REFUZATĂ'}: ${result.authCode}`);
    socket.emit('pos_payment_result', {
      orderId,
      paid:     result.success,
      authCode: result.authCode,
      raw:      result.raw,
      code:     result.success ? '0000' : 'DECLINED',
    });
  } catch (err) {
    console.error(`❌ Eroare POS: ${err.message}`);
    socket.emit('pos_payment_result', {
      orderId,
      paid:  false,
      error: err.message,
    });
  }
});
