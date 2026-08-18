const net = require('net');
const ip = process.env.VIVA_POS_IP || '192.168.20.113';

// Try matching EXACT terminal message format: LLLL|CMD|SS|DDDDDD
const formats = [
  // Match terminal format exactly: 0018|200|00|00000399
  { label: 'mirror-fmt', get: (seq) => '0018|200|00|00000399' },
  // Echo terminal ID with sale cmd
  { label: 'echo-id', get: (seq) => `0014|200|00|${seq}` },
  // Use terminal seq, different amount format
  { label: 'seq-amt', get: (seq) => `0018|200|${seq}|000399` },
  // No length prefix, same fields
  { label: 'no-len', get: (seq) => `200|00|00000399` },
  // Sale with 4-char amount
  { label: 'short-amt', get: (seq) => '0012|200|00|0399' },
  // Binary: 4-byte length + pipe message
  { label: 'bin-len', get: (seq) => { const msg = '|200|00|00000399'; const buf = Buffer.alloc(4 + msg.length); buf.writeUInt32BE(msg.length, 0); buf.write(msg, 4); return buf; }},
  // Just the number
  { label: 'just-399', get: () => '399' },
  // HTTPS attempt via TLS
  { label: 'tls', tls: true, get: () => null },
];

let idx = 0;

function tryNext() {
  if (idx >= formats.length) { console.log('\n=== DONE ==='); process.exit(0); }
  const f = formats[idx++];
  console.log(`\n--- ${idx}/${formats.length}: ${f.label} ---`);

  if (f.tls) {
    const tls = require('tls');
    const c = tls.connect(8080, ip, {rejectUnauthorized:false}, () => {
      console.log(`[${f.label}] TLS connected!`);
    });
    c.on('data', d => console.log(`[${f.label}] RECV: ${d.toString()}`));
    c.on('error', e => { console.log(`[${f.label}] ${e.message}`); setTimeout(tryNext, 300); });
    c.on('close', () => setTimeout(tryNext, 300));
    setTimeout(() => c.destroy(), 5000);
    return;
  }

  const client = new net.Socket();
  const timer = setTimeout(() => { client.destroy(); console.log(`[${f.label}] Timeout`); setTimeout(tryNext, 300); }, 8000);

  client.connect(8080, ip, () => console.log(`[${f.label}] Connected`));
  
  client.on('data', (data) => {
    const str = data.toString('utf8');
    console.log(`[${f.label}] RECV: ${str}`);
    
    if (str.includes('810')) {
      const seq = str.split('|')[3] || '000000';
      const msg = f.get(seq);
      if (Buffer.isBuffer(msg)) {
        console.log(`[${f.label}] SEND BIN: ${msg.toString('hex')}`);
        client.write(msg);
      } else {
        console.log(`[${f.label}] SEND: ${msg}`);
        client.write(msg);
      }
    } else {
      console.log(`[${f.label}] *** NON-810 RESPONSE! ***`);
    }
  });

  client.on('close', () => { clearTimeout(timer); console.log(`[${f.label}] Closed`); setTimeout(tryNext, 300); });
  client.on('error', (e) => { clearTimeout(timer); console.log(`[${f.label}] Err: ${e.message}`); setTimeout(tryNext, 300); });
}

console.log('=== FINAL PROTOCOL DISCOVERY ===\n');
tryNext();
