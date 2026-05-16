const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const supabase = require('../lib/supabase');

const URLS = [
  'https://api.postex.pk/services/integration/api',
  'https://merchantapi.postex.pk/services/integration/api',
];

async function getConn() {
  const { data } = await supabase.from('settings').select('value').eq('key','postex_connection').maybeSingle();
  return data?.value ? JSON.parse(data.value) : null;
}

router.get('/status', async (req, res) => {
  try {
    const c = await getConn();
    if (!c) return res.json({ connected: false });
    res.json({ connected: true, merchantCode: c.merchantCode, pickupAddressCode: c.pickupAddressCode, connectedAt: c.connectedAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/connect', async (req, res) => {
  try {
    const { token, merchantCode, pickupAddressCode } = req.body;
    if (!token || !merchantCode || !pickupAddressCode) return res.status(400).json({ error: 'All fields required' });
    let baseUrl = null;
    for (const url of URLS) {
      try {
        const r = await axios.get(`${url}/order/get-operational-cities`, { headers:{ token }, timeout:8000 });
        if (r.data?.statusCode === '200') { baseUrl = url; break; }
      } catch(_) {}
    }
    if (!baseUrl) return res.status(400).json({ error: 'Cannot connect to PostEx — check your token' });
    const r = await axios.get(`${baseUrl}/order/get-operational-cities`, { headers:{ token }, timeout:8000 });
    await supabase.from('settings').upsert({ key:'postex_connection', value: JSON.stringify({ token, merchantCode, pickupAddressCode, baseUrl, connectedAt: new Date().toISOString(), citiesCount: r.data?.dist?.length||0 }) }, { onConflict:'key' });
    res.json({ success: true, merchantCode, citiesCount: r.data?.dist?.length||0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/disconnect', async (req, res) => {
  try {
    await supabase.from('settings').upsert({ key:'postex_connection', value: null }, { onConflict:'key' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/test', async (req, res) => {
  try {
    const c = await getConn();
    if (!c) return res.status(400).json({ error: 'PostEx not connected' });
    const r = await axios.get(`${c.baseUrl}/order/get-operational-cities`, { headers:{ token: c.token }, timeout:10000 });
    res.json({ success: true, cities: r.data?.dist?.length||0, status: r.data?.statusMessage });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/cities', async (req, res) => {
  try {
    const c = await getConn();
    if (!c) return res.status(400).json({ error: 'Not connected' });
    const r = await axios.get(`${c.baseUrl}/order/get-operational-cities`, { headers:{ token: c.token }, timeout:10000 });
    res.json(r.data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
