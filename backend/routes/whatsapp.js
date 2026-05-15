const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');
const whatsapp = require('../services/whatsappService');
const QRCode   = require('qrcode');

router.get('/status', async (req, res) => {
  try { res.json(whatsapp.getStatus()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/qr', async (req, res) => {
  try {
    const { qrCode, isReady } = whatsapp.getStatus();
    if (isReady) return res.json({ isReady: true });
    if (!qrCode) return res.json({ isReady: false, qrCode: null });
    const img = await QRCode.toDataURL(qrCode);
    res.json({ isReady: false, qrCode: img });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/restart', async (req, res) => {
  try { await whatsapp.initClient(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/test', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const result = await whatsapp.sendMessage(phone, '🧪 OrderFlow WhatsApp test! ✅');
    res.json({ success: true, result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/send/:orderId', async (req, res) => {
  try {
    const { event } = req.body;
    const { data: order } = await supabase.from('orders').select('*').eq('id', req.params.orderId).single();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const result = await whatsapp.notifyCustomer(event, order);
    res.json({ success: true, result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/logs', async (req, res) => {
  try {
    const { data, count } = await supabase.from('whatsapp_logs').select('*', { count: 'exact' }).order('sent_at', { ascending: false }).limit(50);
    res.json({ logs: data || [], total: count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const { data } = await supabase.from('whatsapp_logs').select('event, status');
    const total  = data?.length || 0;
    const failed = data?.filter(r => r.status === 'failed').length || 0;
    const byEvent = {};
    (data||[]).forEach(r => { if (!byEvent[r.event]) byEvent[r.event]={sent:0,failed:0}; r.status==='failed'?byEvent[r.event].failed++:byEvent[r.event].sent++; });
    res.json({ total, failed, success: total-failed, byEvent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
