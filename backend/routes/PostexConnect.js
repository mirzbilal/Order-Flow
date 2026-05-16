const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const supabase = require('../lib/supabase');

// Try multiple PostEx base URLs
const POSTEX_URLS = [
  'https://api.postex.pk/services/integration/api',
  'https://merchantapi.postex.pk/services/integration/api',
  'https://api.postex.pk/services/v1/integration',
  'https://api.postex.pk/services/integration',
];

async function testUrl(baseUrl, token) {
  try {
    const res = await axios.get(
      `${baseUrl}/order/get-operational-cities`,
      { headers: { token }, timeout: 8000 }
    );
    if (res.data?.statusCode === '200') return true;
    return false;
  } catch (e) {
    return false;
  }
}

async function findWorkingUrl(token) {
  for (const url of POSTEX_URLS) {
    console.log('[PostEx] Trying:', url);
    const works = await testUrl(url, token);
    if (works) { console.log('[PostEx] ✅ Working URL:', url); return url; }
  }
  return null;
}

async function getConnection() {
  const { data } = await supabase
    .from('settings').select('value').eq('key', 'postex_connection').maybeSingle();
  if (!data?.value) return null;
  return JSON.parse(data.value);
}

// ─── GET /api/postex/status ───────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const conn = await getConnection();
    if (!conn) return res.json({ connected: false });
    res.json({ connected: true, merchantCode: conn.merchantCode, pickupAddressCode: conn.pickupAddressCode, connectedAt: conn.connectedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/postex/connect ─────────────────────────────────
router.post('/connect', async (req, res) => {
  try {
    const { token, merchantCode, pickupAddressCode } = req.body;
    if (!token)             return res.status(400).json({ error: 'API Token required' });
    if (!merchantCode)      return res.status(400).json({ error: 'Merchant Code required' });
    if (!pickupAddressCode) return res.status(400).json({ error: 'Pickup Address Code required' });

    const baseUrl = await findWorkingUrl(token);
    if (!baseUrl) return res.status(400).json({ error: 'Cannot connect to PostEx API — check your token. Tried all known endpoints.' });

    const testRes = await axios.get(`${baseUrl}/order/get-operational-cities`, { headers: { token }, timeout: 10000 });
    const citiesCount = testRes.data?.dist?.length || 0;

    await supabase.from('settings').upsert({
      key: 'postex_connection',
      value: JSON.stringify({ token, merchantCode, pickupAddressCode, baseUrl, connectedAt: new Date().toISOString(), citiesCount }),
    }, { onConflict: 'key' });

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
    const conn = await getConnection();
    if (!conn) return res.status(400).json({ error: 'PostEx not connected — go to PostEx App page and connect first' });

    const { token } = conn;
    let   { baseUrl } = conn;

    // Try saved URL first, if 404 find new working URL
    const savedWorks = await testUrl(baseUrl, token);
    if (!savedWorks) {
      console.log('[PostEx] Saved URL failed, finding new working URL...');
      baseUrl = await findWorkingUrl(token);
      if (!baseUrl) return res.status(500).json({ error: 'PostEx API unreachable — all endpoints returned 404' });

      // Update saved URL
      await supabase.from('settings').upsert({
        key: 'postex_connection',
        value: JSON.stringify({ ...conn, baseUrl }),
      }, { onConflict: 'key' });
    }

    const testRes = await axios.get(`${baseUrl}/order/get-operational-cities`, { headers: { token }, timeout: 10000 });
    res.json({ success: true, cities: testRes.data?.dist?.length || 0, status: testRes.data?.statusMessage, baseUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/postex/cities ───────────────────────────────────
router.get('/cities', async (req, res) => {
  try {
    const conn = await getConnection();
    if (!conn) return res.status(400).json({ error: 'PostEx not connected' });
    const { data } = await axios.get(`${conn.baseUrl}/order/get-operational-cities`, { headers: { token: conn.token }, timeout: 10000 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
