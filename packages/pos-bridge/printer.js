const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const path = require('path');
const fs = require('fs');

const PRINTER_NAME = process.env.PRINTER_NAME || 'EPSON TM-T20II Receipt';

async function printTicket(order) {
  let printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `printer:${PRINTER_NAME}`,
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
      console.error(`[Printer] Nu ma pot conecta la imprimanta: ${PRINTER_NAME}`);
      return;
    }

    printer.alignCenter();
    
    // Print brand logos based on order.items
    const uniqueBrands = [...new Set(order.items.map(i => i.brandId || order.brand))];
    for (const brand of uniqueBrands) {
       const logoPath = path.join(__dirname, 'assets', 'logos', `${brand}.png`);
       if (fs.existsSync(logoPath)) {
         await printer.printImage(logoPath);
       } else {
         // Fallback text if logo missing
         printer.bold(true);
         printer.setTextSize(1,1);
         printer.println(brand.toUpperCase());
         printer.bold(false);
         printer.setTextNormal();
       }
    }
    
    printer.newLine();
    printer.bold(true);
    printer.setTextSize(2,2);
    printer.println(`Comanda #${order.orderNumber}`);
    printer.setTextNormal();
    printer.newLine();

    if (order.paymentMethod === 'cash') {
       printer.invert(true);
       printer.bold(true);
       printer.println(" NEACHITAT - ACHITATI LA CASA ");
       printer.invert(false);
       printer.bold(false);
    } else {
       printer.println("ACHITAT CARD POS");
    }
    
    printer.newLine();
    printer.alignLeft();
    printer.println("Produse:");
    printer.drawLine();
    
    order.items.forEach(item => {
      printer.tableCustom([
        { text: `${item.quantity}x ${item.name}`, align: "LEFT", width: 0.75 },
        { text: `${item.totalPrice.toFixed(2)} RON`, align: "RIGHT", width: 0.25 }
      ]);
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        item.selectedModifiers.forEach(mod => {
          printer.println(`  + ${mod.name}`);
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
    console.log(`[Printer] Bon printat cu succes pentru comanda #${order.orderNumber}`);
  } catch (error) {
    console.error("[Printer] Eroare la printare:", error);
  }
}

module.exports = { printTicket };
