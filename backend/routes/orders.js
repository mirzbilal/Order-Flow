// backend/routes/orders.js
const express   = require('express');
const router    = express.Router();
const supabase  = require('../lib/supabase');
const postex    = require('../services/postexService');
const shopify   = require('../services/shopifyService');
const whatsapp  = require('../services/whatsappService');

// ─── GET /api/orders ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, channel, search, page = 1, limit = 20, date_from, date_to } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status && status !== 'all') query = query.eq('status', status);
    if (channel) query = query.eq('channel', channel);
    if (search)  query = query.or(
      `customer_name.ilike.%${search}%,shopify_order_number.ilike.%${search}%,postex_cn.ilike.%${search}%`
    );
    if (date_from) query = query.gte('created_at', `${date_from}T00:00:00.000Z`);
    if (date_to)   query = query.lte('created_at', `${date_to}T23:59:59.999Z`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ orders: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/orders/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, shipments(*)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ─── POST /api/orders/:id/book-postex ────────────────────────
// Books PostEx shipment + sends WhatsApp "booked" notification
router.post('/:id/book-postex', async (req, res) => {
  try {
    const { data: order, error: fetchErr } = await supabase
      .from('orders').select('*').eq('id', req.params.id).single();
    if (fetchErr) throw fetchErr;
    if (order.postex_cn) return res.status(400).json({ error: 'Already booked with PostEx' });

    const phone = order.customer_phone?.replace(/\D/g, '');
    if (!phone || phone.length < 10) return res.status(400).json({ error: 'Valid customer phone required' });
    if (!order.shipping_city) return res.status(400).json({ error: 'Shipping city required' });

    // 1. Book with PostEx
    const bookingResult = await postex.createShipment({
      orderRefNumber:  order.shopify_order_number || order.id,
      customerName:    order.customer_name,
      customerPhone:   phone.startsWith('0') ? phone : '0' + phone,
      deliveryAddress: order.shipping_address,
      cityName:        order.shipping_city,
      invoicePayment:  order.payment_method === 'COD' ? order.total_price : 0,
      orderDetail:     (order.line_items || []).map(i => `${i.quantity}x ${i.title}`).join(', '),
    });

    const cn = bookingResult.dist?.trackingNumber || bookingResult.trackingNumber;

    // 2. Save shipment
    await supabase.from('shipments').insert({
      order_id: order.id, postex_cn: cn, tracking_number: cn,
      status: 'booked', booking_response: bookingResult, booked_at: new Date().toISOString(),
    });

    // 3. Update order
    const { data: updatedOrder } = await supabase
      .from('orders')
      .update({ postex_cn: cn, postex_tracking: cn, postex_booked_at: new Date().toISOString(), status: 'booked' })
      .eq('id', order.id).select().single();

    // 4. 📱 Send WhatsApp "booked" notification
    whatsapp.notifyCustomer('booked', { ...order, postex_cn: cn }).catch(e =>
      console.error('[WhatsApp] booked notification failed:', e.message)
    );

    res.json({ success: true, tracking_number: cn, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/orders/:id/fulfill-shopify ────────────────────
// Fulfills on Shopify + sends WhatsApp "shipped" notification
router.post('/:id/fulfill-shopify', async (req, res) => {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id).single();

    if (!order.shopify_order_id) return res.status(400).json({ error: 'Not a Shopify order' });
    if (!order.postex_cn)        return res.status(400).json({ error: 'Book PostEx first' });
    if (order.shopify_fulfilled) return res.status(400).json({ error: 'Already fulfilled in Shopify' });

    const fulfillment = await shopify.fulfillOrder(order.shopify_order_id, order.postex_cn);

    await supabase.from('orders')
      .update({ shopify_fulfilled: true, status: 'in_transit' })
      .eq('id', req.params.id);

    // 📱 Send WhatsApp "shipped" notification
    whatsapp.notifyCustomer('shipped', { ...order, status: 'in_transit' }).catch(e =>
      console.error('[WhatsApp] shipped notification failed:', e.message)
    );

    res.json({ success: true, fulfillment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/orders/:id/track ────────────────────────────────
router.get('/:id/track', async (req, res) => {
  try {
    const { data: order } = await supabase
      .from('orders').select('postex_cn').eq('id', req.params.id).single();
    if (!order?.postex_cn) return res.status(400).json({ error: 'No PostEx tracking number' });
    const tracking = await postex.trackShipment(order.postex_cn);
    res.json(tracking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/orders/:id/cancel ─────────────────────────────
router.post('/:id/cancel', async (req, res) => {
  try {
    const { data: order } = await supabase
      .from('orders').select('*').eq('id', req.params.id).single();

    if (order.postex_cn) await postex.cancelShipment(order.postex_cn);

    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    if (order.postex_cn) {
      await supabase.from('shipments').update({ status: 'cancelled' }).eq('postex_cn', order.postex_cn);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/orders/:id ────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['status','notes','customer_phone','shipping_address','shipping_city'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const { data, error } = await supabase
      .from('orders').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
