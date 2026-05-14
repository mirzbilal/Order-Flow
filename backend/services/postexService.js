// backend/services/postexService.js
// PostEx API — credentials loaded dynamically from Supabase settings

const axios    = require('axios');
const supabase = require('../lib/supabase');

const BASE_URL = 'https://api.postex.pk/services/integration/api';

// ─── Load credentials from DB ─────────────────────────────────
async function getCredentials() {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'postex_connection')
    .maybeSingle();

  if (data?.value) {
    const conn = JSON.parse(data.value);
    return {
      token:            conn.token,
      merchantCode:     conn.merchantCode,
      pickupAddressCode:conn.pickupAddressCode,
    };
  }

  // Fallback to .env
  if (process.env.POSTEX_TOKEN) {
    return {
      token:            process.env.POSTEX_TOKEN,
      merchantCode:     process.env.POSTEX_MERCHANT_CODE,
      pickupAddressCode:process.env.POSTEX_PICKUP_ADDRESS_CODE,
    };
  }

  throw new Error('PostEx not connected. Go to Settings → PostEx to connect.');
}

function makeClient(token) {
  return axios.create({
    baseURL: BASE_URL,
    headers: { token, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
}

// ─── Create Shipment ──────────────────────────────────────────
async function createShipment(orderData) {
  const { token, pickupAddressCode } = await getCredentials();
  const client = makeClient(token);

  const payload = {
    orderRefNumber:   orderData.orderRefNumber,
    orderType:        'Normal',
    customerName:     orderData.customerName,
    customerPhone:    orderData.customerPhone,
    deliveryAddress:  orderData.deliveryAddress,
    cityName:         orderData.cityName,
    invoicePayment:   Number(orderData.invoicePayment) || 0,
    orderDetail:      orderData.orderDetail || 'Order',
    pickupAddressCode,
  };

  const { data } = await client.post('/order/create', payload);

  if (data.statusCode !== '200') {
    throw new Error(`PostEx booking failed: ${data.statusMessage}`);
  }
  return data;
}

// ─── Track single shipment ────────────────────────────────────
async function trackShipment(trackingNumber) {
  const { token } = await getCredentials();
  const client = makeClient(token);
  const { data } = await client.post('/order/track', { trackingNumber });
  return data;
}

// ─── Track multiple shipments ─────────────────────────────────
async function trackMultiple(trackingNumbers) {
  const { token } = await getCredentials();
  const client = makeClient(token);
  const { data } = await client.post('/order/track/bulk', { trackingNumbers });
  return data;
}

// ─── Cancel shipment ──────────────────────────────────────────
async function cancelShipment(trackingNumber) {
  const { token } = await getCredentials();
  const client = makeClient(token);
  const { data } = await client.post('/order/cancel', { trackingNumber });
  if (data.statusCode !== '200') throw new Error(data.statusMessage);
  return data;
}

// ─── Get operational cities ───────────────────────────────────
async function getOperationalCities() {
  const { token } = await getCredentials();
  const client = makeClient(token);
  const { data } = await client.get('/order/get-operational-cities');
  return data;
}

// ─── Label URL ────────────────────────────────────────────────
async function getLabelUrl(trackingNumber) {
  const { token } = await getCredentials();
  return `${BASE_URL}/order/print?trackingNumber=${trackingNumber}&token=${token}`;
}

// ─── Map PostEx status → internal ────────────────────────────
function mapPostexStatus(s) {
  const u = (s || '').toUpperCase();
  if (u.includes('DELIVER'))  return 'delivered';
  if (u.includes('TRANSIT') || u.includes('DISPATCH') || u.includes('SHIPPED')) return 'in_transit';
  if (u.includes('CANCEL'))   return 'cancelled';
  if (u.includes('RETURN'))   return 'returned';
  return 'in_transit';
}

module.exports = { createShipment, trackShipment, trackMultiple, cancelShipment, getOperationalCities, getLabelUrl, mapPostexStatus };
