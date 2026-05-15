const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const supabase = require('../lib/supabase');
const shopify  = require('../services/shopifyService');
const whatsapp = require('../services/whatsappService');

// ─── POST /api/shopify/sync ───────────────────────────────────
router.post('/sync', async (req, res) => {
  try {
    // Fetch ALL unfulfilled orders newest first
    const shopifyOrders = await shopify.fetchAllUnfulfilledOrders();
    let created = 0, skipped = 0, errors = 0;

    if (shopifyOrders.length === 0) {
      return res.json({ success: true, total: 0, created: 0, skipped: 0, errors: 0, message: 'No unfulfilled orders found' });
    }

    // Get existing IDs to skip duplicates
    const ids = shopifyOrders.map(o => String(o.id));
    const { data: existing } = await supabase
      .from('orders').select('shopify_order_id').in('shopify_order_id', ids);
    const existingIds = new Set((existing || []).map(o => o.shopify_order_id));

    // Build rows to insert
    const toInsert = [];
    for (const so of shopifyOrders) {
      if (existingIds.has(String(so.id))) { skipped++; continue; }
      try {
        toInsert.push(shopify.normalizeOrder(so));
      } catch (e) { errors++; console.error('Normalize error:', e.message); }
    }

    // Bulk insert
    if (toInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from('orders').insert(toInsert).select();
      if (error) {
        console.error('Insert error:', error.message);
        errors += toInsert.length;
      } else {
        created = inserted?.length || toInsert.length;
        // WhatsApp notifications async
        (inserted || []).forEach(order => {
          whatsapp.notifyCustomer('confirmed', order).catch(e =>
            console.error('[WhatsApp]', e.message)
          );
        });
      }
    }

    res.json({ success: true, total: shopifyOrders.length, created, skipped, errors });
  } catch (err) {
    console.error('Sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/shopify/sync-status ────────────────────────────
router.get('/sync-status', async (req, res) => {
  const { data } = await supabase
    .from('shopify_sync_log').select('*')
    .order('synced_at', { ascending: false }).limit(5);
  res.json({ logs: data || [] });
});

// ─── POST /api/shopify/register-webhooks ─────────────────────
router.post('/register-webhooks', async (req, res) => {
  try {
    const baseUrl = process.env.BACKEND_URL || req.body.baseUrl;
    if (!baseUrl) return res.status(400).json({ error: 'BACKEND_URL not set' });
    const results = await shopify.registerWebhooks(baseUrl);
    res.json({ success: true, webhooks: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/shopify/webhook ────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const secret     = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (secret && hmacHeader) {
      const digest = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
      if (digest !== hmacHeader) return res.status(401).json({ error: 'Invalid HMAC' });
    }

    const topic = req.headers['x-shopify-topic'];
    const data  = JSON.parse(req.body.toString());
    res.status(200).json({ received: true });

    setImmediate(async () => {
      try {
        if (topic === 'orders/create') {
          const { data: existing } = await supabase
            .from('orders').select('id').eq('shopify_order_id', String(data.id)).maybeSingle();
          if (!existing) {
            const normalized = shopify.normalizeOrder(data);
            const { data: newOrder } = await supabase.from('orders').insert(normalized).select().single();
            if (newOrder) whatsapp.notifyCustomer('confirmed', newOrder).catch(console.error);
          }
        }
        if (topic === 'orders/cancelled') {
          await supabase.from('orders').update({ status: 'cancelled' }).eq('shopify_order_id', String(data.id));
        }
      } catch (e) { console.error('[Webhook]', e.message); }
    });
  } catch (err) {
    console.error('[Webhook] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
