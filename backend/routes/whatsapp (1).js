// backend/routes/whatsapp.js
const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');
const whatsapp = require('../services/whatsappService');
const qrcode   = require('qrcode');

// ─── GET /api/whatsapp/status ─────────────────────────────────
router.get('/status', async (req, res) => {
  const status = whatsapp.getStatus();
  res.json(status);
});

// ─── GET /api/whatsapp/qr ─────────────────────────────────────
// Returns QR code as base64 image
router.get('/qr', async (req, res) => {
  const { qrCode, isReady } = whatsapp.getStatus();
  if (isReady) return res.json({ isReady: true, message: 'Already connected!' });
  if (!qrCode) return res.json({ isReady: false, qrCode: null, message: 'Initializing — try again in 10 seconds' });

  try {
    const qrImage = await qrcode.toDataURL(qrCode);
    res.json({ isReady: false, qrCode: qrImage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/whatsapp/restart ───────────────────────────────
router.post('/restart', async (req, res) => {
  try {
    await whatsapp.initClient();
    res.json({ success: true, message: 'WhatsApp client restarting...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/whatsapp/test ──────────────────────────────────
router.post('/test', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const result = await whatsapp.sendMessage(phone,
      `🧪 *OrderFlow Test Message*\n\nYour WhatsApp integration is working! ✅\n\nMessages will be sent automatically for:\n• Order Confirmed\n• PostEx Booked\n• Shipped\n• Delivered`
    );
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/whatsapp/send/:orderId ────────────────────────
router.post('/send/:orderId', async (req, res) => {
  try {
    const { event } = req.body;
    const { data: order } = await supabase
      .from('orders').select('*').eq('id', req.params.orderId).single();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const result = await whatsapp.notifyCustomer(event, order);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/whatsapp/logs ───────────────────────────────────
router.get('/logs', async (req, res) => {
  try {
    const { data, error, count } = await supabase
      .from('whatsapp_logs')
      .select('*', { count: 'exact' })
      .order('sent_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ logs: data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/whatsapp/stats ──────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { data } = await supabase.from('whatsapp_logs').select('event, status');
    const total   = data?.length || 0;
    const failed  = data?.filter(r => r.status === 'failed').length || 0;
    const byEvent = {};
    (data || []).forEach(r => {
      if (!byEvent[r.event]) byEvent[r.event] = { sent:0, failed:0 };
      r.status === 'failed' ? byEvent[r.event].failed++ : byEvent[r.event].sent++;
    });
    res.json({ total, failed, success: total - failed, byEvent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CRUD for message templates ───────────────────────────────
router.get('/messages', async (req, res) => {
  const { data } = await supabase.from('whatsapp_messages').select('*').order('created_at', { ascending: false });
  res.json({ messages: data || [] });
});

router.post('/messages', async (req, res) => {
  const { webhookType, message } = req.body;
  if (!webhookType || !message) return res.status(400).json({ error: 'webhookType and message required' });
  const { data, error } = await supabase.from('whatsapp_messages').insert({ webhook_type: webhookType, message, active: true }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: data });
});

router.patch('/messages/:id', async (req, res) => {
  const { data, error } = await supabase.from('whatsapp_messages').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/messages/:id', async (req, res) => {
  await supabase.from('whatsapp_messages').delete().eq('id', req.params.id);
  res.json({ success: true });
});

module.exports = router;
