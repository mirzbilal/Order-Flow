require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const app     = express();
const PORT    = process.env.PORT || 4000;

// ─── CORS ─────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));

// ─── Body parsing ─────────────────────────────────────────────
app.use('/api/shopify/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/shopify',   require('./routes/shopify'));
app.use('/api/shopify',   require('./routes/shopifyConnect'));
app.use('/api/postex',    require('./routes/postex'));
app.use('/api/postex',    require('./routes/postexConnect'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/whatsapp',  require('./routes/whatsapp'));

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

  // Start cron jobs
  try {
    const { startCronJobs } = require('./cron/trackingSync');
    if (process.env.NODE_ENV !== 'test') startCronJobs();
  } catch (e) {
    console.error('[CRON] Failed to start:', e.message);
  }
});
