require('dotenv').config();
const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const path = require('path');
const fs = require('fs');

const PRINTER_NAME = process.env.PRINTER_NAME || 'EPSON TM-T20';

let printerDriver;
try {
  printerDriver = require('@thiagoelg/node-printer');
} catch (e) {
  console.log('[Test Printer] Driverul nativ nu este instalat. Te rugam ruleaza npm install @thiagoelg/node-printer');
}

async function runTest() {
  console.log(`[Test Printer] Incerc conectarea la imprimanta: ${PRINTER_NAME}...`);
  
  let printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `printer:${PRINTER_NAME}`,
    driver: printerDriver,
    characterSet: CharacterSet.PC852_LATIN2,
    removeSpecialCharacters: false,
    lineCharacter: "-",
    breakLine: BreakLine.WORD,
    options: {
      timeout: 5000
    }
  });

  try {
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      console.error(`[Test Printer] EROARE: Nu ma pot conecta la imprimanta! Verifica numele in fisierul .env.`);
      return;
    }
    console.log('[Test Printer] Conexiune reusita! Trimit documentul de test...');

    printer.alignCenter();
    
    // Printeaza logoul de test
    const testLogo = path.join(__dirname, 'assets', 'logos', `smashme.png`);
    if (fs.existsSync(testLogo)) {
      console.log('[Test Printer] Printez logo-ul de proba pentru a testa driverul...');
      await printer.printImage(testLogo);
    } else {
      printer.bold(true);
      printer.setTextSize(2,2);
      printer.println("SMASHME (TEST)");
      printer.setTextNormal();
    }
    
    printer.newLine();
    printer.bold(true);
    printer.println("Test de printare efectuat cu succes!");
    printer.bold(false);
    printer.newLine();
    printer.drawLine();
    printer.println("Daca bonul acesta e scurt si poza se vede bine,");
    printer.println("inseamna ca totul e configurat corect in Windows!");
    printer.drawLine();
    printer.newLine();
    printer.newLine();
    
    printer.cut();
    await printer.execute();
    
    console.log('[Test Printer] Gata! Verifica imprimanta.');

  } catch (err) {
    console.error('[Test Printer] Eroare neasteptata:', err);
  }
}

runTest();
