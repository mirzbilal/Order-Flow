// backend/cron/trackingSync.js
const cron     = require('node-cron');
const supabase = require('../lib/supabase');
const postex   = require('../services/postexService');

function startCronJobs() {

  // ── Every hour: sync PostEx tracking ─────────────────────────
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Syncing PostEx tracking...');
    try {
      const { data: shipments } = await supabase
        .from('orders')
        .select('id, postex_cn, status')
        .in('status', ['booked', 'in_transit'])
        .not('postex_cn', 'is', null);

      if (!shipments?.length) return console.log('[CRON] No active shipments');

      let updated = 0;
      for (const shipment of shipments) {
        try {
          const result = await postex.trackShipment(shipment.postex_cn);
          if (result?.dist?.length > 0) {
            const latest       = result.dist[0];
            const mappedStatus = postex.mapPostexStatus(latest?.orderStatus || '');
            if (mappedStatus && mappedStatus !== shipment.status) {
              await supabase.from('orders')
                .update({ status: mappedStatus, postex_status: latest.orderStatus })
                .eq('id', shipment.id);

              // WhatsApp notification for delivered
              if (mappedStatus === 'delivered') {
                try {
                  const whatsapp = require('../services/whatsappService');
                  const { data: order } = await supabase.from('orders').select('*').eq('id', shipment.id).single();
                  if (order) whatsapp.notifyCustomer('delivered', order).catch(console.error);
                } catch (e) { console.error('[CRON][WA]', e.message); }
              }
              updated++;
            }
          }
        } catch (e) {
          console.error(`[CRON] Track failed for ${shipment.postex_cn}:`, e.message);
        }
      }
      console.log(`[CRON] PostEx tracking: updated ${updated} shipments`);
    } catch (e) {
      console.error('[CRON] Tracking sync failed:', e.message);
    }
  });

  // ── Every 2 hours: auto sync ALL Shopify orders ───────────────
  cron.schedule('0 */2 * * *', async () => {
    console.log('[CRON] Auto syncing Shopify orders...');
    try {
      const axios    = require('axios');
      const shopify  = require('../services/shopifyService');
      const whatsapp = require('../services/whatsappService');

      // Get credentials
      const { data: connRow } = await supabase
        .from('settings').select('value').eq('key', 'shopify_connection').maybeSingle();
      if (!connRow?.value) return console.log('[CRON] Shopify not connected');

      const { shop, accessToken } = JSON.parse(connRow.value);
      const client = axios.create({
        baseURL: `https://${shop}/admin/api/2024-10`,
        headers: { 'X-Shopify-Access-Token': accessToken },
        timeout: 25000,
      });

      let totalCreated = 0;
      let page         = 1;
      let hasMore      = true;

      while (hasMore) {
        const { data } = await client.get('/orders.json', {
          params: { status:'open', fulfillment_status:'unfulfilled', limit:250 },
        });

        const orders = data.orders || [];
        if (orders.length === 0) break;

        // Check existing
        const ids = orders.map(o => String(o.id));
        const { data: existing } = await supabase
          .from('orders').select('shopify_order_id').in('shopify_order_id', ids);
        const existingIds = new Set((existing || []).map(o => o.shopify_order_id));

        const toInsert = orders
          .filter(o => !existingIds.has(String(o.id)))
          .map(o => shopify.normalizeOrder(o));

        if (toInsert.length > 0) {
          const { data: inserted } = await supabase.from('orders').insert(toInsert).select();
          totalCreated += inserted?.length || 0;
          (inserted || []).forEach(o =>
            whatsapp.notifyCustomer('confirmed', o).catch(() => {})
          );
        }

        hasMore = orders.length === 250;
        page++;

        // Safety: max 10 pages per run (2500 orders)
        if (page > 10) break;

        // Small delay between pages
        await new Promise(r => setTimeout(r, 1000));
      }

      console.log(`[CRON] Shopify sync: ${totalCreated} new orders imported`);
    } catch (e) {
      console.error('[CRON] Shopify auto sync failed:', e.message);
    }
  });

  console.log('✅ Cron jobs started: PostEx tracking (hourly), Shopify sync (every 2 hours)');
}

module.exports = { startCronJobs };
