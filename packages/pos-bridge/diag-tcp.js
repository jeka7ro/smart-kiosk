/**
 * Quick scan: check if port 8080 is open on other devices in the network
 * Also try: connect and WAIT (don't send anything) to see if terminal sends more
 */
const net = require('net');

const targets = [
  { ip: '192.168.20.112', port: 8080, label: 'KIOSK device' },
  { ip: '192.168.20.112', port: 20002, label: 'KIOSK:20002' },
  { ip: '192.168.20.115', port: 8080, label: 'Iskra 2' },
  { ip: '192.168.20.113', port: 8080, label: 'Viva1 (wait mode)' },
];

let idx = 0;

function testNext() {
  if (idx >= targets.length) {
    console.log('\n=== DONE ===');
    process.exit(0);
  }
  
  const t = targets[idx++];
  console.log(`\n--- Testing ${t.label} (${t.ip}:${t.port}) ---`);
  
  const client = new net.Socket();
  
  const timer = setTimeout(() => {
    console.log(`[${t.label}] No data in 6s`);
    client.destroy();
    setTimeout(testNext, 300);
  }, 6000);

  client.connect(t.port, t.ip, () => {
    console.log(`[${t.label}] CONNECTED!`);
    // For Viva1 wait mode: don't send anything, just wait
    if (t.label.includes('wait')) {
      console.log(`[${t.label}] Waiting (not sending anything)...`);
    }
  });

  client.on('data', (data) => {
    console.log(`[${t.label}] RECV: ${data.toString('utf8')}`);
    console.log(`[${t.label}] HEX: ${data.toString('hex').match(/.{1,2}/g).join(' ')}`);
    
    if (t.label.includes('wait')) {
      // Keep waiting for more data
      console.log(`[${t.label}] Still waiting for more data...`);
    }
  });

  client.on('close', () => {
    clearTimeout(timer);
    console.log(`[${t.label}] Connection closed`);
    setTimeout(testNext, 300);
  });

  client.on('error', (err) => {
    clearTimeout(timer);
    console.log(`[${t.label}] Error: ${err.message}`);
    setTimeout(testNext, 300);
  });
}

testNext();
