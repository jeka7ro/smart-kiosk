const { createClient } = require('redis');

let client;

async function connectRedis() {
  client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: false,  // no retry in local dev
      connectTimeout: 3000,
    },
  });
  let errShown = false;
  client.on('error', (err) => {
    if (!errShown) { console.warn('[REDIS] Not available (continuing without cache)'); errShown = true; }
  });
  await client.connect().catch(() => {
    console.warn('[REDIS] Skipping Redis — not running locally');
    client = null;
  });
}

function getRedis() {
  if (!client) throw new Error('Redis not connected');
  return client;
}

async function cacheGet(key) {
  try {
    const val = await getRedis().get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function cacheSet(key, value, ttlSeconds = 900) {
  try {
    await getRedis().set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (e) { console.error('[REDIS] cacheSet error:', e.message); }
}

async function cacheDel(key) {
  try { await getRedis().del(key); } catch { /* ignore */ }
}

module.exports = { connectRedis, getRedis, cacheGet, cacheSet, cacheDel };
