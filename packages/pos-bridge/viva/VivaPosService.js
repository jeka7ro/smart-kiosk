/**
 * VivaPosService - Handles communication with Viva Wallet PAX terminals.
 * Uses the Local Terminal API (Peer-to-Peer) on port 8080.
 */
const http = require('http');

class VivaPosService {
  constructor(ip, port = 8080) {
    this.ip = ip;
    this.port = port;
  }

  /**
   * Initiates a sale transaction on the Viva POS terminal
   * @param {number} amount - Amount in RON (e.g. 25.50)
   * @returns {Promise<Object>} The transaction result
   */
  async processPayment(amount) {
    if (!amount || amount <= 0) throw new Error('Invalid payment amount');
    if (!this.ip) throw new Error('Viva POS IP is not configured');

    // Viva API expects amount in cents
    const amountInCents = Math.round(amount * 100);

    const payload = JSON.stringify({
      amount: amountInCents,
      currencyCode: 946, // RON
      merchantReference: `kiosk-${Date.now()}`,
      tipAmount: 0,
      preauth: false,
      maxInstalments: 0
    });

    // Try multiple endpoint paths
    const endpoints = [
      '/pos/v1/sale',
      '/v1/sale', 
      '/api/v1/sale',
      '/sale',
      '/'
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`[Viva POS] Trying ${endpoint} on ${this.ip}:${this.port}...`);
        const result = await this._httpPost(endpoint, payload);
        console.log(`[Viva POS] SUCCESS on ${endpoint}:`, result);
        
        // Parse response
        let data;
        try { data = JSON.parse(result); } catch { data = { raw: result }; }

        return {
          success: true,
          authCode: data.AuthCode || data.authCode || data.auth_code || '',
          refNum: data.RRN || data.rrn || data.retrievalReferenceNumber || '',
          receiptNo: data.TID || data.tid || data.terminalId || '',
          cardNo: data.Pan || data.pan || data.cardNumber || '',
          raw: data
        };
      } catch (err) {
        console.log(`[Viva POS] ${endpoint} failed: ${err.message}`);
        lastError = err;
        
        // If we got a response (HTTP error, not connection error), use this endpoint
        if (err.statusCode) {
          console.log(`[Viva POS] Got HTTP ${err.statusCode} from ${endpoint} — endpoint exists but returned error`);
          console.log(`[Viva POS] Response body: ${err.body}`);
          throw new Error(`POS error ${err.statusCode}: ${err.body}`);
        }
      }
    }

    throw lastError || new Error('All endpoints failed');
  }

  /**
   * HTTP POST using Node's http module (more reliable than fetch on older Node)
   */
  _httpPost(path, body) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.ip,
        port: this.port,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 65000
      };

      console.log(`[Viva POS] HTTP POST http://${this.ip}:${this.port}${path}`);

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log(`[Viva POS] Response ${res.statusCode}: ${data.substring(0, 500)}`);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            const err = new Error(`HTTP ${res.statusCode}: ${data}`);
            err.statusCode = res.statusCode;
            err.body = data;
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        console.error(`[Viva POS] Connection error: ${err.code || err.message}`);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timeout (65s)'));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Checks the status of the terminal
   */
  async checkStatus() {
    return new Promise((resolve) => {
      const req = http.get(`http://${this.ip}:${this.port}/`, { timeout: 5000 }, (res) => {
        resolve(true);
        res.resume();
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }
}

module.exports = VivaPosService;
