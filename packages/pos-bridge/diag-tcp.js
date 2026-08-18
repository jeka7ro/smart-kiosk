/**
 * Diagnostic: Try multiple sale command formats to find the right one
 */
const net = require('net');
const ip = process.env.VIVA_POS_IP || '192.168.20.113';
const port = 8080;

const attempts = [
  // Format A: ECR endpoint style
  { label: 'ecr-sale-simple', data: '0012|200|00000399' },
  // Format B: with \r\n terminator
  { label: 'sale-crlf', data: '0024|200|00000399|946|000001\r\n' },
  // Format C: echo seq then sale
  { label: 'ack-then-sale', ack: true, data: '0024|200|00000399|946|000001' },
  // Format D: command 100 instead of 200
  { label: 'cmd100', data: '0024|100|00000399|946|000001' },
  // Format E: command 00  
  { label: 'cmd00', data: '0020|00|00000399|946|000001' },
  // Format F: just amount, no length prefix
  { label: 'raw-amount', data: '200|00000399|946' },
  // Format G: XML style
  { label: 'xml', data: '<sale><amount>399</amount><currency>946</currency></sale>' },
  // Format H: JSON directly
  { label: 'json', data: '{"action":"sale","amount":399,"currencyCode":946}' },
  // Format I: Different length calc (length includes self)
  { label: 'len-incl-self', data: '0028|200|00000399|946|000001' },
  // Format J: STX/ETX wrapped
  { label: 'stx-etx', data: Buffer.from([0x02, ...Buffer.from('200|00000399|946'), 0x03]) },
];

let idx = 0;

function tryNext() {
  if (idx >= attempts.length) {
    console.log('\n=== ALL ATTEMPTS DONE ===');
    process.exit(0);
  }
  
  const attempt = attempts[idx];
  idx++;
  
  console.log(`\n--- Attempt ${idx}/${attempts.length}: ${attempt.label} ---`);
  
  const client = new net.Socket();
  let gotReady = false;
  let gotResponse = false;
  
  const timer = setTimeout(() => {
    console.log(`[${attempt.label}] Timeout 8s - no response after sale`);
    client.destroy();
    setTimeout(tryNext, 500);
  }, 8000);

  client.connect(port, ip, () => {
    console.log(`[${attempt.label}] Connected`);
  });

  client.on('data', (data) => {
    const str = data.toString('utf8');
    const hex = data.toString('hex').match(/.{1,2}/g).join(' ');
    console.log(`[${attempt.label}] RECV TXT: ${str}`);
    console.log(`[${attempt.label}] RECV HEX: ${hex}`);
    
    if (!gotReady && str.includes('810')) {
      gotReady = true;
      
      // If ack mode, send back the same message first
      if (attempt.ack) {
        console.log(`[${attempt.label}] Sending ACK: ${str}`);
        client.write(str);
        // Then send sale after small delay
        setTimeout(() => {
          console.log(`[${attempt.label}] SEND: ${attempt.data}`);
          client.write(attempt.data);
        }, 200);
      } else {
        console.log(`[${attempt.label}] SEND: ${typeof attempt.data === 'string' ? attempt.data : 'BINARY'}`);
        client.write(attempt.data);
      }
    } else {
      gotResponse = true;
      console.log(`[${attempt.label}] *** GOT RESPONSE! ***`);
      clearTimeout(timer);
      client.destroy();
      setTimeout(tryNext, 500);
    }
  });

  client.on('close', () => {
    if (!gotResponse && gotReady) {
      console.log(`[${attempt.label}] Connection closed by terminal (rejected format)`);
      clearTimeout(timer);
      setTimeout(tryNext, 500);
    }
  });

  client.on('error', (err) => {
    console.log(`[${attempt.label}] Error: ${err.message}`);
    clearTimeout(timer);
    setTimeout(tryNext, 500);
  });
}

console.log(`\n=== VIVA ECR PROTOCOL DISCOVERY ===`);
console.log(`Target: ${ip}:${port}`);
console.log(`Testing ${attempts.length} different formats...\n`);
tryNext();
