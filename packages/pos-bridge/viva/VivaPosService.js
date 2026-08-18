/**
 * VivaPosService - Handles Point-to-Point REST API communication with Viva Wallet PAX A80 terminals.
 * Documentation: https://developer.viva.com/apis-for-point-of-sale/card-terminals-devices/peer-to-peer-communication/
 */
class VivaPosService {
  constructor(ip, port = 8080) {
    this.ip = ip;
    this.port = port;
    this.baseUrl = `http://${this.ip}:${this.port}/v1`;
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

    const payload = {
      amount: amountInCents,
      tipAmount: 0,
      cashbackAmount: 0,
      preauth: false,
      installments: 0,
      merchantTrns: 'Kiosk Sale'
    };

    console.log(`[Viva POS] Initiating sale for ${amount} RON to ${this.baseUrl}/sale`);

    try {
      const response = await fetch(`${this.baseUrl}/sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        // Timeout handling is important for POS communication
        signal: AbortSignal.timeout(65000) // 65 seconds timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Viva POS] Error response (${response.status}):`, errorText);
        throw new Error(`POS returned error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Viva POS] Transaction successful:`, data);
      
      // Map Viva response to our standard format
      return {
        success: true,
        authCode: data.AuthCode,
        refNum: data.RRN,
        receiptNo: data.TID,
        cardNo: data.Pan,
        raw: data
      };

    } catch (error) {
      console.error(`[Viva POS] Connection/Execution Error:`, error.message);
      throw error;
    }
  }

  /**
   * Checks the status of the terminal
   */
  async checkStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  }
}

module.exports = VivaPosService;
