// backend/services/whatsappService.js
let sock      = null;
let qrCode    = null;
let isReady   = false;
let initError = null;
let isIniting = false;

async function initClient() {
  if (isIniting) return;
  isIniting = true;
  console.log('[WA] Starting init...');

  try {
    console.log('[WA] Loading baileys...');
    const baileys = require('@whiskeysockets/baileys');
    console.log('[WA] Baileys loaded, version:', baileys.version || 'unknown');

    const makeWASocket          = baileys.default;
    const { DisconnectReason,
            useMultiFileAuthState } = baileys;
    const { Boom }  = require('@hapi/boom');
    const pino      = require('pino');
    const fs        = require('fs');

    const AUTH = '/tmp/wa-auth';
    if (!fs.existsSync(AUTH)) fs.mkdirSync(AUTH, { recursive: true });
    console.log('[WA] Auth directory ready');

    const { state, saveCreds } = await useMultiFileAuthState(AUTH);
    console.log('[WA] Auth state loaded');

    sock = makeWASocket({
      auth:   state,
      logger: pino({ level: 'silent' }),
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });

    console.log('[WA] Socket created, waiting for connection.update...');

    sock.ev.on('connection.update', (update) => {
      console.log('[WA] connection.update:', JSON.stringify({ 
        connection: update.connection, 
        hasQr: !!update.qr,
        hasError: !!update.lastDisconnect?.error 
      }));

      if (update.qr) {
        qrCode    = update.qr;
        isReady   = false;
        isIniting = false;
        console.log('[WA] ✅ QR Code generated!');
      }

      if (update.connection === 'open') {
        isReady   = true;
        isIniting = false;
        qrCode    = null;
        console.log('[WA] ✅ Connected and ready!');
      }

      if (update.connection === 'close') {
        isReady   = false;
        isIniting = false;
        const code = update.lastDisconnect?.error?.output?.statusCode;
        console.log('[WA] Connection closed, code:', code);
        if (code !== DisconnectReason.loggedOut) {
          console.log('[WA] Reconnecting in 5s...');
          setTimeout(() => initClient(), 5000);
        } else {
          fs.rmSync(AUTH, { recursive: true, force: true });
          sock   = null;
          qrCode = null;
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    isIniting = false;
    initError = err.message;
    console.error('[WA] ❌ Init error:', err.message);
    console.error('[WA] Stack:', err.stack?.split('\n')[1]);
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
  if (!isReady || !sock) return { status: 'skipped', reason: 'not connected' };
  try {
    const jid = formatPhone(phone);
    if (!jid) return { status: 'skipped', reason: 'invalid phone' };
    await sock.sendMessage(jid, { text: message });
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

function buildMessage(event, order) {
  const n   = order.customer_name || 'Customer';
  const num = `#${order.shopify_order_number}`;
  const amt = `PKR ${Number(order.total_price||0).toLocaleString()}`;
  const cn  = order.postex_cn || '';
  const msgs = {
    confirmed: `Hello ${n}! 👋\n\n✅ *Order Confirmed*\n\nOrder *${num}* received.\n🛍 ${order.order_detail||'Your items'}\n💰 ${amt}\n💳 ${order.payment_method||'COD'}\n📍 ${order.shipping_city||''}\n\nThank you! 🙏`,
    booked:    `Hello ${n}! 📦\n\nOrder *${num}* booked with PostEx.\n\n🔖 Tracking: *${cn}*\n\nTrack: https://postex.pk/tracking?cn=${cn} 🚚`,
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
    try {
      const supabase = require('../lib/supabase');
      await supabase.from('whatsapp_logs').insert({
        order_id: order.id, phone: order.customer_phone,
        event, message, status: result.status,
      });
    } catch (_) {}
    return result;
  } catch (err) {
    return null;
  }
}

// Start on load
initClient().catch(e => console.error('[WA] Startup error:', e.message));

module.exports = { sendMessage, notifyCustomer, getStatus, initClient };
