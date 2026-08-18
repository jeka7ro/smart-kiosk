const { SerialPort } = require('serialport');

/**
 * PrinterService - Handles Serial (COM) communication cu Datecs FP950
 * folosit ca imprimanta de sectie/bucatarie (NON-FISCAL).
 */
class PrinterServiceDatecsFP950 {
  constructor(portName = 'COM1', baudRate = 9600) {
    this.portName = portName;
    this.baudRate = baudRate;
  }

  encodeText(text) {
    return text
      .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i').replace(/ș/g, 's').replace(/ț/g, 't')
      .replace(/Ă/g, 'A').replace(/Â/g, 'A').replace(/Î/g, 'I').replace(/Ș/g, 'S').replace(/Ț/g, 'T');
  }

  generateReceiptBuffer(order) {
    const ESC = 0x1B;
    const GS = 0x1D;
    
    let buffers = [];
    
    // Init
    buffers.push(Buffer.from([ESC, 0x40]));
    
    // Title
    buffers.push(Buffer.from([ESC, 0x61, 0x01])); // Center
    buffers.push(Buffer.from([ESC, 0x45, 0x01])); // Bold
    buffers.push(Buffer.from([GS, 0x21, 0x11]));  // Double W/H
    buffers.push(Buffer.from(`COMANDA #${order.orderNumber}\n\n`));
    
    // Reset
    buffers.push(Buffer.from([GS, 0x21, 0x00]));
    buffers.push(Buffer.from([ESC, 0x45, 0x00]));
    buffers.push(Buffer.from([ESC, 0x61, 0x00]));
    
    // Details
    buffers.push(Buffer.from(`Tip: ${order.orderType === 'dine-in' ? 'LA MASA' : 'LA PACHET'}\n`));
    if (order.tableNumber) buffers.push(Buffer.from(`Masa: ${order.tableNumber}\n`));
    buffers.push(Buffer.from(`Data: ${new Date().toLocaleString('ro-RO')}\n`));
    buffers.push(Buffer.from('--------------------------------\n\n'));
    
    // Items
    if (order.items && order.items.length) {
      order.items.forEach(item => {
        const name = this.encodeText(item.name || 'Produs');
        const qty = item.quantity || 1;
        buffers.push(Buffer.from(`${qty}x ${name}\n`));
        
        if (item.selectedModifiers && item.selectedModifiers.length) {
          item.selectedModifiers.forEach(mod => {
            const modName = this.encodeText(mod.optionName || mod.modifierName);
            buffers.push(Buffer.from(`   + ${modName}\n`));
          });
        }
      });
    }
    
    buffers.push(Buffer.from('\n--------------------------------\n'));
    buffers.push(Buffer.from([ESC, 0x45, 0x01]));
    buffers.push(Buffer.from([ESC, 0x61, 0x02]));
    buffers.push(Buffer.from(`TOTAL: ${(order.totalAmount || 0).toFixed(2)} LEI\n\n\n\n\n`));
    
    // Cut
    buffers.push(Buffer.from([GS, 0x56, 0x41, 0x00]));
    
    return Buffer.concat(buffers);
  }

  async printOrder(order) {
    if (!this.portName) throw new Error('Printer COM Port is not configured');
    
    return new Promise((resolve, reject) => {
      const port = new SerialPort({
        path: this.portName,
        baudRate: this.baudRate,
        autoOpen: false
      });
      
      const payload = this.generateReceiptBuffer(order);
      
      port.open((err) => {
        if (err) {
          console.error(`[Printer Datecs] Nu am putut deschide portul ${this.portName}:`, err.message);
          return reject(err);
        }
        
        console.log(`[Printer Datecs] Trimit bonul către imprimanta pe ${this.portName}...`);
        
        port.write(payload, (err) => {
          if (err) {
            console.error(`[Printer Datecs] Eroare la scriere pe ${this.portName}:`, err.message);
            port.close();
            return reject(err);
          }
          
          port.drain(() => {
            console.log(`[Printer Datecs] Bon tiparit cu succes.`);
            port.close();
            resolve(true);
          });
        });
      });
    });
  }
}

module.exports = PrinterServiceDatecsFP950;
