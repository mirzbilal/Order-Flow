// backend/cron/trackingSync.js
const cron      = require('node-cron');
const supabase  = require('../lib/supabase');
const postex    = require('../services/postexService');
const whatsapp  = require('../services/whatsappService');

function startCronJobs() {

  // ── Every hour: sync PostEx tracking + fire WhatsApp on delivery ──
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Syncing PostEx tracking...');
    try {
      const { data: shipments } = await supabase
        .from('shipments')
        .select('postex_cn, order_id, status')
        .in('status', ['booked', 'in_transit']);

      if (!shipments?.length) return console.log('[CRON] No active shipments');

      const cns = shipments.map(s => s.postex_cn);

      for (let i = 0; i < cns.length; i += 10) {
        const batch = cns.slice(i, i + 10);
        try {
          const result      = await postex.trackMultiple(batch);
          const trackingList = Array.isArray(result.dist) ? result.dist : [];

          for (const t of trackingList) {
            const cn             = t.trackingNumber;
            const internalStatus = postex.mapPostexStatus(t.orderStatus || '');
            const shipment       = shipments.find(s => s.postex_cn === cn);

            // Update order + shipment status
            await supabase.from('orders')
              .update({ postex_status: t.orderStatus, status: internalStatus })
              .eq('postex_cn', cn);
            await supabase.from('shipments')
              .update({ status: internalStatus, tracking_history: t })
              .eq('postex_cn', cn);

            // 📱 If newly delivered → send WhatsApp
            if (internalStatus === 'delivered' && shipment?.status !== 'delivered') {
              const { data: order } = await supabase
                .from('orders').select('*').eq('postex_cn', cn).single();
              if (order) {
                whatsapp.notifyCustomer('delivered', order).catch(e =>
                  console.error('[CRON][WhatsApp] delivered failed:', e.message)
                );
              }
            }

            // 📱 If newly in_transit (shipped) → send WhatsApp
            if (internalStatus === 'in_transit' && shipment?.status === 'booked') {
              const { data: order } = await supabase
                .from('orders').select('*').eq('postex_cn', cn).single();
              if (order) {
                whatsapp.notifyCustomer('shipped', order).catch(e =>
                  console.error('[CRON][WhatsApp] shipped failed:', e.message)
                );
              }
            }
          }
        } catch (e) {
          console.error('[CRON] Batch error:', e.message);
        }
      }
      console.log(`[CRON] Synced ${cns.length} shipments`);
    } catch (e) {
      console.error('[CRON] Tracking sync failed:', e.message);
    }
  });

  // ── Every 6 hours: pull new Shopify orders + send "confirmed" WhatsApp ──
  cron.schedule('0 */6 * * *', async () => {
    console.log('[CRON] Syncing Shopify orders...');
    try {
      const shopifyService = require('../services/shopifyService');
      const orders         = await shopifyService.fetchUnfulfilledOrders(250);
      let created = 0;

      for (const so of orders) {
        const { data: existing } = await supabase
          .from('orders').select('id').eq('shopify_order_id', String(so.id)).maybeSingle();
        if (existing) continue;

        const normalized = shopifyService.normalizeOrder(so);
        const { data: newOrder, error } = await supabase
          .from('orders').insert(normalized).select().single();

        if (!error && newOrder) {
          created++;
          // 📱 Send "confirmed" WhatsApp for new order
          whatsapp.notifyCustomer('confirmed', newOrder).catch(e =>
            console.error('[CRON][WhatsApp] confirmed failed:', e.message)
          );
        }
      }
      console.log(`[CRON] Shopify sync: ${created} new orders`);
    } catch (e) {
      console.error('[CRON] Shopify sync failed:', e.message);
    }
  });
}

module.exports = { startCronJobs };
