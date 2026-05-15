// backend/services/whatsappService.js
// WhatsApp via @whiskeysockets/baileys
// No Chrome/Puppeteer needed — lightweight, works on Render free tier
// FREE forever — scan QR to connect

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path    = require('path');
const fs      = require('fs');
const pino    = require('pino');
const supabase = require('../lib/supabase');

const AUTH_PATH = '/tmp/baileys-auth';

let sock       = null;
let qrCode     = null;
let isReady    = false;
let isIniting  = false;

// ─── Initialize WhatsApp ──────────────────────────────────────
async function initClient() {
  if (isIniting) return;
  isIniting = true;

  try {
    // Create auth directory
    if (!fs.existsSync(AUTH_PATH)) fs.mkdirSync(AUTH_PATH, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);

    sock = makeWASocket({
      auth:   state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      browser: ['OrderFlow', 'Chrome', '1.0'],
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode  = qr;
        isReady = false;
        console.log('[WhatsApp] QR Code ready — scan with your phone');
      }

      if (connection === 'close') {
        isReady   = false;
        isIniting = false;
        const shouldReconnect = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
          : true;

        console.log('[WhatsApp] Connection closed. Reconnect:', shouldReconnect);
        if (shouldReconnect) {
          setTimeout(() => initClient(), 5000);
        } else {
          // Logged out — clear auth
          fs.rmSync(AUTH_PATH, { recursive: true, force: true });
          qrCode = null;
        }
      }

      if (connection === 'open') {
        isReady   = true;
        isIniting = false;
        qrCode    = null;
        console.log('[WhatsApp] ✅ Connected!');
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    isIniting = false;
    console.error('[WhatsApp] Init error:', err.message);
    setTimeout(() => initClient(), 10000);
  }
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
  return digits + '@s.whatsapp.net';
}

// ─── Send message ─────────────────────────────────────────────
async function sendMessage(phone, message) {
  if (!isReady || !sock) {
    console.warn('[WhatsApp] Not ready — skipping for', phone);
    return { status: 'skipped' };
  }
  const jid = formatPhone(phone);
  if (!jid) throw new Error('Invalid phone: ' + phone);
  await sock.sendMessage(jid, { text: message });
  console.log('[WhatsApp] ✅ Sent to', phone);
  return { status: 'sent' };
}

// ─── Templates ────────────────────────────────────────────────
function msgOrderConfirmed(order) {
  return `Hello ${order.customer_name}! 👋\n\n✅ *Order Confirmed*\n\nYour order *#${order.shopify_order_number}* has been received.\n\n🛍 *Items:* ${order.order_detail || 'Your items'}\n💰 *Amount:* PKR ${Number(order.total_price||0).toLocaleString()}\n💳 *Payment:* ${order.payment_method || 'COD'}\n📍 *Delivery to:* ${order.shipping_city}\n\nThank you for shopping with us! 🙏`;
}

function msgOrderBooked(order) {
  return `Hello ${order.customer_name}! 📦\n\nYour order *#${order.shopify_order_number}* has been booked with PostEx.\n\n🔖 *Tracking No:* ${order.postex_cn}\n📍 *Delivering to:* ${order.shipping_city}\n💰 *Amount:* PKR ${Number(order.total_price||0).toLocaleString()}\n\nTrack: https://postex.pk/tracking?cn=${order.postex_cn}\n\nExpected delivery: 2-4 working days 🚚`;
}

function msgOrderShipped(order) {
  return `Hello ${order.customer_name}! 🚚\n\nYour order *#${order.shopify_order_number}* is *On the Way!*\n\n📦 *PostEx Tracking:* ${order.postex_cn}\n📍 *Delivering to:* ${order.shipping_city}\n\nTrack: https://postex.pk/tracking?cn=${order.postex_cn}\n\nPlease keep your phone available for the rider 📞`;
}

function msgOrderDelivered(order) {
  return `Hello ${order.customer_name}! 🎉\n\nYour order *#${order.shopify_order_number}* has been *Delivered!*\n\nThank you for shopping with us! ⭐`;
}

// ─── Notify customer ──────────────────────────────────────────
async function notifyCustomer(event, order) {
  if (!order.customer_phone) return null;

  const templates = { confirmed: msgOrderConfirmed, booked: msgOrderBooked, shipped: msgOrderShipped, delivered: msgOrderDelivered };
  const buildMsg  = templates[event];
  if (!buildMsg) return null;

  try {
    const message = buildMsg(order);
    const result  = await sendMessage(order.customer_phone, message);

    await supabase.from('whatsapp_logs').insert({
      order_id: order.id, phone: order.customer_phone,
      event, message, status: result.status || 'sent',
    }).catch(() => {});

    return result;
  } catch (err) {
    console.error('[WhatsApp] Failed:', err.message);
    await supabase.from('whatsapp_logs').insert({
      order_id: order.id, phone: order.customer_phone,
      event, status: 'failed', error: err.message,
    }).catch(() => {});
    return null;
  }
}

// Auto-init
initClient().catch(e => console.error('[WhatsApp] Startup error:', e.message));

module.exports = { sendMessage, notifyCustomer, getStatus, initClient };
