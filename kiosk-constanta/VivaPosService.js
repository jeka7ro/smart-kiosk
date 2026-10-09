/**
 * VivaPosService - Viva Wallet Local Terminal API (P2P)
 * Based on: https://developer.viva.com/apis-for-point-of-sale/card-terminals-devices/peer-to-peer-communication/
 * 
 * Protocol: HTTPS REST API (self-signed cert)
 * Endpoint: POST /pos/v1/sale
 * No authentication needed in closed network.
 */
const https = require('https');
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

    // Viva API expects amount in cents (integer)
    const amountInCents = Math.round(amount * 100);

    const payload = JSON.stringify({
      amount: amountInCents,
      currencyCode: 946,  // RON
      merchantReference: `kiosk-${Date.now()}`,
      tipAmount: 0,
      preauth: false,
      maxInstalments: 0
    });

    console.log(`[Viva POS] Initiating sale: ${amount} RON (${amountInCents} cents)`);

    // Try HTTPS first (per Viva documentation), then HTTP as fallback
    let result;
    try {
      console.log(`[Viva POS] Trying HTTPS POST https://${this.ip}:${this.port}/pos/v1/sale`);
      result = await this._request(true, '/pos/v1/sale', payload);
    } catch (httpsErr) {
      console.log(`[Viva POS] HTTPS failed: ${httpsErr.message}`);
      try {
        console.log(`[Viva POS] Trying HTTP POST http://${this.ip}:${this.port}/pos/v1/sale`);
        result = await this._request(false, '/pos/v1/sale', payload);
      } catch (httpErr) {
        console.log(`[Viva POS] HTTP also failed: ${httpErr.message}`);
        throw httpsErr; // throw the HTTPS error as primary
      }
    }

    console.log(`[Viva POS] Initial response:`, result);

    // Viva returns state: "PROCESSING" — need to poll for result
    if (result.state === 'PROCESSING' && result.sessionId) {
      console.log(`[Viva POS] Transaction processing, sessionId: ${result.sessionId}`);
      console.log(`[Viva POS] Waiting for card tap/insert...`);
      return await this._pollSession(result.sessionId);
    }

    // Direct response (success or error)
    if (result.state === 'COMPLETED' || result.success) {
      return {
        success: true,
        authCode: result.authCode || result.AuthCode || '',
        refNum: result.rrn || result.RRN || result.referenceNumber || '',
        receiptNo: result.tid || result.TID || result.terminalId || '',
        cardNo: result.pan || result.Pan || result.cardNumber || '',
        raw: result
      };
    }

    // Error
    return {
      success: false,
      code: result.eventId || result.Eventid || '',
      reason: result.message || result.Message || `Terminal error (state: ${result.state})`,
      raw: result
    };
  }

  /**
   * Poll session status until completed or failed
   */
  async _pollSession(sessionId) {
    const maxWait = 120000; // 2 minutes max
    const pollInterval = 2000; // poll every 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));
      
      try {
        // Try HTTPS first
        let session;
        try {
          session = await this._request(true, `/pos/v1/sessions/${sessionId}`, null, 'GET');
        } catch {
          session = await this._request(false, `/pos/v1/sessions/${sessionId}`, null, 'GET');
        }
        
        console.log(`[Viva POS] Session status: ${session.state || session.status}`);

        if (session.state === 'COMPLETED' || session.state === 'APPROVED') {
          return {
            success: true,
            authCode: session.authCode || session.AuthCode || '',
            refNum: session.rrn || session.RRN || session.retrievalReferenceNumber || '',
            receiptNo: session.tid || session.TID || '',
            cardNo: session.pan || session.Pan || session.cardNumber || '',
            transactionId: session.transactionId || '',
            raw: session
          };
        }

        if (session.state === 'FAILED' || session.state === 'DECLINED' || session.state === 'CANCELLED') {
          return {
            success: false,
            code: session.eventId || session.Eventid || '',
            reason: session.message || session.Message || `Transaction ${session.state}`,
            raw: session
          };
        }

        // Still processing, continue polling
      } catch (err) {
        console.log(`[Viva POS] Poll error: ${err.message}`);
      }
    }

    throw new Error('Transaction timeout (120s)');
  }

  /**
   * Make HTTP/HTTPS request to the terminal
   */
  _request(useHttps, path, body, method = 'POST') {
    return new Promise((resolve, reject) => {
      const mod = useHttps ? https : http;
      
      const options = {
        hostname: this.ip,
        port: this.port,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 65000,
        rejectAuthorized: false, // Accept self-signed certs
      };

      // For HTTPS with self-signed certificates
      if (useHttps) {
        options.rejectUnauthorized = false;
        options.agent = new https.Agent({ rejectUnauthorized: false });
      }

      if (body && method === 'POST') {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = mod.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log(`[Viva POS] Response ${res.statusCode}: ${data.substring(0, 500)}`);
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              const err = new Error(parsed.message || parsed.Message || `HTTP ${res.statusCode}`);
              err.statusCode = res.statusCode;
              err.body = parsed;
              reject(err);
            }
          } catch {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ raw: data });
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          }
        });
      });

      req.on('error', (err) => {
        console.error(`[Viva POS] ${useHttps ? 'HTTPS' : 'HTTP'} error: ${err.code || err.message}`);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout (65s)'));
      });

      if (body && method === 'POST') {
        req.write(body);
      }
      req.end();
    });
  }

  async checkStatus() {
    try {
      await this._request(true, '/pos/v1/sale', null, 'GET');
      return true;
    } catch {
      try {
        await this._request(false, '/pos/v1/sale', null, 'GET');
        return true;
      } catch {
        return false;
      }
    }
  }
}

module.exports = VivaPosService;
