// backend/services/whatsappService.js
// Safe WhatsApp service - won't crash server if baileys fails

let sock = null, qrCode = null, isReady = false, initError = null;

function getStatus() {
  return { isReady, hasQr: !!qrCode, qrCode, error: initError };
}

function initClient() {
  // Start async - don't block server startup
  setTimeout(() => _init().catch(e => {
    initError = e.message;
    console.error('[WA] Failed to start:', e.message);
  }), 3000);
}

async function _init() {
  try {
    const baileys = require('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;
    const { DisconnectReason, useMultiFileAuthState, Browsers } = baileys;
    const pino = require('pino');
    const fs   = require('fs');

    const AUTH = '/app/wa-auth';
    if (!fs.existsSync(AUTH)) fs.mkdirSync(AUTH, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH);

    sock = makeWASocket({
      auth:   state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) { qrCode = qr; isReady = false; console.log('[WA] QR ready!'); }
      if (connection === 'open')  { isReady = true; qrCode = null; console.log('[WA] ✅ Connected!'); }
      if (connection === 'close') {
        isReady = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) setTimeout(() => _init(), 10000);
        else { sock = null; qrCode = null; try { fs.rmSync(AUTH, { recursive:true, force:true }); } catch(_){} }
      }
    });
    sock.ev.on('creds.update', saveCreds);
    console.log('[WA] Baileys started');
  } catch (err) {
    initError = err.message;
    console.error('[WA] Init error:', err.message);
  }
}

function formatPhone(phone) {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = '92' + d.slice(1);
  return d + '@s.whatsapp.net';
}

async function sendMessage(phone, message) {
  if (!isReady || !sock) return { status: 'skipped' };
  try {
    await sock.sendMessage(formatPhone(phone), { text: message });
    return { status: 'sent' };
  } catch (err) { return { status: 'failed', error: err.message }; }
}

function buildMessage(event, order) {
  const n = order.customer_name || 'Customer';
  const num = `#${order.shopify_order_number}`;
  const amt = `PKR ${Number(order.total_price||0).toLocaleString()}`;
  const cn  = order.postex_cn || '';
  const msgs = {
    confirmed: `Hello ${n}! 👋\n\n✅ *Order Confirmed*\n\nOrder *${num}* received.\n🛍 ${order.order_detail||'Your items'}\n💰 ${amt}\n💳 ${order.payment_method||'COD'}\n📍 ${order.shipping_city||''}\n\nThank you! 🙏`,
    booked:    `Hello ${n}! 📦\n\nOrder *${num}* booked.\n\n🔖 Tracking: *${cn}*\nTrack: https://postex.pk/tracking?cn=${cn} 🚚`,
    shipped:   `Hello ${n}! 🚚\n\nOrder *${num}* is on the way!\n📦 PostEx: *${cn}*`,
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
    try {
      const supabase = require('../lib/supabase');
      await supabase.from('whatsapp_logs').insert({
        order_id: order.id, phone: order.customer_phone,
        event, message, status: result.status,
      });
    } catch(_) {}
    return result;
  } catch (err) { return null; }
}

// Init safely after server starts
initClient();

module.exports = { sendMessage, notifyCustomer, getStatus, initClient };
