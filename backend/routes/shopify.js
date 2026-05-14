// backend/routes/shopify.js
const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const supabase = require('../lib/supabase');
const shopify  = require('../services/shopifyService');

// ─── POST /api/shopify/sync ───────────────────────────────────
// Manually pull unfulfilled orders from Shopify
router.post('/sync', async (req, res) => {
  try {
    const shopifyOrders = await shopify.fetchUnfulfilledOrders(250);
    let created = 0, skipped = 0, errors = 0;

    for (const so of shopifyOrders) {
      try {
        // Check if already in DB
        const { data: existing } = await supabase
          .from('orders')
          .select('id')
          .eq('shopify_order_id', String(so.id))
          .maybeSingle();

        if (existing) { skipped++; continue; }

        const normalized = shopify.normalizeOrder(so);
        const { error } = await supabase.from('orders').insert(normalized);
        if (error) { errors++; console.error('Insert error:', error.message); }
        else created++;
      } catch (e) {
        errors++;
        console.error('Order sync error:', e.message);
      }
    }

    // Log sync
    await supabase.from('shopify_sync_log').insert({
      event_type: 'manual_sync',
      status: 'success',
      details: { total: shopifyOrders.length, created, skipped, errors },
    });

    res.json({ success: true, total: shopifyOrders.length, created, skipped, errors });
  } catch (err) {
    await supabase.from('shopify_sync_log').insert({
      event_type: 'manual_sync',
      status: 'error',
      details: { error: err.message },
    });
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/shopify/sync-status ────────────────────────────
router.get('/sync-status', async (req, res) => {
  try {
    const { data } = await supabase
      .from('shopify_sync_log')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(10);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/shopify/register-webhooks ─────────────────────
router.post('/register-webhooks', async (req, res) => {
  try {
    const { appUrl } = req.body;
    if (!appUrl) return res.status(400).json({ error: 'appUrl required' });

    const webhooks = [
      { topic: 'orders/create',  address: `${appUrl}/api/shopify/webhook` },
      { topic: 'orders/updated', address: `${appUrl}/api/shopify/webhook` },
      { topic: 'orders/cancelled', address: `${appUrl}/api/shopify/webhook` },
    ];

    const results = [];
    for (const wh of webhooks) {
      try {
        const result = await shopify.registerWebhook(wh.topic, wh.address);
        results.push({ topic: wh.topic, id: result.id, status: 'registered' });
      } catch (e) {
        results.push({ topic: wh.topic, status: 'error', error: e.message });
      }
    }
    res.json({ webhooks: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/shopify/webhook ────────────────────────────────
// Receives real-time Shopify order events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // 1. Verify HMAC signature
    const hmac      = req.headers['x-shopify-hmac-sha256'];
    const secret    = process.env.SHOPIFY_WEBHOOK_SECRET;
    const body      = req.body; // raw Buffer

    if (secret && hmac) {
      const digest = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('base64');
      if (digest !== hmac) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const topic = req.headers['x-shopify-topic'];
    const data  = JSON.parse(body.toString());

    res.status(200).json({ received: true }); // respond fast

    // 2. Process async
    setImmediate(async () => {
      try {
        if (topic === 'orders/create') {
          const existing = await supabase
            .from('orders')
            .select('id')
            .eq('shopify_order_id', String(data.id))
            .maybeSingle();

          if (!existing.data) {
            const normalized = shopify.normalizeOrder(data);
            const { data: newOrder } = await supabase.from('orders').insert(normalized).select().single();
            // 📱 WhatsApp: notify customer order is confirmed
            if (newOrder) {
              const whatsapp = require('../services/whatsappService');
              whatsapp.notifyCustomer('confirmed', newOrder).catch(e =>
                console.error('[Webhook][WhatsApp] confirmed failed:', e.message)
              );
            }
          }
        }

        if (topic === 'orders/updated') {
          const { financial_status, fulfillment_status } = data;
          const updates = {};
          if (financial_status === 'paid') updates.payment_method = 'Prepaid';
          if (fulfillment_status === 'fulfilled') updates.shopify_fulfilled = true;
          if (Object.keys(updates).length) {
            await supabase.from('orders')
              .update(updates)
              .eq('shopify_order_id', String(data.id));
          }
        }

        if (topic === 'orders/cancelled') {
          await supabase.from('orders')
            .update({ status: 'cancelled' })
            .eq('shopify_order_id', String(data.id));
        }

        await supabase.from('shopify_sync_log').insert({
          event_type: topic,
          shopify_order_id: String(data.id),
          status: 'success',
          details: { topic },
        });
      } catch (e) {
        console.error('Webhook processing error:', e.message);
        await supabase.from('shopify_sync_log').insert({
          event_type: topic,
          shopify_order_id: String(data.id),
          status: 'error',
          details: { error: e.message },
        });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
