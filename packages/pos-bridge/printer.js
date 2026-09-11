const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PRINTER_NAME = process.env.PRINTER_NAME || 'EPSON TM-T20II Receipt';

let printerDriver;
try {
  printerDriver = require('@thiagoelg/node-printer');
  console.log('[Printer] ✅ Driver nativ găsit.');
} catch (e) {
  console.log('[Printer] ⚠ Driver nativ nu e instalat — voi folosi metoda PowerShell (raw print).');
}

async function printTicket(order) {
  // Build the ESC/POS content using node-thermal-printer
  const tempFile = path.join(os.tmpdir(), `ticket_${Date.now()}.bin`);
  
  let printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: printerDriver ? `printer:${PRINTER_NAME}` : `file:${tempFile}`,
    driver: printerDriver || undefined,
    characterSet: CharacterSet.PC852_LATIN2,
    removeSpecialCharacters: false,
    lineCharacter: "-",
    breakLine: BreakLine.WORD,
    options: {
      timeout: 5000
    }
  });

  try {
    // Skip connection check if using file interface
    if (printerDriver) {
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) {
        console.error(`[Printer] Nu ma pot conecta la imprimanta: ${PRINTER_NAME}`);
        return;
      }
    }

    printer.alignCenter();
    
    const uniqueBrands = [...new Set(order.items.map(i => i.brandId || order.brand))];
    for (const brand of uniqueBrands) {
       let brandName = brand.toUpperCase();
       if (brandName === 'ROLLMASTER') {
           brandName = 'ROLL-MASTER';
       }
       // Fallback text
       printer.bold(true);
       printer.setTextSize(2,2);
       printer.println(brandName);
       printer.bold(false);
       printer.setTextNormal();
    }
    
    printer.newLine();
    printer.bold(true);
    printer.setTextSize(2,2);
    printer.println(`Comanda #${order.orderNumber}`);
    printer.setTextNormal();
    printer.newLine();

    if (order.paymentMethod === 'cash') {
       printer.bold(true);
       printer.println("NEACHITAT - ACHITATI LA CASA");
       printer.bold(false);
    } else {
       printer.bold(true);
       printer.println("ACHITAT CARD POS");
       printer.bold(false);
    }
    
    printer.newLine();
    printer.setTextSize(1,1);
    printer.bold(true);
    if (order.orderType === 'takeaway') {
        printer.println("LA PACHET");
    } else {
        printer.println("LA MASA");
    }
    printer.bold(false);
    printer.setTextNormal();
    
    printer.newLine();
    printer.alignLeft();
    printer.println("Produse:");
    printer.drawLine();
    
    order.items.forEach(item => {
      printer.tableCustom([
        { text: `${item.quantity}x ${item.name}`, align: "LEFT", width: 0.75 },
        { text: `${(item.totalPrice || item.price || 0).toFixed(2)} RON`, align: "RIGHT", width: 0.25 }
      ]);
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        item.selectedModifiers.forEach(mod => {
          const modName = mod.optionName || mod.modifierName || mod.name || 'Extra';
          printer.println(`  + ${modName}`);
        });
      }
    });
    
    printer.drawLine();
    printer.alignRight();
    printer.bold(true);
    printer.println(`TOTAL: ${order.totalAmount.toFixed(2)} RON`);
    printer.bold(false);
    
    printer.newLine();
    printer.newLine();
    printer.alignCenter();
    const date = new Date().toLocaleString('ro-RO');
    printer.println(date);
    
    printer.cut();
    
    await printer.execute();
    
    // If using file interface, send the file to the Windows printer via PowerShell
    if (!printerDriver && fs.existsSync(tempFile)) {
      try {
        const psCmd = `Get-Content -Encoding Byte -Path '${tempFile}' | Out-Printer -Name '${PRINTER_NAME}'`;
        execSync(`powershell -Command "${psCmd}"`, { timeout: 10000 });
        console.log(`[Printer] ✅ Bon printat prin PowerShell pentru comanda #${order.orderNumber}`);
      } catch (psErr) {
        // Fallback: try COPY /B to printer share
        try {
          execSync(`COPY /B "${tempFile}" "\\\\localhost\\${PRINTER_NAME}"`, { timeout: 10000 });
          console.log(`[Printer] ✅ Bon printat prin COPY pentru comanda #${order.orderNumber}`);
        } catch (copyErr) {
          console.error(`[Printer] ❌ Eroare la printare (PowerShell + COPY): ${psErr.message}`);
        }
      } finally {
        try { fs.unlinkSync(tempFile); } catch (_) {}
      }
    } else if (printerDriver) {
      console.log(`[Printer] ✅ Bon printat cu succes pentru comanda #${order.orderNumber}`);
    }
  } catch (error) {
    console.error("[Printer] Eroare la printare:", error);
    try { fs.unlinkSync(tempFile); } catch (_) {}
  }
}

module.exports = { printTicket };
