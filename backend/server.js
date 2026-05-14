// backend/server.js
require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');

const ordersRouter    = require('./routes/orders');
const shopifyRouter   = require('./routes/shopify');
const shopifyConnectRouter = require('./routes/shopifyConnect');
const postexRouter    = require('./routes/postex');
const analyticsRouter = require('./routes/analytics');
const whatsappRouter         = require('./routes/whatsapp');
const whatsappMessagesRouter = require('./routes/whatsappMessages');
const postexConnectRouter = require('./routes/postexConnect');
const { startCronJobs } = require('./cron/trackingSync');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
}));

// ─── Body parsing ─────────────────────────────────────────────
// Shopify webhooks need raw body for HMAC verification
app.use('/api/shopify/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/orders',    ordersRouter);
app.use('/api/shopify',   shopifyRouter);
app.use('/api/shopify',   shopifyConnectRouter); // connect/status/callback
app.use('/api/postex',    postexRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/whatsapp',  whatsappRouter);
app.use('/api/whatsapp',  whatsappMessagesRouter);
app.use('/api/postex',    postexConnectRouter); // connect/status/test

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

// ─── 404 ──────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  OrderFlow backend running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'test') startCronJobs();
});
