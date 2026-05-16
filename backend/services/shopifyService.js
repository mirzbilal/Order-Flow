const axios    = require('axios');
const supabase = require('../lib/supabase');

async function getCredentials() {
  const { data } = await supabase
    .from('settings').select('value').eq('key', 'shopify_connection').maybeSingle();
  if (data?.value) {
    const conn = JSON.parse(data.value);
    return { shop: conn.shop, accessToken: conn.accessToken };
  }
  if (process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN) {
    return { shop: process.env.SHOPIFY_STORE_URL, accessToken: process.env.SHOPIFY_ACCESS_TOKEN };
  }
  throw new Error('Shopify not connected');
}

function makeClient(shop, accessToken) {
  return axios.create({
    baseURL: `https://${shop}/admin/api/2024-10`,
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    timeout: 25000,
  });
}

async function fetchUnfulfilledOrders(limit = 50) {
  const { shop, accessToken } = await getCredentials();
  const client = makeClient(shop, accessToken);
  const { data } = await client.get('/orders.json', {
    params: { status: 'open', fulfillment_status: 'unfulfilled', limit },
  });
  return data.orders || [];
}

async function fulfillOrder(shopifyOrderId, trackingNumber) {
  const { shop, accessToken } = await getCredentials();
  const client = makeClient(shop, accessToken);
  const { data: foData } = await client.get(`/orders/${shopifyOrderId}/fulfillment_orders.json`);
  const fo = foData.fulfillment_orders?.[0];
  if (!fo) throw new Error('No fulfillment order found');
  const { data } = await client.post('/fulfillments.json', {
    fulfillment: {
      line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
      tracking_info: {
        number:  trackingNumber,
        company: 'PostEx',
        url:     `https://postex.pk/tracking?cn=${trackingNumber}`,
      },
      notify_customer: false,
    },
  });
  return data.fulfillment;
}

async function registerWebhooks(appUrl) {
  const { shop, accessToken } = await getCredentials();
  const client = makeClient(shop, accessToken);
  const topics = ['orders/create', 'orders/updated', 'orders/cancelled'];
  const results = [];
  for (const topic of topics) {
    try {
      const { data } = await client.post('/webhooks.json', {
        webhook: { topic, address: `${appUrl}/api/shopify/webhook`, format: 'json' },
      });
      results.push({ topic, status: 'registered', id: data.webhook?.id });
    } catch (e) {
      results.push({ topic, status: 'error', error: e.response?.data?.errors || e.message });
    }
  }
  return results;
}

function normalizeOrder(o) {
  const addr = o.shipping_address || o.billing_address || {};
  let phone  = addr.phone || o.phone || o.customer?.phone || '';
  phone = phone.replace(/\D/g, '');
  if (phone.startsWith('92') && phone.length === 12) phone = '0' + phone.slice(2);

  return {
    shopify_order_id:     String(o.id),
    shopify_order_number: String(o.order_number || o.name || o.id),
    customer_name:        `${addr.first_name || o.customer?.first_name || ''} ${addr.last_name || o.customer?.last_name || ''}`.trim() || 'Customer',
    customer_email:       o.customer?.email || o.email || '',
    customer_phone:       phone,
    shipping_address:     [addr.address1, addr.address2].filter(Boolean).join(', '),
    shipping_city:        addr.city || '',
    shipping_province:    addr.province || '',
    shipping_country:     addr.country || 'Pakistan',
    shipping_zip:         addr.zip || '',
    total_price:          parseFloat(o.total_price || 0),
    currency:             o.currency || 'PKR',
    payment_method:       o.payment_gateway === 'cash_on_delivery' || o.payment_gateway === 'cod' ? 'COD' : 'Prepaid',
    line_items:           o.line_items || [],
    order_detail:         (o.line_items || []).map(i => `${i.quantity}x ${i.title}`).join(', '),
    channel:              'shopify',
    status:               'pending',
    shopify_fulfilled:    o.fulfillment_status === 'fulfilled',
    // ✅ Save REAL Shopify order date — this fixes the date filter
    created_at:           o.created_at,
    shopify_created_at:   o.created_at,
  };
}

function mapPostexStatus(s) {
  const u = (s || '').toUpperCase();
  if (u.includes('DELIVER'))  return 'delivered';
  if (u.includes('TRANSIT') || u.includes('DISPATCH') || u.includes('SHIPPED')) return 'in_transit';
  if (u.includes('CANCEL'))   return 'cancelled';
  if (u.includes('RETURN'))   return 'returned';
  return 'in_transit';
}

module.exports = { fetchUnfulfilledOrders, fulfillOrder, registerWebhooks, normalizeOrder, mapPostexStatus, getCredentials };
