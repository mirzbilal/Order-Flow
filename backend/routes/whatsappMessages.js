// backend/routes/whatsappMessages.js
// CRUD for custom WhatsApp message templates

const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');
const whatsapp = require('../services/whatsappService');

// ─── GET /api/whatsapp/messages ──────────────────────────────
router.get('/messages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ messages: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/whatsapp/messages ─────────────────────────────
router.post('/messages', async (req, res) => {
  try {
    const { webhookType, message } = req.body;
    if (!webhookType) return res.status(400).json({ error: 'webhookType is required' });
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert({ webhook_type: webhookType, message: message.trim(), active: true })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, message: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/whatsapp/messages/:id ────────────────────────
router.patch('/messages/:id', async (req, res) => {
  try {
    const { active, message, webhookType } = req.body;
    const updates = {};
    if (active    !== undefined) updates.active       = active;
    if (message   !== undefined) updates.message      = message;
    if (webhookType !== undefined) updates.webhook_type = webhookType;

    const { data, error } = await supabase
      .from('whatsapp_messages')
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

// ─── DELETE /api/whatsapp/messages/:id ───────────────────────
router.delete('/messages/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('whatsapp_messages')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helper: resolve message for an event + order ────────────
// Called internally by whatsappService to use custom templates
async function resolveMessage(webhookType, order) {
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('message')
    .eq('webhook_type', webhookType)
    .eq('active', true)
    .maybeSingle();

  if (!data?.message) return null; // no custom template

  return data.message
    .replace(/\[User Name\]/g,     order.customer_name  || '')
    .replace(/\[Order No\.\]/g,    order.shopify_order_number || '')
    .replace(/\[Order ID\]/g,      order.id             || '')
    .replace(/\[Products\]/g,      order.order_detail   || '')
    .replace(/\[Amount\]/g,        `PKR ${Number(order.total_price||0).toLocaleString()}`)
    .replace(/\[Address\]/g,       order.shipping_address || '')
    .replace(/\[City\]/g,          order.shipping_city  || '')
    .replace(/\[Phone\]/g,         order.customer_phone || '')
    .replace(/\[Tracking No\.\]/g, order.postex_cn      || '')
    .replace(/\[Payment Method\]/g,order.payment_method || 'COD')
    .replace(/\[Store Name\]/g,    process.env.STORE_NAME || 'Our Store')
    .replace(/\[Delivery Date\]/g, order.delivered_at ? new Date(order.delivered_at).toLocaleDateString('en-PK') : '');
}

router.resolveMessage = resolveMessage;
module.exports = router;
