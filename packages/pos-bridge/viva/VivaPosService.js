/**
 * VivaPosService - Viva Wallet PAX ECR Protocol (pipe-delimited TCP)
 * Protocol: LENGTH|CMD|FIELDS...
 * CMD 810 = Terminal Ready, CMD 200 = Sale Request, CMD 210 = Sale Response
 */
const net = require('net');

class VivaPosService {
  constructor(ip, port = 8080) {
    this.ip = ip;
    this.port = port;
  }

  /**
   * Build ECR message: 4-digit length prefix + pipe-delimited fields
   */
  _buildMessage(fields) {
    const payload = '|' + fields.join('|');
    const len = payload.length.toString().padStart(4, '0');
    return len + payload;
  }

  /**
   * Parse ECR response
   */
  _parseResponse(data) {
    const str = data.toString('utf8').trim();
    console.log(`[Viva ECR] Raw response: ${str}`);
    
    // Format: LENGTH|CMD|FIELD1|FIELD2|...
    const parts = str.split('|');
    if (parts.length < 2) return { raw: str };
    
    return {
      length: parts[0],
      cmd: parts[1],
      fields: parts.slice(2),
      raw: str
    };
  }

  /**
   * Initiates a sale transaction
   */
  async processPayment(amount) {
    if (!amount || amount <= 0) throw new Error('Invalid payment amount');
    if (!this.ip) throw new Error('Viva POS IP is not configured');

    const amountInCents = Math.round(amount * 100);
    const amountStr = amountInCents.toString().padStart(8, '0');
    const ref = Date.now().toString().slice(-6);

    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let responseBuffer = '';
      let readyReceived = false;
      let saleResponseReceived = false;
      
      const timeout = setTimeout(() => {
        console.log('[Viva ECR] Timeout after 120 seconds');
        client.destroy();
        reject(new Error('POS timeout (120s)'));
      }, 120000);

      client.connect(this.port, this.ip, () => {
        console.log(`[Viva ECR] Connected to ${this.ip}:${this.port}`);
      });

      client.on('data', (data) => {
        const str = data.toString('utf8');
        console.log(`[Viva ECR] RECV: ${str}`);
        
        const parsed = this._parseResponse(data);
        
        if (parsed.cmd === '810' && !readyReceived) {
          // Terminal Ready - send sale command
          readyReceived = true;
          console.log(`[Viva ECR] Terminal ready. Sending SALE for ${amount} RON (${amountInCents} cents)...`);
          
          // Try sale command: 200|amount|currency(946=RON)|reference
          const saleMsg = this._buildMessage(['200', amountStr, '946', ref]);
          console.log(`[Viva ECR] SEND: ${saleMsg}`);
          client.write(saleMsg);
        } 
        else if (parsed.cmd === '210' || parsed.cmd === '200') {
          // Sale response
          saleResponseReceived = true;
          clearTimeout(timeout);
          
          const status = parsed.fields[0] || '';
          const approved = status === '00' || status === '0000';
          
          console.log(`[Viva ECR] Sale response: status=${status}, approved=${approved}`);
          console.log(`[Viva ECR] Full response fields: ${JSON.stringify(parsed.fields)}`);
          
          client.destroy();
          resolve({
            success: approved,
            authCode: parsed.fields[1] || '',
            refNum: parsed.fields[2] || '',
            receiptNo: parsed.fields[3] || '',
            cardNo: parsed.fields[4] || '',
            code: status,
            reason: approved ? '' : `Tranzacție refuzată (cod: ${status})`,
            raw: str,
            extraFields: parsed.fields
          });
        }
        else if (parsed.cmd === '820') {
          // Display message from terminal
          console.log(`[Viva ECR] Terminal display: ${parsed.fields.join(' ')}`);
        }
        else if (parsed.cmd === '900' || parsed.cmd === '999') {
          // Error from terminal
          clearTimeout(timeout);
          client.destroy();
          const errMsg = parsed.fields.join(' ') || 'Terminal error';
          console.log(`[Viva ECR] Terminal error: ${errMsg}`);
          resolve({
            success: false,
            code: parsed.cmd,
            reason: errMsg,
            raw: str
          });
        }
        else {
          // Unknown command - log it and try to interpret
          console.log(`[Viva ECR] Unknown CMD ${parsed.cmd}, fields: ${JSON.stringify(parsed.fields)}`);
          
          // If we already sent sale, any response might be the result
          if (readyReceived && !saleResponseReceived) {
            // Check if any field looks like approval status
            const allFields = [parsed.cmd, ...parsed.fields];
            console.log(`[Viva ECR] Treating as possible sale response. All parts: ${JSON.stringify(allFields)}`);
          }
        }
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[Viva ECR] Connection error: ${err.message}`);
        reject(err);
      });

      client.on('close', () => {
        clearTimeout(timeout);
        if (!saleResponseReceived && readyReceived) {
          console.log('[Viva ECR] Connection closed before sale response');
          reject(new Error('Connection closed by terminal before response'));
        }
      });
    });
  }

  async checkStatus() {
    return new Promise((resolve) => {
      const client = new net.Socket();
      client.setTimeout(5000);
      client.connect(this.port, this.ip, () => {
        client.destroy();
        resolve(true);
      });
      client.on('error', () => resolve(false));
      client.on('timeout', () => { client.destroy(); resolve(false); });
    });
  }
}

module.exports = VivaPosService;
