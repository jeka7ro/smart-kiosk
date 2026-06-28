const RaiffeisenEcrService = require('./src/services/raiffeisenEcrService');

// Preluăm parametrii din linia de comandă, cu valori implicite dacă lipsesc
const ip = process.argv[2];
const port = process.argv[3] ? parseInt(process.argv[3]) : 1000;
const amountStr = process.argv[4] || '1'; // suma implicită: 1 RON

if (!ip) {
  console.error('\n❌ Eroare: Nu ai specificat adresa IP a POS-ului!');
  console.log('\n👉 Utilizare: node test-raiff-pos.js <IP_POS> [PORT_POS] [SUMA_IN_RON]');
  console.log('Exemplu: node test-raiff-pos.js 192.168.1.150 1000 1.50\n');
  process.exit(1);
}

const amount = parseFloat(amountStr);

console.log('===================================================');
console.log(`📡 Inițializare test comunicare POS Raiffeisen`);
console.log(`📍 IP: ${ip} | 🔌 Port: ${port}`);
console.log(`💳 Sumă de plată: ${amount.toFixed(2)} RON`);
console.log('===================================================\n');

const ecr = new RaiffeisenEcrService(ip, port);

async function runTest() {
  try {
    console.log('⏱️ Trimit comanda de plată către POS...');
    
    // Așteptăm răspunsul de la POS. Promisiunea se va rezolva doar la finalul tranzacției.
    const result = await ecr.processPayment(amount);
    
    console.log('\n✅ ================================================');
    console.log('Tranzacția s-a încheiat cu succes din perspectiva comunicării!');
    console.log('Răspuns primit de la bancă/POS:', result);
    
    if (result.success) {
      console.log('🎉 PLATA A FOST APROBATĂ!');
    } else {
      console.log(`⚠️ PLATA A FOST RESPINSĂ: ${result.reason} (Cod: ${result.code})`);
    }
    console.log('===================================================\n');
    
  } catch (error) {
    console.error('\n❌ ================================================');
    console.error('Eroare pe parcursul comunicării cu POS-ul:');
    console.error(error.message);
    console.error('===================================================\n');
  }
}

runTest();
