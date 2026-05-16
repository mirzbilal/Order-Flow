// backend/services/whatsappService.js
// WhatsApp via @whiskeysockets/baileys - FREE, no monthly fees
// Runs perfectly on Railway (supports WebSockets)

let sock      = null;
let qrCode    = null;
let isReady   = false;
let isIniting = false;
let initError = null;

async function initClient() {
  if (isIniting) return;
  isIniting = true;
  initError = null;
  console.log('[WA] Starting baileys...');

  try {
    const baileys = require('@whiskeysockets/baileys');
    const makeWASocket          = baileys.default;
    const { DisconnectReason, useMultiFileAuthState } = baileys;
    const pino = require('pino');
    const fs   = require('fs');

    const AUTH = '/app/wa-auth';
    if (!fs.existsSync(AUTH)) fs.mkdirSync(AUTH, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH);
    console.log('[WA] Auth state loaded');

    const { Browsers } = baileys;
    sock = makeWASocket({
      auth:   state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory:              false,
      markOnlineOnConnect:          false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs:             60000,
      keepAliveIntervalMs:          25000,
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      console.log('[WA] connection.update:', connection || 'pending', 'hasQR:', !!qr);

      if (qr) {
        qrCode    = qr;
        isReady   = false;
        isIniting = false;
        console.log('[WA] ✅ QR Code ready — scan with WhatsApp!');
      }

      if (connection === 'open') {
        isReady   = true;
        isIniting = false;
        qrCode    = null;
        console.log('[WA] ✅ WhatsApp Connected!');
      }

      if (connection === 'close') {
        isReady   = false;
        isIniting = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        console.log('[WA] Disconnected. Code:', code, 'LoggedOut:', loggedOut);
        if (!loggedOut) {
          console.log('[WA] Reconnecting in 5s...');
          setTimeout(() => initClient(), 5000);
        } else {
          try { fs.rmSync(AUTH, { recursive: true, force: true }); } catch(_) {}
          sock   = null;
          qrCode = null;
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);
    console.log('[WA] Socket created, waiting for QR...');

  } catch (err) {
    isIniting = false;
    initError = err.message;
    console.error('[WA] Init error:', err.message);
    setTimeout(() => initClient(), 15000);
  }
}

function getStatus() {
  return { isReady, hasQr: !!qrCode, qrCode, error: initError, isIniting };
}

function formatPhone(phone) {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = '92' + d.slice(1);
  else if (d.length === 10) d = '92' + d;
  return d + '@s.whatsapp.net';
}

async function sendMessage(phone, message) {
  if (!isReady || !sock) {
    console.warn('[WA] Not ready — skipping for', phone);
    return { status: 'skipped' };
  }
  try {
    const jid = formatPhone(phone);
    if (!jid) return { status: 'skipped', reason: 'invalid phone' };
    await sock.sendMessage(jid, { text: message });
    console.log('[WA] ✅ Sent to', phone);
    return { status: 'sent' };
  } catch (err) {
    console.error('[WA] Send error:', err.message);
    return { status: 'failed', error: err.message };
  }
}

function buildMessage(event, order) {
  const n   = order.customer_name || 'Customer';
  const num = `#${order.shopify_order_number}`;
  const amt = `PKR ${Number(order.total_price||0).toLocaleString()}`;
  const cn  = order.postex_cn || '';
  const msgs = {
    confirmed: `Hello ${n}! 👋\n\n✅ *Order Confirmed*\n\nYour order *${num}* has been received.\n\n🛍 ${order.order_detail||'Your items'}\n💰 ${amt}\n💳 ${order.payment_method||'COD'}\n📍 ${order.shipping_city||''}\n\nThank you for shopping with us! 🙏`,
    booked:    `Hello ${n}! 📦\n\nYour order *${num}* has been booked with PostEx.\n\n🔖 *Tracking:* ${cn}\n📍 ${order.shipping_city||''}\n\nTrack: https://postex.pk/tracking?cn=${cn}\n\nExpected: 2-4 working days 🚚`,
    shipped:   `Hello ${n}! 🚚\n\nYour order *${num}* is *On the Way!*\n\n📦 PostEx: *${cn}*\nTrack: https://postex.pk/tracking?cn=${cn}\n\nKeep your phone available 📞`,
    delivered: `Hello ${n}! 🎉\n\nYour order *${num}* has been *Delivered!*\n\nThank you for shopping with us! ⭐`,
  };
  return msgs[event] || null;
}

async function notifyCustomer(event, order) {
  if (!order?.customer_phone) return null;
  const message = buildMessage(event, order);
  if (!message) return null;
  try {
    const result = await sendMessage(order.customer_phone, message);
    try {
      const supabase = require('../lib/supabase');
      await supabase.from('whatsapp_logs').insert({
        order_id: order.id, phone: order.customer_phone,
        event, message, status: result.status,
      });
    } catch(_) {}
    return result;
  } catch (err) {
    console.error('[WA] notifyCustomer error:', err.message);
    return null;
  }
}

// Start on load
initClient().catch(e => console.error('[WA] Startup error:', e.message));

module.exports = { sendMessage, notifyCustomer, getStatus, initClient };
