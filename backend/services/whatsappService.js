// backend/services/whatsappService.js
// WhatsApp via @whiskeysockets/baileys - No Chrome needed

let makeWASocket, DisconnectReason, useMultiFileAuthState, Boom, pino;

try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default;
  DisconnectReason = baileys.DisconnectReason;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  Boom = require('@hapi/boom').Boom;
  pino = require('pino');
} catch (e) {
  console.error('[WhatsApp] Failed to load baileys:', e.message);
}

const fs      = require('fs');
const supabase = require('../lib/supabase');

const AUTH_PATH = '/tmp/baileys-auth';

let sock      = null;
let qrCode    = null;
let isReady   = false;
let isIniting = false;
let initError = null;

// ─── Initialize ───────────────────────────────────────────────
async function initClient() {
  if (!makeWASocket) {
    initError = 'Baileys not installed — run npm install';
    console.error('[WhatsApp]', initError);
    return;
  }
  if (isIniting) return;
  isIniting = true;
  initError = null;

  try {
    if (!fs.existsSync(AUTH_PATH)) fs.mkdirSync(AUTH_PATH, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);

    sock = makeWASocket({
      auth:   state,
      logger: pino({ level: 'silent' }),
      browser: ['OrderFlow', 'Chrome', '1.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode  = qr;
        isReady = false;
        console.log('[WhatsApp] QR Code ready — scan with your phone');
      }

      if (connection === 'close') {
        isReady   = false;
        isIniting = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        console.log('[WhatsApp] Disconnected, code:', code, 'reconnect:', shouldReconnect);
        if (shouldReconnect) {
          setTimeout(() => initClient(), 5000);
        } else {
          fs.rmSync(AUTH_PATH, { recursive: true, force: true });
          qrCode = null;
          sock   = null;
        }
      }

      if (connection === 'open') {
        isReady   = true;
        isIniting = false;
        qrCode    = null;
        console.log('[WhatsApp] ✅ Connected and ready!');
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    isIniting = false;
    initError = err.message;
    console.error('[WhatsApp] Init error:', err.message);
    setTimeout(() => initClient(), 15000);
  }
}

function getStatus() {
  return { isReady, hasQr: !!qrCode, qrCode, error: initError, isIniting };
}

function formatPhone(phone) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = '92' + d.slice(1);
  else if (d.length === 10) d = '92' + d;
  return d + '@s.whatsapp.net';
}

async function sendMessage(phone, message) {
  if (!isReady || !sock) {
    console.warn('[WhatsApp] Not ready — skipping for', phone);
    return { status: 'skipped' };
  }
  const jid = formatPhone(phone);
  if (!jid) return { status: 'skipped', reason: 'invalid phone' };
  await sock.sendMessage(jid, { text: message });
  return { status: 'sent' };
}

function msgConfirmed(o) { return `Hello ${o.customer_name}! 👋\n\n✅ *Order Confirmed*\n\nOrder *#${o.shopify_order_number}* received.\n🛍 ${o.order_detail||'Your items'}\n💰 PKR ${Number(o.total_price||0).toLocaleString()}\n💳 ${o.payment_method||'COD'}\n📍 ${o.shipping_city}\n\nThank you! 🙏`; }
function msgBooked(o)    { return `Hello ${o.customer_name}! 📦\n\nOrder *#${o.shopify_order_number}* booked with PostEx.\n\n🔖 Tracking: *${o.postex_cn}*\n📍 ${o.shipping_city}\n\nTrack: https://postex.pk/tracking?cn=${o.postex_cn} 🚚`; }
function msgShipped(o)   { return `Hello ${o.customer_name}! 🚚\n\nOrder *#${o.shopify_order_number}* is on the way!\n\n📦 PostEx: *${o.postex_cn}*\n\nTrack: https://postex.pk/tracking?cn=${o.postex_cn}\n\nKeep your phone available 📞`; }
function msgDelivered(o) { return `Hello ${o.customer_name}! 🎉\n\nOrder *#${o.shopify_order_number}* delivered!\n\nThank you for shopping with us! ⭐`; }

async function notifyCustomer(event, order) {
  if (!order?.customer_phone) return null;
  const templates = { confirmed:msgConfirmed, booked:msgBooked, shipped:msgShipped, delivered:msgDelivered };
  const fn = templates[event];
  if (!fn) return null;
  try {
    const message = fn(order);
    const result  = await sendMessage(order.customer_phone, message);
    await supabase.from('whatsapp_logs').insert({ order_id:order.id, phone:order.customer_phone, event, message, status:result.status||'sent' }).catch(()=>{});
    return result;
  } catch (err) {
    console.error('[WhatsApp] notifyCustomer error:', err.message);
    await supabase.from('whatsapp_logs').insert({ order_id:order.id, phone:order.customer_phone, event, status:'failed', error:err.message }).catch(()=>{});
    return null;
  }
}

// Start on load
initClient().catch(e => console.error('[WhatsApp] Startup:', e.message));

module.exports = { sendMessage, notifyCustomer, getStatus, initClient };
