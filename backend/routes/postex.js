// backend/routes/postex.js
const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');
const postex   = require('../services/postexService');

// ─── GET /api/postex/cities ───────────────────────────────────
router.get('/cities', async (req, res) => {
  try {
    const data = await postex.getCities();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/postex/track/:cn ────────────────────────────────
router.get('/track/:cn', async (req, res) => {
  try {
    const data = await postex.trackShipment(req.params.cn);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/postex/track-bulk ──────────────────────────────
// Body: { trackingNumbers: ['CN1','CN2',...] }
router.post('/track-bulk', async (req, res) => {
  try {
    const { trackingNumbers = [] } = req.body;
    if (!trackingNumbers.length) return res.status(400).json({ error: 'trackingNumbers required' });
    const data = await postex.trackMultiple(trackingNumbers);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/postex/webhook ─────────────────────────────────
// PostEx calls this URL when shipment status changes
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    res.status(200).json({ received: true }); // respond immediately

    setImmediate(async () => {
      try {
        await supabase.from('postex_webhook_log').insert({
          cn:         payload.trackingNumber || payload.cn,
          event_data: payload,
          received_at: new Date().toISOString(),
        });

        const cn = payload.trackingNumber || payload.cn;
        if (!cn) return;

        const postexStatus = payload.orderStatus || payload.status || '';
        const internalStatus = postex.mapPostexStatus(postexStatus);

        // Update order
        await supabase.from('orders')
          .update({
            postex_status: postexStatus,
            status:        internalStatus,
          })
          .eq('postex_cn', cn);

        // Update shipment — append to tracking history
        const { data: shipment } = await supabase
          .from('shipments')
          .select('tracking_history')
          .eq('postex_cn', cn)
          .maybeSingle();

        if (shipment) {
          const history = shipment.tracking_history || [];
          history.push({
            status:    postexStatus,
            timestamp: new Date().toISOString(),
            raw:       payload,
          });
          await supabase.from('shipments')
            .update({
              status:           internalStatus,
              tracking_history: history,
              ...(internalStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
            })
            .eq('postex_cn', cn);
        }

        // Mark log as processed
        await supabase.from('postex_webhook_log')
          .update({ processed: true })
          .eq('cn', cn)
          .order('received_at', { ascending: false })
          .limit(1);

      } catch (e) {
        console.error('PostEx webhook error:', e.message);
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/postex/sync-tracking ──────────────────────────
// Manually refresh tracking for all in-transit orders
router.post('/sync-tracking', async (req, res) => {
  try {
    const { data: shipments } = await supabase
      .from('shipments')
      .select('postex_cn, order_id')
      .in('status', ['booked', 'in_transit']);

    if (!shipments?.length) return res.json({ updated: 0 });

    const cns = shipments.map(s => s.postex_cn);
    // Track in batches of 10
    let updated = 0;
    for (let i = 0; i < cns.length; i += 10) {
      const batch = cns.slice(i, i + 10);
      try {
        const result = await postex.trackMultiple(batch);
        const trackingList = result.dist || [];
        for (const t of trackingList) {
          const cn = t.trackingNumber;
          const internalStatus = postex.mapPostexStatus(t.orderStatus || '');
          await supabase.from('orders').update({
            postex_status: t.orderStatus,
            status: internalStatus,
          }).eq('postex_cn', cn);
          await supabase.from('shipments').update({
            status: internalStatus,
          }).eq('postex_cn', cn);
          updated++;
        }
      } catch (e) {
        console.error('Batch tracking error:', e.message);
      }
    }

    res.json({ success: true, updated, total: shipments.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
