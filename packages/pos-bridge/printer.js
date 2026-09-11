const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
let getBrandLogoBuffer = null;
try {
  ({ getBrandLogoBuffer } = require('./brandLogos'));
} catch (_) {}

function getActualPrinterName() {
  const configured = process.env.PRINTER_NAME;
  try {
    const psCmd = 'Get-Printer | Select-Object Name, PortName, PrinterStatus | ConvertTo-Json -Compress';
    const raw = execSync(`powershell -NoProfile -Command "${psCmd}"`, { timeout: 6000 }).toString().trim();
    if (raw) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      
      const epsonPrinters = list.filter(p => p && p.Name && /epson|tm-t|receipt/i.test(p.Name));
      
      // 1. Căutăm imprimanta funcțională de pe USB fizic (ex: EPSON TM-T(203dpi) Receipt6 pe USB006)
      const physicalUsbPrinter = epsonPrinters.find(p => 
        (/receipt6/i.test(p.Name) || /^USB\d+/i.test(p.PortName || '')) &&
        p.PrinterStatus !== 'Error' && p.PrinterStatus !== 1 && p.PrinterStatus !== 2
      );
      
      // 2. Căutăm o imprimantă sănătoasă
      const healthyEpson = epsonPrinters.find(p => 
        p.PrinterStatus !== 'Error' && p.PrinterStatus !== 1 && p.PrinterStatus !== 2
      );
      
      const isErr = (status) => {
        const s = String(status || '').toLowerCase();
        return s.includes('error') || s === '1' || s === '2' || s === '3';
      };

      const configuredPrinter = list.find(p => p && p.Name === configured);
      const configuredHasError = configuredPrinter && isErr(configuredPrinter.PrinterStatus);
      
      if (configuredHasError) {
        console.warn(`[Printer] ⚠ Imprimanta configurată "${configured}" este în stare de EROARE pe Windows!`);
        if (physicalUsbPrinter) {
          console.log(`[Printer] 🔄 Folosesc imprimanta fizică sănătoasă (${physicalUsbPrinter.PortName}): "${physicalUsbPrinter.Name}"`);
          return physicalUsbPrinter.Name;
        }
        if (healthyEpson) {
          console.log(`[Printer] 🔄 Folosesc imprimanta funcțională: "${healthyEpson.Name}"`);
          return healthyEpson.Name;
        }
      }
      
      // Dacă imprimanta configurată în .env este instalată și fără erori, o folosim cu prioritate
      if (configured && list.some(p => p.Name === configured) && !configuredHasError) {
        return configured;
      }

      if (physicalUsbPrinter) {
        return physicalUsbPrinter.Name;
      }
      
      if (healthyEpson) {
        return healthyEpson.Name;
      }
      
      if (epsonPrinters.length > 0) return epsonPrinters[0].Name;
    }
  } catch (_) {
    try {
      const rawNames = execSync('powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"', { timeout: 4000 }).toString();
      const names = rawNames.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const r6 = names.find(n => /receipt6/i.test(n));
      if (r6) return r6;
      if (configured && names.includes(configured)) return configured;
      const match = names.find(name => /epson/i.test(name) || /tm-t/i.test(name) || /receipt/i.test(name));
      if (match) return match;
    } catch (_) {}
  }
  return configured || 'EPSON TM-T20';
}

let printerDriver;
try {
  printerDriver = require('@thiagoelg/node-printer');
  console.log('[Printer] ✅ Driver nativ găsit.');
} catch (e) {
  console.log('[Printer] ⚠ Driver nativ nu e instalat — voi folosi metoda PowerShell (raw print).');
}

async function printTicket(order) {
  const PRINTER_NAME = getActualPrinterName();
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

       let logoPrinted = false;
       if (getBrandLogoBuffer) {
         try {
           const logoBuf = getBrandLogoBuffer(brand);
           if (logoBuf) {
             await printer.printImageBuffer(logoBuf);
             logoPrinted = true;
           }
         } catch (logoErr) {
           console.warn(`[Printer] Nu am putut tipări logo-ul pentru ${brand}:`, logoErr.message);
         }
       }

       if (!logoPrinted) {
         printer.bold(true);
         printer.setTextDoubleHeight();
         printer.println(brandName);
         printer.bold(false);
         printer.setTextNormal();
       }
    }
    
    // Kiosk label (Kiosk 1 or Kiosk 2) — replaces location name
    let kioskLabel = 'Kiosk 1';
    const numMatch = String(order.orderNumber || '').match(/^[a-zA-Z]+(\d+)-/);
    if (numMatch && numMatch[1]) {
      kioskLabel = `Kiosk ${numMatch[1]}`;
    } else if (order.kioskId) {
      const kDigits = String(order.kioskId).replace(/[^0-9]/g, '');
      kioskLabel = `Kiosk ${kDigits || '1'}`;
    } else if (order.locationId && String(order.locationId).includes('2')) {
      kioskLabel = 'Kiosk 2';
    }
    printer.println(kioskLabel);
    
    printer.newLine();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(`Comanda #${order.orderNumber || '?'}`);
    printer.bold(false);
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
    
    // If using file interface, send the file to the Windows printer
    if (!printerDriver && fs.existsSync(tempFile)) {
      console.log(`[Printer] 🎯 Trimit la imprimantă: "${PRINTER_NAME}" | Fișier: ${tempFile} (${fs.statSync(tempFile).size} bytes)`);
      
      const shareName = 'EPSON_RAW';
      // 1. Asigurăm partajarea imprimantei pentru trimitere directă RAW (by-pass driver)
      try {
        execSync(`powershell -NoProfile -Command "Set-Printer -Name '${PRINTER_NAME}' -Shared $true -ShareName '${shareName}' -ErrorAction SilentlyContinue"`, { timeout: 5000 });
      } catch (_) {}

      // 2. Deblocăm coada Windows de orice joburi anterioare blocate (ex: Test Page)
      try {
        execSync(`powershell -NoProfile -Command "Get-PrintJob -PrinterName '${PRINTER_NAME}' -ErrorAction SilentlyContinue | Where-Object { $_.JobStatus -like '*Error*' -or $_.JobStatus -like '*Blocked*' -or $_.JobStatus -like '*Deleting*' } | Remove-PrintJob -ErrorAction SilentlyContinue"`, { timeout: 5000 });
      } catch (_) {}

      // Metoda 1: Trimitere directă RAW către Spooler Share (100% nativ Windows, fără compilare C#)
      try {
        execSync(`cmd.exe /c "copy /b \\"${tempFile}\\" \\"\\\\127.0.0.1\\${shareName}\\""`, { timeout: 8000 });
        console.log(`[Printer] ✅ Bon printat via RAW Spooler (Share) pentru comanda #${order.orderNumber || '?'}`);
        return { status: 'success', method: 'raw_share', printerName: PRINTER_NAME, receiptContent };
      } catch (shareErr) {
        console.warn(`[Printer] ⚠ RAW Share: ${shareErr.message}. Încerc WinSpool...`);
      }

      // Metoda 2: WinSpool P/Invoke via rawprint.ps1
      try {
        const scriptPath = path.join(__dirname, 'rawprint.ps1');
        const psCmd = `& '${scriptPath}' -PrinterName '${PRINTER_NAME}' -FilePath '${tempFile}'`;
        const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { timeout: 12000 }).toString().trim();
        console.log(`[Printer] WinSpool rezultat: "${result}"`);
        if (result.includes('OK')) {
          console.log(`[Printer] ✅ Bon printat via WinSpool pentru comanda #${order.orderNumber || '?'}`);
          return { status: 'success', method: 'winspool', printerName: PRINTER_NAME, receiptContent };
        }
      } catch (psErr) {
        console.warn(`[Printer] ⚠ WinSpool: ${psErr.message}`);
      }

      // Metoda 3: COPY către localhost printer name
      try {
        execSync(`cmd.exe /c "copy /b \\"${tempFile}\\" \\"\\\\localhost\\${PRINTER_NAME}\\""`, { timeout: 8000 });
        console.log(`[Printer] ✅ Bon printat prin COPY localhost pentru comanda #${order.orderNumber || '?'}`);
        return { status: 'success', method: 'copy', printerName: PRINTER_NAME, receiptContent };
      } catch (copyErr) {
        console.warn(`[Printer] ⚠ COPY: ${copyErr.message}`);
      }

      // Metoda 4: direct Out-Printer
      try {
        execSync(`powershell -NoProfile -Command "Get-Content -Encoding Byte -Path '${tempFile}' | Out-Printer -Name '${PRINTER_NAME}'"`, { timeout: 10000 });
        console.log(`[Printer] ✅ Bon printat prin Out-Printer pentru comanda #${order.orderNumber || '?'}`);
        return { status: 'success', method: 'out-printer', printerName: PRINTER_NAME, receiptContent };
      } catch (outErr) {
        console.error(`[Printer] ❌ Toate metodele au eșuat. Share: failed | Out-Printer: ${outErr.message}`);
        return { status: 'error', method: 'failed', printerName: PRINTER_NAME, error: outErr.message, receiptContent };
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

module.exports = { printTicket, getActualPrinterName };
