// backend/services/whatsappService.js
// WhatsApp Automation via Twilio
// Docs: https://www.twilio.com/docs/whatsapp

const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox default

// ─── Format phone to WhatsApp format ─────────────────────────
// Converts 03001234567 → whatsapp:+923001234567
function formatPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  let intl = digits;

  // Pakistan: 03xxxxxxxxx → 923xxxxxxxxx
  if (digits.startsWith('0') && digits.length === 11) {
    intl = '92' + digits.slice(1);
  } else if (digits.length === 10 && !digits.startsWith('92')) {
    intl = '92' + digits;
  }

  return `whatsapp:+${intl}`;
}

// ─── Send a WhatsApp message ──────────────────────────────────
async function sendMessage(phone, message) {
  const to = formatPhone(phone);
  if (!to) throw new Error('Invalid phone number: ' + phone);

  const msg = await client.messages.create({
    from: FROM,
    to,
    body: message,
  });

  console.log(`[WhatsApp] Sent to ${to} | SID: ${msg.sid}`);
  return { sid: msg.sid, status: msg.status };
}

// ─── Message Templates ────────────────────────────────────────

// 1. Order Confirmed (triggered when Shopify order is synced)
function msgOrderConfirmed(order) {
  return `Hello ${order.customer_name}! 👋

✅ *Order Confirmed*

Your order *${order.shopify_order_number}* has been received and is being processed.

🛍 *Items:* ${order.order_detail || 'Your items'}
💰 *Amount:* PKR ${Number(order.total_price).toLocaleString()}
💳 *Payment:* ${order.payment_method || 'COD'}
📍 *Delivery to:* ${order.shipping_city}

We'll notify you once your order is dispatched. Thank you for shopping with us! 🙏`;
}

// 2. Order Booked with PostEx (CN assigned)
function msgOrderBooked(order) {
  return `Hello ${order.customer_name}! 📦

Your order *${order.shopify_order_number}* has been handed over to *PostEx* for delivery.

🔖 *Tracking No:* ${order.postex_cn}
📍 *Delivery to:* ${order.shipping_address}, ${order.shipping_city}
💰 *COD Amount:* PKR ${Number(order.total_price).toLocaleString()}

You can track your parcel at:
🔗 https://postex.pk/tracking?cn=${order.postex_cn}

Expected delivery: 2-4 working days. We'll update you when it's delivered! 🚚`;
}

// 3. Order Shipped / In Transit
function msgOrderShipped(order) {
  return `Hello ${order.customer_name}! 🚚

Your order *${order.shopify_order_number}* is now *On the Way!*

📦 *PostEx Tracking:* ${order.postex_cn}
📍 *Delivering to:* ${order.shipping_city}
💰 *Amount to Pay:* PKR ${Number(order.total_price).toLocaleString()}

Track live: https://postex.pk/tracking?cn=${order.postex_cn}

Please keep your phone available for the delivery rider. 📞`;
}

// 4. Order Delivered
function msgOrderDelivered(order) {
  return `Hello ${order.customer_name}! 🎉

Your order *${order.shopify_order_number}* has been *Delivered* successfully!

We hope you love your purchase. If you have any issues, please contact us and we'll be happy to help.

Thank you for choosing us! ⭐ Have a great day!`;
}

// ─── Webhook type → event mapping ────────────────────────────
const EVENT_TO_WEBHOOK = {
  confirmed: 'orders/creation',
  booked:    'orders/fulfillment',
  shipped:   'orders/fulfillment',
  delivered: 'orders/fulfillment',
};

// ─── Event dispatcher ─────────────────────────────────────────
// Uses custom DB template if available, falls back to built-in template
async function notifyCustomer(event, order) {
  if (!order.customer_phone) {
    console.warn(`[WhatsApp] No phone for order ${order.shopify_order_number} — skipping`);
    return null;
  }

  const templates = {
    confirmed: msgOrderConfirmed,
    booked:    msgOrderBooked,
    shipped:   msgOrderShipped,
    delivered: msgOrderDelivered,
  };

  const buildMsg = templates[event];
  if (!buildMsg) {
    console.warn(`[WhatsApp] Unknown event: ${event}`);
    return null;
  }

  try {
    // Try custom DB template first
    let message;
    try {
      const { resolveMessage } = require('../routes/whatsappMessages');
      const webhookType = EVENT_TO_WEBHOOK[event];
      message = await resolveMessage(webhookType, order);
    } catch (_) {}

    // Fall back to built-in template
    if (!message) message = buildMsg(order);
    const result  = await sendMessage(order.customer_phone, message);

    // Log to DB
    await require('../lib/supabase')
      .from('whatsapp_logs')
      .insert({
        order_id:   order.id,
        phone:      order.customer_phone,
        event,
        message,
        twilio_sid: result.sid,
        status:     result.status,
      });

    return result;
  } catch (err) {
    console.error(`[WhatsApp] Failed for ${event} / ${order.shopify_order_number}:`, err.message);

    // Log failure
    await require('../lib/supabase')
      .from('whatsapp_logs')
      .insert({
        order_id: order.id,
        phone:    order.customer_phone,
        event,
        status:   'failed',
        error:    err.message,
      })
      .catch(() => {}); // don't throw if logging also fails

    return null;
  }
}

module.exports = { notifyCustomer, sendMessage, formatPhone };
