// backend/services/whatsappService.js
// WhatsApp via WAB2C HTTP API — no WebSocket needed
const axios    = require('axios');
const supabase = require('../lib/supabase');

const API_KEY      = process.env.WAB2C_API_KEY;
const PHONE_NUM_ID = process.env.WAB2C_PHONE_NUMBER_ID;

function isConfigured() { return !!(API_KEY && PHONE_NUM_ID); }

function getStatus() {
  return { isReady: isConfigured(), provider: 'WAB2C', configured: isConfigured() };
}

function initClient() {
  console.log('[WA] WAB2C WhatsApp service loaded. Configured:', isConfigured());
}

function formatPhone(phone) {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = '92' + d.slice(1);
  else if (d.length === 10) d = '92' + d;
  return d;
}

async function sendMessage(phone, message) {
  if (!isConfigured()) return { status: 'skipped', reason: 'WAB2C not configured' };
  const to = formatPhone(phone);
  if (!to) return { status: 'skipped', reason: 'invalid phone' };
  try {
    const { data } = await axios.post(
      `https://api.wab2c.com/v1/${PHONE_NUM_ID}/messages`,
      { messaging_product:'whatsapp', recipient_type:'individual', to, type:'text', text:{ body:message } },
      { headers:{ Authorization:`Bearer ${API_KEY}`, 'Content-Type':'application/json' }, timeout:15000 }
    );
    return { status:'sent', messageId: data?.messages?.[0]?.id };
  } catch (err) {
    const e = err.response?.data?.error?.message || err.message;
    console.error('[WA] Send error:', e);
    return { status:'failed', error: e };
  }
}

function buildMessage(event, order) {
  const n = order.customer_name || 'Customer';
  const num = `#${order.shopify_order_number}`;
  const amt = `PKR ${Number(order.total_price||0).toLocaleString()}`;
  const cn  = order.postex_cn || '';
  const msgs = {
    confirmed: `Hello ${n}! 👋\n\n✅ *Order Confirmed*\n\nOrder *${num}* received.\n🛍 ${order.order_detail||'Your items'}\n💰 ${amt}\n💳 ${order.payment_method||'COD'}\n📍 ${order.shipping_city||''}\n\nThank you! 🙏`,
    booked:    `Hello ${n}! 📦\n\nOrder *${num}* booked with PostEx.\n\n🔖 *Tracking:* ${cn}\n📍 ${order.shipping_city||''}\n\nTrack: https://postex.pk/tracking?cn=${cn} 🚚`,
    shipped:   `Hello ${n}! 🚚\n\nOrder *${num}* is on the way!\n\n📦 PostEx: *${cn}*\nTrack: https://postex.pk/tracking?cn=${cn}`,
    delivered: `Hello ${n}! 🎉\n\nOrder *${num}* delivered!\n\nThank you! ⭐`,
  };
  return msgs[event] || null;
}

async function notifyCustomer(event, order) {
  if (!order?.customer_phone) return null;
  const message = buildMessage(event, order);
  if (!message) return null;
  try {
    const result = await sendMessage(order.customer_phone, message);
    await supabase.from('whatsapp_logs').insert({
      order_id: order.id, phone: order.customer_phone,
      event, message, status: result.status, error: result.error || null,
    }).catch(() => {});
    return result;
  } catch (err) {
    console.error('[WA] notifyCustomer error:', err.message);
    return null;
  }
}

initClient();
module.exports = { sendMessage, notifyCustomer, getStatus, initClient };
