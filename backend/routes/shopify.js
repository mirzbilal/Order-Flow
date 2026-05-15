const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const axios    = require('axios');
const supabase = require('../lib/supabase');
const shopify  = require('../services/shopifyService');
const whatsapp = require('../services/whatsappService');

async function getShopifyClient() {
  const { data } = await supabase
    .from('settings').select('value').eq('key', 'shopify_connection').maybeSingle();
  let shop, accessToken;
  if (data?.value) {
    const conn = JSON.parse(data.value);
    shop = conn.shop; accessToken = conn.accessToken;
  } else if (process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN) {
    shop = process.env.SHOPIFY_STORE_URL; accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  } else throw new Error('Shopify not connected');
  return axios.create({
    baseURL: `https://${shop}/admin/api/2024-10`,
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    timeout: 25000,
  });
}

// ─── POST /api/shopify/sync ───────────────────────────────────
// Uses since_id to paginate through ALL orders
router.post('/sync', async (req, res) => {
  try {
    const client = await getShopifyClient();

    // Get the lowest shopify_order_id in our DB to find where to continue from
    const { data: minRow } = await supabase
      .from('orders')
      .select('shopify_order_id')
      .order('shopify_order_id', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Get the highest shopify_order_id to know what we already have
    const { data: maxRow } = await supabase
      .from('orders')
      .select('shopify_order_id')
      .order('shopify_order_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch older orders using since_id from the minimum we have
    // This gets orders BEFORE our oldest synced order
    const params = {
      status:             'any',  // get all statuses
      limit:              250,
    };

    // If we have orders, get older ones using the oldest ID minus 1
    if (minRow?.shopify_order_id) {
      // Get orders older than our minimum
      const { data: olderData } = await client.get('/orders.json', {
        params: { ...params, status: 'any', limit: 250 }
      });

      // Also try to get newer orders
      const { data: newerData } = await client.get('/orders.json', {
        params: { ...params, since_id: maxRow?.shopify_order_id || 0 }
      });

      const allFetched = [...(olderData?.orders || []), ...(newerData?.orders || [])];

      if (allFetched.length === 0) {
        return res.json({ success: true, total: 0, created: 0, skipped: 0, errors: 0 });
      }

      // Filter to unfulfilled only
      const unfulfilled = allFetched.filter(o => o.fulfillment_status !== 'fulfilled');

      // Check existing
      const ids = unfulfilled.map(o => String(o.id));
      const { data: existing } = await supabase
        .from('orders').select('shopify_order_id').in('shopify_order_id', ids);
      const existingIds = new Set((existing || []).map(o => o.shopify_order_id));

      const toInsert = unfulfilled
        .filter(o => !existingIds.has(String(o.id)))
        .map(o => { try { return shopify.normalizeOrder(o); } catch(e) { return null; } })
        .filter(Boolean);

      let created = 0;
      if (toInsert.length > 0) {
        const { data: inserted, error } = await supabase.from('orders').insert(toInsert).select();
        if (!error) {
          created = inserted?.length || 0;
          (inserted || []).forEach(o => whatsapp.notifyCustomer('confirmed', o).catch(() => {}));
        }
      }

      return res.json({ success: true, total: unfulfilled.length, created, skipped: unfulfilled.length - toInsert.length, errors: 0 });
    }

    // First sync — just get latest 250
    const { data } = await client.get('/orders.json', {
      params: { status: 'open', fulfillment_status: 'unfulfilled', limit: 250 },
    });
    const orders = data.orders || [];
    const toInsert = orders.map(o => { try { return shopify.normalizeOrder(o); } catch(e) { return null; } }).filter(Boolean);

    let created = 0;
    if (toInsert.length > 0) {
      const { data: inserted } = await supabase.from('orders').insert(toInsert).select();
      created = inserted?.length || 0;
    }

    res.json({ success: true, total: orders.length, created, skipped: 0, errors: 0 });
  } catch (err) {
    console.error('Sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/shopify/sync-all ──────────────────────────────
// Syncs ALL orders from Shopify using since_id pagination
router.post('/sync-all', async (req, res) => {
  try {
    const client = await getShopifyClient();
    let sinceId  = req.body.since_id || 0;
    let created  = 0, skipped = 0, total = 0;

    const { data } = await client.get('/orders.json', {
      params: {
        status:   'any',
        limit:    250,
        since_id: sinceId,
      },
    });

    const orders = data.orders || [];
    total = orders.length;

    if (orders.length > 0) {
      const ids = orders.map(o => String(o.id));
      const { data: existing } = await supabase
        .from('orders').select('shopify_order_id').in('shopify_order_id', ids);
      const existingIds = new Set((existing || []).map(o => o.shopify_order_id));

      const toInsert = orders
        .filter(o => !existingIds.has(String(o.id)) && o.fulfillment_status !== 'fulfilled')
        .map(o => { try { return shopify.normalizeOrder(o); } catch(e) { return null; } })
        .filter(Boolean);

      skipped = orders.length - toInsert.length;

      if (toInsert.length > 0) {
        const { data: inserted } = await supabase.from('orders').insert(toInsert).select();
        created = inserted?.length || 0;
        (inserted || []).forEach(o => whatsapp.notifyCustomer('confirmed', o).catch(() => {}));
      }
    }

    // Return the last ID so client can paginate
    const lastId  = orders.length > 0 ? orders[orders.length - 1].id : null;
    const hasMore = orders.length === 250;

    res.json({ success: true, total, created, skipped, errors: 0, lastId, hasMore });
  } catch (err) {
    console.error('Sync-all error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/shopify/sync-status ────────────────────────────
router.get('/sync-status', async (req, res) => {
  try {
    const { data } = await supabase
      .from('shopify_sync_log').select('*')
      .order('synced_at', { ascending: false }).limit(5);
    res.json({ logs: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    const body  = JSON.parse(req.body.toString());
    res.status(200).json({ received: true });
    setImmediate(async () => {
      try {
        if (topic === 'orders/create') {
          const { data: ex } = await supabase
            .from('orders').select('id').eq('shopify_order_id', String(body.id)).maybeSingle();
          if (!ex) {
            const norm = shopify.normalizeOrder(body);
            const { data: newOrder } = await supabase.from('orders').insert(norm).select().single();
            if (newOrder) whatsapp.notifyCustomer('confirmed', newOrder).catch(console.error);
          }
        }
        if (topic === 'orders/cancelled') {
          await supabase.from('orders').update({ status:'cancelled' }).eq('shopify_order_id', String(body.id));
        }
      } catch (e) { console.error('[Webhook]', e.message); }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
