// backend/routes/postexConnect.js
const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const supabase = require('../lib/supabase');

// ─── GET /api/postex/status ───────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'postex_connection')
      .maybeSingle();

    if (!data?.value) return res.json({ connected: false });

    const conn = JSON.parse(data.value);
    res.json({
      connected:        true,
      merchantCode:     conn.merchantCode,
      pickupAddressCode:conn.pickupAddressCode,
      connectedAt:      conn.connectedAt,
    });
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

    // Test the credentials by calling PostEx operational cities
    const testRes = await axios.get(
      'https://api.postex.pk/services/integration/api/order/get-operational-cities',
      { headers: { token }, timeout: 10000 }
    );

    if (testRes.data?.statusCode !== '200') {
      return res.status(400).json({
        error: `PostEx rejected credentials: ${testRes.data?.statusMessage || 'Invalid token'}`
      });
    }

    const cities = testRes.data?.dist?.length || 0;

    // Save to DB
    await supabase.from('settings').upsert([{
      key: 'postex_connection',
      value: JSON.stringify({
        token,
        merchantCode,
        pickupAddressCode,
        connectedAt: new Date().toISOString(),
        citiesCount: cities,
      }),
    }], { onConflict: 'key' });

    res.json({ success: true, merchantCode, citiesCount: cities });
  } catch (err) {
    if (err.response?.status === 401) {
      return res.status(400).json({ error: 'Invalid API token — check your PostEx credentials' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/postex/disconnect ──────────────────────────────
router.post('/disconnect', async (req, res) => {
  try {
    await supabase.from('settings').upsert([{
      key: 'postex_connection', value: null
    }], { onConflict: 'key' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/postex/test ────────────────────────────────────
router.post('/test', async (req, res) => {
  try {
    const { data: row } = await supabase
      .from('settings').select('value').eq('key', 'postex_connection').maybeSingle();
    if (!row?.value) return res.status(400).json({ error: 'PostEx not connected' });

    const { token } = JSON.parse(row.value);
    const testRes = await axios.get(
      'https://api.postex.pk/services/integration/api/order/get-operational-cities',
      { headers: { token }, timeout: 10000 }
    );

    res.json({
      success: true,
      cities: testRes.data?.dist?.length || 0,
      status: testRes.data?.statusMessage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
