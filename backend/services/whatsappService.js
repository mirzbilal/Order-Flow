// backend/services/whatsappService.js
// WhatsApp via whatsapp-web.js — FREE, scan QR to connect
// No API keys, no monthly fees

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode  = require('qrcode-terminal');
const supabase = require('../lib/supabase');

let client     = null;
let qrCode     = null;
let isReady    = false;
let isIniting  = false;

// ─── Initialize WhatsApp Client ───────────────────────────────
async function initClient() {
  if (isIniting || isReady) return;
  isIniting = true;

  console.log('[WhatsApp] Initializing whatsapp-web.js...');

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/tmp/whatsapp-session' }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', (qr) => {
    qrCode = qr;
    isReady = false;
    console.log('[WhatsApp] QR Code generated — scan with your phone');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    isReady  = true;
    isIniting = false;
    qrCode   = null;
    console.log('[WhatsApp] ✅ Client is ready!');
  });

  client.on('disconnected', (reason) => {
    isReady   = false;
    isIniting = false;
    client    = null;
    console.log('[WhatsApp] Disconnected:', reason);
  });

  client.on('auth_failure', () => {
    isReady   = false;
    isIniting = false;
    client    = null;
    console.log('[WhatsApp] Auth failure — need to scan QR again');
  });

  await client.initialize();
}

// ─── Get status ───────────────────────────────────────────────
function getStatus() {
  return { isReady, hasQr: !!qrCode, qrCode };
}

// ─── Format phone ─────────────────────────────────────────────
function formatPhone(phone) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = '92' + digits.slice(1);
  else if (digits.length === 10) digits = '92' + digits;
  return digits + '@c.us';
}

// ─── Send message ─────────────────────────────────────────────
async function sendMessage(phone, message) {
  if (!isReady || !client) {
    console.warn('[WhatsApp] Not ready — message skipped for', phone);
    return { status: 'skipped', reason: 'not ready' };
  }

  const to = formatPhone(phone);
  if (!to) throw new Error('Invalid phone: ' + phone);

  const result = await client.sendMessage(to, message);
  console.log('[WhatsApp] ✅ Sent to', phone);
  return { status: 'sent', id: result.id };
}

// ─── Message Templates ────────────────────────────────────────
function msgOrderConfirmed(order) {
  return `Hello ${order.customer_name}! 👋

✅ *Order Confirmed*

Your order *#${order.shopify_order_number}* has been received.

🛍 *Items:* ${order.order_detail || 'Your items'}
💰 *Amount:* PKR ${Number(order.total_price||0).toLocaleString()}
💳 *Payment:* ${order.payment_method || 'COD'}
📍 *Delivery to:* ${order.shipping_city}

Thank you for shopping with us! 🙏`;
}

function msgOrderBooked(order) {
  return `Hello ${order.customer_name}! 📦

Your order *#${order.shopify_order_number}* has been booked with PostEx.

🔖 *Tracking No:* ${order.postex_cn}
📍 *Delivering to:* ${order.shipping_city}
💰 *Amount:* PKR ${Number(order.total_price||0).toLocaleString()}

Track: https://postex.pk/tracking?cn=${order.postex_cn}

Expected delivery: 2-4 working days 🚚`;
}

function msgOrderShipped(order) {
  return `Hello ${order.customer_name}! 🚚

Your order *#${order.shopify_order_number}* is *On the Way!*

📦 *PostEx Tracking:* ${order.postex_cn}
📍 *Delivering to:* ${order.shipping_city}
💰 *Amount to Pay:* PKR ${Number(order.total_price||0).toLocaleString()}

Track: https://postex.pk/tracking?cn=${order.postex_cn}

Please keep your phone available for the rider 📞`;
}

function msgOrderDelivered(order) {
  return `Hello ${order.customer_name}! 🎉

Your order *#${order.shopify_order_number}* has been *Delivered!*

Thank you for shopping with us! ⭐
We hope you love your purchase.`;
}

// ─── Notify customer ──────────────────────────────────────────
async function notifyCustomer(event, order) {
  if (!order.customer_phone) {
    console.warn('[WhatsApp] No phone for order', order.shopify_order_number);
    return null;
  }

  const templates = {
    confirmed: msgOrderConfirmed,
    booked:    msgOrderBooked,
    shipped:   msgOrderShipped,
    delivered: msgOrderDelivered,
  };

  const buildMsg = templates[event];
  if (!buildMsg) return null;

  try {
    // Check for custom template in DB
    const { data: customRow } = await supabase
      .from('whatsapp_messages')
      .select('message')
      .eq('webhook_type', event === 'confirmed' ? 'orders/creation' : 'orders/fulfillment')
      .eq('active', true)
      .maybeSingle();

    let message = customRow?.message
      ? customRow.message
          .replace(/\[User Name\]/g,     order.customer_name || '')
          .replace(/\[Order No\.\]/g,    order.shopify_order_number || '')
          .replace(/\[Amount\]/g,        `PKR ${Number(order.total_price||0).toLocaleString()}`)
          .replace(/\[City\]/g,          order.shipping_city || '')
          .replace(/\[Tracking No\.\]/g, order.postex_cn || '')
          .replace(/\[Payment Method\]/g,order.payment_method || 'COD')
      : buildMsg(order);

    const result = await sendMessage(order.customer_phone, message);

    // Log to DB
    await supabase.from('whatsapp_logs').insert({
      order_id:   order.id,
      phone:      order.customer_phone,
      event,
      message,
      status:     result.status || 'sent',
    }).catch(() => {});

    return result;
  } catch (err) {
    console.error('[WhatsApp] Failed:', err.message);
    await supabase.from('whatsapp_logs').insert({
      order_id: order.id,
      phone:    order.customer_phone,
      event,
      status:   'failed',
      error:    err.message,
    }).catch(() => {});
    return null;
  }
}

// Auto-init on startup
initClient().catch(e => console.error('[WhatsApp] Init error:', e.message));

module.exports = { sendMessage, notifyCustomer, getStatus, initClient, formatPhone };
