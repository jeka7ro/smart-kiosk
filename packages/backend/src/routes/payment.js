const express = require('express');
const router  = express.Router();

// ── Viva Wallet helpers ───────────────────────────────────────────────────────
async function vivaGetAccessToken() {
  const clientId     = process.env.VIVA_CLIENT_ID     || process.env.VIVA_MERCHANT_ID;
  const clientSecret = process.env.VIVA_CLIENT_SECRET || process.env.VIVA_API_KEY;
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const resp = await fetch('https://accounts.vivapayments.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body,
  });
  if (!resp.ok) throw new Error(`Viva auth failed: ${resp.status}`);
  const data = await resp.json();
  return data.access_token;
}

async function vivaCreateOrder(amount, accessToken) {
  const amountCents = Math.round(amount * 100);
  const resp = await fetch('https://api.vivapayments.com/checkout/v2/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      amount: amountCents,
      customerTrns: 'Comanda Kiosk',
      paymentTimeout: 300,
    }),
  });
  if (!resp.ok) throw new Error(`Viva order failed: ${resp.status}`);
  return await resp.json(); // { orderCode: "...", ... }
}

// POST /api/payment/initiate
router.post('/initiate', async (req, res) => {
  const { orderId, amount, channel, paymentGateway } = req.body;
  const io = req.app.get('io');

  // ── VeriFone V200t Serial (Printec ECR v3.9.3) ──────────────────────────
  if (paymentGateway === 'verifone_serial' || process.env.DEFAULT_PAYMENT_GATEWAY === 'verifone_serial') {
    try {
      const serialPort = process.env.VERIFONE_SERIAL_PORT || '/dev/cu.usbserial-FTF2NAV8';
      const baudRate   = parseInt(process.env.VERIFONE_BAUD_RATE || '9600');
      const VerifoneSerialService = require('../services/verifoneSerialService');
      const vfSerial = new VerifoneSerialService(serialPort, baudRate);

      vfSerial.processPayment(amount, {
        onStatus: (msg) => { if (io) io.emit(`payment_status_${orderId}`, { message: msg }); },
      })
        .then(result => {
          console.log(`[Payment] VeriFone result: success=${result.success}`);
          if (io) io.emit(`payment_confirmed_${orderId}`, {
            paid:         result.success,
            responseCode: result.code,
            authCode:     result.authCode,
            refNum:       result.refNum,
            receiptNo:    result.receiptNo,
            cardNo:       result.cardNo,
            txDate:       result.txDate,
            error:        result.success ? undefined : (result.errorMsg || 'Plată refuzată'),
          });
        })
        .catch(err => {
          console.error('[Payment] VeriFone Error:', err.message);
          if (io) io.emit(`payment_confirmed_${orderId}`, { paid: false, error: err.message });
        });

      return res.json({
        success: true, orderId, amount, channel: channel || 'kiosk',
        status: 'initiated', paymentGateway: 'verifone_serial',
        message: 'Terminal POS activat — aşteptaţi cardul',
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ── Raiffeisen ECR TCP/IP ────────────────────────────────────────────────
  else if (paymentGateway === 'raiffeisen' || process.env.DEFAULT_PAYMENT_GATEWAY === 'raiffeisen') {
    try {
      const posIp   = process.env.RAIFFEISEN_POS_IP   || '127.0.0.1';
      const posPort = parseInt(process.env.RAIFFEISEN_POS_PORT || '1000');
      const RaiffeisenEcrService = require('../services/raiffeisenEcrService');
      const ecr = new RaiffeisenEcrService(posIp, posPort);

      ecr.processPayment(amount)
        .then(result => {
          if (io) io.emit(`payment_confirmed_${orderId}`, {
            paid: result.success, responseCode: result.code, raw: result.raw,
          });
        })
        .catch(err => {
          if (io) io.emit(`payment_confirmed_${orderId}`, { paid: false, error: err.message });
        });

      return res.json({
        success: true, orderId, amount, channel: channel || 'kiosk',
        status: 'initiated', paymentGateway: 'raiffeisen',
        message: 'Payment terminal activated — waiting for card',
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  else {
    return res.json({
      success: true, orderId, amount, channel: channel || 'kiosk',
      status: 'initiated', message: 'Payment terminal activated',
    });
  }
});

// POST /api/payment/webhook — Viva sends this when payment completes
router.post('/webhook', async (req, res) => {
  const { EventTypeId, EventData } = req.body;
  console.log('[Webhook] Viva event:', EventTypeId, EventData?.TransactionId);
  if (EventTypeId === 1796) {
    const { OrderRef, StatusId } = EventData || {};
    if (StatusId === 'F') {
      const io = req.app.get('io');
      if (io) io.emit(`payment_confirmed_${OrderRef}`, { paid: true });
    }
  }
  res.status(200).send('OK');
});

// GET /api/payment/status/:orderId
router.get('/status/:orderId', async (req, res) => {
  res.json({ orderId: req.params.orderId, status: 'pending' });
});

// POST /api/payment/qr-link  — genereaza link Viva Wallet + QR
router.post('/qr-link', async (req, res) => {
  const { orderId, amount } = req.body;
  const io = req.app.get('io');

  try {
    const token = await vivaGetAccessToken();

    if (!token) {
      // Demo mode — no Viva credentials configured
      const demoUrl = `https://demo.vivapayments.com/web/checkout?ref=DEMO_${orderId}`;
      return res.json({
        success:    true,
        demo:       true,
        paymentUrl: demoUrl,
        orderId,
        message:    'Demo mode — configurati VIVA_CLIENT_ID si VIVA_CLIENT_SECRET in .env',
      });
    }

    const order     = await vivaCreateOrder(amount, token);
    const orderCode = order.orderCode;
    const paymentUrl = `https://www.vivapayments.com/web/checkout?ref=${orderCode}`;

    // Poll Viva for confirmation every 4s (max 5 min)
    let polls = 0;
    const interval = setInterval(async () => {
      polls++;
      if (polls > 75) { clearInterval(interval); return; }
      try {
        const t2   = await vivaGetAccessToken();
        const chk  = await fetch(`https://api.vivapayments.com/checkout/v2/orders/${orderCode}`, {
          headers: { Authorization: `Bearer ${t2}` },
        });
        const data = await chk.json();
        if (data.stateId === 'F') { // F = captured/paid
          clearInterval(interval);
          if (io) io.emit(`payment_confirmed_${orderId}`, { paid: true, paymentMethod: 'qr' });
        }
      } catch (_) {}
    }, 4000);

    return res.json({ success: true, paymentUrl, orderCode, orderId });

  } catch (err) {
    console.error('[QR Payment]', err.message);
    return res.status(500).json({ success: false, error: 'Eroare la generarea link-ului de plata' });
  }
});

module.exports = router;
