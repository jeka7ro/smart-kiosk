const express = require('express');
const router = express.Router();

// Admin routes — require JWT auth in production
// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  res.json({
    ordersToday: 0,
    revenueToday: 0,
    activeLocations: 2,
    pendingOrders: 0,
  });
});

// GET /api/admin/orders?date=&locationId=&status=
router.get('/orders', async (req, res) => {
  res.json({ orders: [], total: 0 });
});

module.exports = router;
