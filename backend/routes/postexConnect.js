const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const supabase = require('../lib/supabase');

// PostEx has two possible base URLs — try both
const POSTEX_URLS = [
  'https://api.postex.pk/services/integration/api',
  'https://merchantapi.postex.pk/services/integration/api',
];

async function getWorkingBaseUrl(token) {
  for (const base of POSTEX_URLS) {
    try {
      const res = await axios.get(`${base}/order/get-operational-cities`, {
        headers: { token }, timeout: 10000,
      });
      if (res.data?.statusCode === '200') return base;
    } catch (e) { continue; }
  }
  return null;
}

// ─── GET /api/postex/status ───────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('settings').select('value').eq('key', 'postex_connection').maybeSingle();
    if (error) return res.status(500).json({ error: `DB error: ${error.message}` });
    if (!data?.value) return res.json({ connected: false });
    const conn = JSON.parse(data.value);
    res.json({ connected: true, merchantCode: conn.merchantCode, pickupAddressCode: conn.pickupAddressCode, connectedAt: conn.connectedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/postex/connect ─────────────────────────────────
router.post('/connect', async (req, res) => {
  try {
    const { token, merchantCode, pickupAddressCode } = req.body;
    if (!token)             return res.status(400).json({ error: 'API Token is required' });
    if (!merchantCode)      return res.status(400).json({ error: 'Merchant Code is required' });
    if (!pickupAddressCode) return res.status(400).json({ error: 'Pickup Address Code is required' });

    // Find working base URL
    const baseUrl = await getWorkingBaseUrl(token);
    if (!baseUrl) return res.status(400).json({ error: 'Cannot connect to PostEx API — check your token' });

    const testRes = await axios.get(`${baseUrl}/order/get-operational-cities`, {
      headers: { token }, timeout: 10000,
    });
    const citiesCount = testRes.data?.dist?.length || 0;

    const { error: dbErr } = await supabase.from('settings').upsert({
      key: 'postex_connection',
      value: JSON.stringify({ token, merchantCode, pickupAddressCode, baseUrl, connectedAt: new Date().toISOString(), citiesCount }),
    }, { onConflict: 'key' });

    if (dbErr) return res.status(500).json({ error: `DB error: ${dbErr.message}` });
    res.json({ success: true, merchantCode, citiesCount, baseUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/postex/disconnect ──────────────────────────────
router.post('/disconnect', async (req, res) => {
  try {
    await supabase.from('settings').upsert({ key: 'postex_connection', value: null }, { onConflict: 'key' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/postex/test ────────────────────────────────────
router.post('/test', async (req, res) => {
  try {
    const { data: row, error: dbErr } = await supabase
      .from('settings').select('value').eq('key', 'postex_connection').maybeSingle();
    if (dbErr)      return res.status(500).json({ error: `DB error: ${dbErr.message}` });
    if (!row?.value) return res.status(400).json({ error: 'PostEx not connected' });

    const conn  = JSON.parse(row.value);
    const token = conn.token;
    const base  = conn.baseUrl || POSTEX_URLS[0];

    const testRes = await axios.get(`${base}/order/get-operational-cities`, {
      headers: { token }, timeout: 10000,
    });

    if (testRes.data?.statusCode !== '200') {
      return res.status(400).json({ error: `PostEx error: ${testRes.data?.statusMessage}` });
    }

    res.json({ success: true, cities: testRes.data?.dist?.length || 0, status: testRes.data?.statusMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/postex/cities ───────────────────────────────────
router.get('/cities', async (req, res) => {
  try {
    const { data: row } = await supabase.from('settings').select('value').eq('key', 'postex_connection').maybeSingle();
    if (!row?.value) return res.status(400).json({ error: 'PostEx not connected' });
    const { token, baseUrl } = JSON.parse(row.value);
    const { data } = await axios.get(`${baseUrl || POSTEX_URLS[0]}/order/get-operational-cities`, { headers: { token }, timeout: 10000 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
