/**
 * Diagnostic: connect to Viva POS via raw TCP and see what it responds
 */
const net = require('net');
const ip = process.env.VIVA_POS_IP || '192.168.20.113';
const port = 8080;

console.log(`\n=== DIAGNOSTIC TCP: Connecting to ${ip}:${port} ===\n`);

const client = new net.Socket();

client.connect(port, ip, () => {
  console.log('[CONNECTED] TCP connection established!');
  
  // Try sending various ECR protocol formats
  const messages = [
    // Format 1: Simple JSON
    JSON.stringify({ amount: 100, currencyCode: 946, action: 'sale' }),
    // Will try more if this one shows something
  ];

  console.log(`[SEND] Sending: ${messages[0]}`);
  client.write(messages[0]);
  
  // Also try sending just a newline after 2 seconds to see if it responds
  setTimeout(() => {
    console.log('[SEND] Sending newline...');
    client.write('\r\n');
  }, 2000);

  // Close after 10 seconds
  setTimeout(() => {
    console.log('\n[DONE] Closing connection after 10 seconds');
    client.destroy();
    process.exit(0);
  }, 10000);
});

client.on('data', (data) => {
  console.log(`[RECV] ${data.length} bytes:`);
  console.log(`[RECV HEX] ${data.toString('hex').match(/.{1,2}/g).join(' ')}`);
  console.log(`[RECV TXT] ${data.toString('utf8')}`);
  console.log(`[RECV ASCII] ${[...data].map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : `[0x${b.toString(16).padStart(2,'0')}]`).join('')}`);
});

client.on('error', (err) => {
  console.error(`[ERROR] ${err.message}`);
  process.exit(1);
});

client.on('close', () => {
  console.log('[CLOSED] Connection closed');
});
