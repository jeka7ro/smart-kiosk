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
    
    const uniqueBrands = [...new Set((order.items || []).map(i => i.brandId || order.brand || 'KIOSK'))];
    for (const brand of uniqueBrands) {
       let brandName = (brand || 'KIOSK').toUpperCase();
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
    printer.println(`Comanda #${order.orderNumber || '?'}`);
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
    
    (order.items || []).forEach(item => {
      const price = Number(item.totalPrice || item.price || 0);
      printer.tableCustom([
        { text: `${item.quantity || 1}x ${item.name || '?'}`, align: "LEFT", width: 0.75 },
        { text: `${price.toFixed(2)} RON`, align: "RIGHT", width: 0.25 }
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
    printer.println(`TOTAL: ${Number(order.totalAmount || 0).toFixed(2)} RON`);
    printer.bold(false);
    
    printer.newLine();
    printer.newLine();
    printer.alignCenter();
    const date = new Date().toLocaleString('ro-RO');
    printer.println(date);
    
    printer.cut();
    
    // Extract raw ESC/POS buffer and write manually (bypass library's file interface)
    if (!printerDriver) {
      const buffer = printer.getBuffer();
      fs.writeFileSync(tempFile, buffer);
      printer.clear();
      console.log(`[Printer] Buffer scris manual: ${tempFile} (${buffer.length} bytes)`);
    } else {
      await printer.execute();
    }

    // Build receipt content for logging (safe — never blocks printing)
    let receiptContent = null;
    try {
      receiptContent = {
        brands: [...new Set((order.items || []).map(i => i.brandId || order.brand || ''))],
        orderNumber: order.orderNumber || '',
        paymentMethod: order.paymentMethod || '',
        orderType: order.orderType || '',
        items: (order.items || []).map(i => ({
          name: i.name || '',
          qty: i.quantity || 1,
          price: i.totalPrice || i.price || 0,
          modifiers: (i.selectedModifiers || []).map(m => m.optionName || m.name || 'Extra'),
        })),
        total: order.totalAmount || 0,
        date,
      };
    } catch (_) { receiptContent = null; }
    
    // If using file interface, send the file to the Windows printer via PowerShell WinSpool script
    if (!printerDriver && fs.existsSync(tempFile)) {
      console.log(`[Printer] 🎯 Trimit la imprimantă: "${PRINTER_NAME}" | Fișier: ${tempFile} (${fs.statSync(tempFile).size} bytes)`);
      let method = 'winspool';
      try {
        const scriptPath = path.join(__dirname, 'rawprint.ps1');
        const psCmd = `& '${scriptPath}' -PrinterName '${PRINTER_NAME}' -FilePath '${tempFile}'`;
        const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { timeout: 15000 }).toString().trim();
        console.log(`[Printer] WinSpool rezultat: "${result}"`);
        if (result.includes('OK')) {
          console.log(`[Printer] ✅ Bon printat via WinSpool (PowerShell) pentru comanda #${order.orderNumber || '?'}`);
          return { status: 'success', method: 'winspool', printerName: PRINTER_NAME, receiptContent };
        } else {
          throw new Error(`Scriptul rawprint a returnat: ${result}`);
        }
      } catch (psErr) {
        console.error(`[Printer] ⚠ WinSpool eșuat: ${psErr.message}`);
        // Fallback 2: try COPY /B to printer share
        try {
          execSync(`COPY /B "${tempFile}" "\\\\localhost\\${PRINTER_NAME}"`, { timeout: 10000 });
          console.log(`[Printer] ✅ Bon printat prin COPY pentru comanda #${order.orderNumber || '?'}`);
          return { status: 'success', method: 'copy', printerName: PRINTER_NAME, receiptContent };
        } catch (copyErr) {
          console.error(`[Printer] ⚠ COPY eșuat: ${copyErr.message}`);
          // Fallback 3: direct PowerShell Out-Printer
          try {
            execSync(`powershell -NoProfile -Command "Get-Content -Encoding Byte -Path '${tempFile}' | Out-Printer -Name '${PRINTER_NAME}'"`, { timeout: 15000 });
            console.log(`[Printer] ✅ Bon printat prin Out-Printer pentru comanda #${order.orderNumber || '?'}`);
            return { status: 'success', method: 'out-printer', printerName: PRINTER_NAME, receiptContent };
          } catch (outErr) {
            console.error(`[Printer] ❌ Toate metodele au eșuat. WinSpool: ${psErr.message} | COPY: ${copyErr.message} | Out-Printer: ${outErr.message}`);
            return { status: 'error', method: 'winspool+copy+out-printer', printerName: PRINTER_NAME, error: `WinSpool: ${psErr.message}`, receiptContent };
          }
        }
      } finally {
        try { fs.unlinkSync(tempFile); } catch (_) {}
      }
    } else if (printerDriver) {
      console.log(`[Printer] ✅ Bon printat cu succes pentru comanda #${order.orderNumber}`);
      return { status: 'success', method: 'driver', printerName: PRINTER_NAME, receiptContent };
    }

    return { status: 'success', method: 'unknown', printerName: PRINTER_NAME, receiptContent };
  } catch (error) {
    const errMsg = error?.message || error?.toString() || String(error) || 'Eroare necunoscută';
    console.error("[Printer] Eroare la printare:", errMsg);
    try { fs.unlinkSync(tempFile); } catch (_) {}
    return { status: 'error', method: 'unknown', printerName: PRINTER_NAME, error: errMsg };
  }
}

module.exports = { printTicket };
