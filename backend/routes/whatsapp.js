// backend/routes/whatsapp.js
const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');
const whatsapp = require('../services/whatsappService');

// ─── GET /api/whatsapp/templates ────────────────────────────
router.get('/templates', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/whatsapp/templates ───────────────────────────
router.post('/templates', async (req, res) => {
  try {
    const { webhook_type, message, name } = req.body;
    if (!webhook_type) return res.status(400).json({ error: 'webhook_type is required' });
    if (!message)      return res.status(400).json({ error: 'message is required' });

    const { data, error } = await supabase
      .from('whatsapp_templates')
      .insert({ webhook_type, message, name: name || webhook_type, active: true })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, template: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/whatsapp/templates/:id ──────────────────────
router.patch('/templates/:id', async (req, res) => {
  try {
    const { message, name, active } = req.body;
    const updates = {};
    if (message  !== undefined) updates.message = message;
    if (name     !== undefined) updates.name    = name;
    if (active   !== undefined) updates.active  = active;

    const { data, error } = await supabase
      .from('whatsapp_templates')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/whatsapp/templates/:id ─────────────────────
router.delete('/templates/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('whatsapp_templates')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/whatsapp/logs ──────────────────────────────────
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, event } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('whatsapp_logs')
      .select('*, orders(shopify_order_number, customer_name)', { count: 'exact' })
      .order('sent_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    if (event)  query = query.eq('event', event);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ logs: data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/whatsapp/send/:orderId ───────────────────────
router.post('/send/:orderId', async (req, res) => {
  try {
    const { event } = req.body;
    const { data: order } = await supabase
      .from('orders').select('*').eq('id', req.params.orderId).single();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.customer_phone) return res.status(400).json({ error: 'No phone number' });

    const result = await whatsapp.notifyCustomer(event, order);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/whatsapp/test ─────────────────────────────────
router.post('/test', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const msg = message || `🧪 *OrderFlow Test*\n\nWhatsApp integration is working! ✅`;
    const result = await whatsapp.sendMessage(phone, msg);
    res.json({ success: true, sid: result.sid, status: result.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/whatsapp/stats ─────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { data } = await supabase.from('whatsapp_logs').select('event, status');
    const stats = {};
    for (const row of (data || [])) {
      if (!stats[row.event]) stats[row.event] = { sent:0, failed:0 };
      row.status === 'failed' ? stats[row.event].failed++ : stats[row.event].sent++;
    }
    const total  = (data || []).length;
    const failed = (data || []).filter(r => r.status === 'failed').length;
    res.json({ total, failed, success: total - failed, byEvent: stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/whatsapp/link-status ──────────────────────────
router.get('/link-status', async (req, res) => {
  try {
    const { data } = await supabase
      .from('settings').select('value').eq('key', 'whatsapp_link').maybeSingle();
    if (!data?.value) return res.json({ linked: false });
    res.json({ linked: true, ...JSON.parse(data.value) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/whatsapp/link ─────────────────────────────────
router.post('/link', async (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = req.body;
    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({ error: 'accountSid, authToken, fromNumber are required' });
    }
    // Quick test
    const twilio = require('twilio')(accountSid, authToken);
    await twilio.api.accounts(accountSid).fetch();

    await supabase.from('settings').upsert([{
      key: 'whatsapp_link',
      value: JSON.stringify({ accountSid, authToken, fromNumber, linkedAt: new Date().toISOString() }),
    }], { onConflict: 'key' });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Invalid Twilio credentials: ' + err.message });
  }
});

module.exports = router;
