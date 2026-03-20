require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const cron = require('node-cron');

const { initDb } = require('./db');
const { connectRedis } = require('./services/redisService');
const { syncAllMenus, syncStopLists } = require('./services/iikoService');
const { initSocket } = require('./services/socketService');

const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payment');
const locationRoutes = require('./routes/locations');
const adminRoutes = require('./routes/admin');
const qrRoutes = require('./routes/qr');
const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);

// ─── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow all Netlify subdomains + explicit origins
    if (!origin
        || allowedOrigins.includes(origin)
        || origin.endsWith('.netlify.app')) {
      return cb(null, true);
    }
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── SOCKET.IO ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});
initSocket(io);

// Make io accessible in routes
app.set('io', io);

// ─── ROUTES ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/qr', qrRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── ERROR HANDLER ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ─── STARTUP ─────────────────────────────────────────────────────────────────
async function start() {
  // DB — optional in local dev
  try {
    await initDb();
    console.log('[DB] PostgreSQL connected');
  } catch (err) {
    console.warn('[DB] PostgreSQL not available — running without DB:', err.message);
  }

  // Redis — optional in local dev
  try {
    await connectRedis();
    console.log('[REDIS] Connected');
  } catch (err) {
    console.warn('[REDIS] Not available — running without Redis:', err.message);
  }

  // iiko — optional, needs API key
  try {
    await syncAllMenus();
  } catch (err) {
    console.warn('[IIKO] Menu sync skipped:', err.message);
  }

  // Cron: menu sync every N minutes
  const menuInterval = parseInt(process.env.MENU_SYNC_INTERVAL_MINUTES || '15');
  cron.schedule(`*/${menuInterval} * * * *`, async () => {
    try { await syncAllMenus(); } catch(e) { console.warn('[IIKO cron]', e.message); }
  });

  // Cron: stop-list every ~2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try { await syncStopLists(); } catch(e) {}
  });

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`\n🚀 Smart Kiosk API — http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Orders: POST http://localhost:${PORT}/api/orders`);
    console.log(`   QR gen: GET  http://localhost:${PORT}/api/qr/generate?brand=smashme&table=5&loc=1\n`);
  });
}

start();

