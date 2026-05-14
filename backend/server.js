require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');

const ordersRouter           = require('./routes/orders');
const shopifyRouter          = require('./routes/shopify');
const shopifyConnectRouter   = require('./routes/shopifyConnect');
const postexRouter           = require('./routes/postex');
const postexConnectRouter    = require('./routes/postexConnect');
const analyticsRouter        = require('./routes/analytics');
const whatsappRouter         = require('./routes/whatsapp');
const whatsappMessagesRouter = require('./routes/whatsappMessages');
const { startCronJobs }      = require('./cron/trackingSync');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  credentials: true,
}));

// ─── Body parsing ─────────────────────────────────────────────
app.use('/api/shopify/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Root route ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    app:     'OrderFlow API',
    status:  'running',
    version: '1.0.0',
    time:    new Date().toISOString(),
    routes: [
      '/health',
      '/api/orders',
      '/api/shopify',
      '/api/postex',
      '/api/whatsapp',
      '/api/analytics',
    ],
  });
});

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/orders',    ordersRouter);
app.use('/api/shopify',   shopifyRouter);
app.use('/api/shopify',   shopifyConnectRouter);
app.use('/api/postex',    postexRouter);
app.use('/api/postex',    postexConnectRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/whatsapp',  whatsappRouter);
app.use('/api/whatsapp',  whatsappMessagesRouter);

// ─── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  OrderFlow API running on port ${PORT}`);
  console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV !== 'test') startCronJobs();
});
