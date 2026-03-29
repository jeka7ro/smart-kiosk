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
const usersRoutes        = require('./routes/users');
const integrationsRoutes = require('./routes/integrations');
const promotionsRoutes = require('./routes/promotions');
const brandsRoutes     = require('./routes/brands');
const translationRoutes = require('./routes/translations');
const productsRoutes    = require('./routes/products');

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
  cors: {
    origin: (origin, cb) => {
      if (!origin 
          || allowedOrigins.includes(origin) 
          || origin.endsWith('.netlify.app')) {
        return cb(null, true);
      }
      cb(new Error(`Socket CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
});
initSocket(io);

// Make io accessible in routes
app.set('io', io);

// ─── ROUTES ─────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/menu',         menuRoutes);
app.use('/api/orders',       orderRoutes);
app.use('/api/payment',      paymentRoutes);
app.use('/api/locations',    locationRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/users',        usersRoutes);
app.use('/api/qr',           qrRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/promotions',   promotionsRoutes);
app.use('/api/brands',       brandsRoutes);
app.use('/api/admin/translations', translationRoutes);
app.use('/api/products',     productsRoutes);

// Serve uploaded brand logos
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── IMAGE PROXY (for Syrve CDN — bypasses browser CORS) ──────────────────
const { Readable } = require('stream');

app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('https://storage.cdneu.syrve.com/')) {
    return res.status(400).json({ error: 'Invalid image URL' });
  }
  try {
    const upstream = await fetch(url, { headers: { 'User-Agent': 'SmartKiosk/1.0' } });
    if (!upstream.ok) return res.status(upstream.status).end();
    
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400, s-maxage=86400'); // cache 1 day
    
    // CRITICAL: Stream directly to client instead of buffering into RAM!
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    console.error('[ImageProxy] Error:', url, e.message);
    res.status(502).json({ error: 'Image proxy failed' });
  }
});


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

// touched at 1774353099603
