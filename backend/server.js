require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors    = require('cors');
const app     = express();
const PORT    = process.env.PORT || 4000;

// ─── CORS ─────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));

// ─── Body parsing ─────────────────────────────────────────────
app.use('/api/shopify/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Safe route loader ────────────────────────────────────────
function safeRequire(path) {
  try { return require(path); }
  catch (e) { console.error(`[Route] Missing: ${path} — ${e.message}`); return null; }
}

// ─── Routes ───────────────────────────────────────────────────
const routes = [
  ['/api/orders',    './routes/orders'],
  ['/api/shopify',   './routes/shopify'],
  ['/api/shopify',   './routes/shopifyConnect'],
  ['/api/postex',    './routes/postex'],
  ['/api/postex',    './routes/postexConnect'],
  ['/api/analytics', './routes/analytics'],
  ['/api/whatsapp',  './routes/whatsapp'],
  ['/api/whatsapp',  './routes/whatsappMessages'],
];

routes.forEach(([path, file]) => {
  const router = safeRequire(file);
  if (router) app.use(path, router);
  else console.warn(`[Server] Skipping missing route: ${file}`);
});

// ─── Root ─────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({
  app: 'OrderFlow API', status: 'running', version: '1.0.0',
  time: new Date().toISOString(),
}));

// ─── Health ───────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── 404 ──────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));

// ─── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  OrderFlow API running on port ${PORT}`);
  console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}`);
  try {
    const { startCronJobs } = require('./cron/trackingSync');
    if (process.env.NODE_ENV !== 'test') startCronJobs();
  } catch (e) { console.error('[CRON] Failed to start:', e.message); }
});
