const express = require('express');
const router = express.Router();

// POST /api/payment/initiate — called after cart is finalized on kiosk
router.post('/initiate', async (req, res) => {
  const { orderId, amount, terminalId, channel } = req.body;
  // TODO: call Raiffeisen ECR agent or Viva Terminal API
  res.json({
    success: true,
    orderId,
    amount,
    channel: channel || 'kiosk',
    status: 'initiated',
    message: 'Payment terminal activated — waiting for card',
  });
});

// POST /api/payment/webhook — Viva sends this when payment completes
router.post('/webhook', async (req, res) => {
  const { EventTypeId, EventData } = req.body;
  console.log('[Webhook] Viva event:', EventTypeId, EventData?.TransactionId);
  // EventTypeId 1796 = transaction.completed
  if (EventTypeId === 1796) {
    const { OrderRef, StatusId } = EventData || {};
    if (StatusId === 'F') { // F = success
      // TODO: update order status in DB, emit to KDS
      const io = req.app.get('io');
      if (io) io.emit(`payment_confirmed_${OrderRef}`, { paid: true });
    }
  }
  res.status(200).send('OK');
});

// GET /api/payment/status/:orderId
router.get('/status/:orderId', async (req, res) => {
  // TODO: query from DB
  res.json({ orderId: req.params.orderId, status: 'pending' });
});

module.exports = router;
