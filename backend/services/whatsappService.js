// backend/services/whatsappService.js
// Safe WhatsApp service - won't crash if baileys fails

let waClient = null;
let qrCode   = null;
let isReady  = false;
let initErr  = null;

// Try to load baileys - if it fails, WhatsApp just won't work
async function initClient() {
  try {
    const baileys = require('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;
    const { DisconnectReason, useMultiFileAuthState } = baileys;
    const { Boom } = require('@hapi/boom');
    const pino = require('pino');
    const fs   = require('fs');

    const AUTH_PATH = '/tmp/wa-auth';
    if (!fs.existsSync(AUTH_PATH)) fs.mkdirSync(AUTH_PATH, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);

    waClient = makeWASocket({
      auth:   state,
      logger: pino({ level: 'silent' }),
      browser: ['OrderFlow', 'Chrome', '1.0'],
    });

    waClient.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) { qrCode = qr; isReady = false; console.log('[WA] QR ready'); }
      if (connection === 'open')  { isReady = true; qrCode = null; console.log('[WA] ✅ Connected!'); }
      if (connection === 'close') {
        isReady = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) setTimeout(initClient, 5000);
        else { fs.rmSync(AUTH_PATH, { recursive:true, force:true }); qrCode=null; waClient=null; }
      }
    });
    waClient.ev.on('creds.update', saveCreds);
    console.log('[WA] Initializing...');
  } catch (err) {
    initErr = err.message;
    console.error('[WA] Could not start:', err.message);
  }
}

function getStatus() {
  return { isReady, hasQr: !!qrCode, qrCode, error: initErr };
}

function formatPhone(phone) {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = '92' + d.slice(1);
  else if (d.length === 10) d = '92' + d;
  return d + '@s.whatsapp.net';
}

async function sendMessage(phone, message) {
  if (!isReady || !waClient) return { status: 'skipped', reason: 'not connected' };
  try {
    const jid = formatPhone(phone);
    if (!jid) return { status: 'skipped', reason: 'invalid phone' };
    await waClient.sendMessage(jid, { text: message });
    return { status: 'sent' };
  } catch (err) {
    console.error('[WA] Send error:', err.message);
    return { status: 'failed', error: err.message };
  }
}

function buildMessage(event, order) {
  const n = order.customer_name || 'Customer';
  const num = `#${order.shopify_order_number}`;
  const amt = `PKR ${Number(order.total_price||0).toLocaleString()}`;
  const city = order.shipping_city || '';
  const cn = order.postex_cn || '';
  const msgs = {
    confirmed: `Hello ${n}! 👋\n\n✅ *Order Confirmed*\n\nOrder *${num}* received.\n🛍 ${order.order_detail||'Your items'}\n💰 ${amt}\n💳 ${order.payment_method||'COD'}\n📍 ${city}\n\nThank you! 🙏`,
    booked:    `Hello ${n}! 📦\n\nOrder *${num}* booked with PostEx.\n\n🔖 Tracking: *${cn}*\n📍 ${city}\n\nTrack: https://postex.pk/tracking?cn=${cn} 🚚`,
    shipped:   `Hello ${n}! 🚚\n\nOrder *${num}* is on the way!\n\n📦 PostEx: *${cn}*\nTrack: https://postex.pk/tracking?cn=${cn}\n\nKeep phone available 📞`,
    delivered: `Hello ${n}! 🎉\n\nOrder *${num}* has been delivered!\n\nThank you for shopping! ⭐`,
  };
  return msgs[event] || null;
}

async function notifyCustomer(event, order) {
  if (!order?.customer_phone) return null;
  const message = buildMessage(event, order);
  if (!message) return null;
  try {
    const result = await sendMessage(order.customer_phone, message);
    // Log to DB silently
    try {
      const supabase = require('../lib/supabase');
      await supabase.from('whatsapp_logs').insert({
        order_id: order.id, phone: order.customer_phone,
        event, message, status: result.status,
      });
    } catch (_) {}
    return result;
  } catch (err) {
    console.error('[WA] notifyCustomer error:', err.message);
    return null;
  }
}

// Start safely - don't crash the app if baileys fails
initClient().catch(e => console.error('[WA] Init failed:', e.message));

module.exports = { sendMessage, notifyCustomer, getStatus, initClient };
