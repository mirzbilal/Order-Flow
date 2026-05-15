const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const supabase = require('../lib/supabase');

const POSTEX_BASE = 'https://api.postex.pk/services/integration/api';

// ─── GET /api/postex/status ───────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'postex_connection')
      .maybeSingle();

    if (error) return res.status(500).json({ error: `Supabase error: ${error.message}` });
    if (!data?.value) return res.json({ connected: false });

    const conn = JSON.parse(data.value);
    res.json({
      connected:         true,
      merchantCode:      conn.merchantCode,
      pickupAddressCode: conn.pickupAddressCode,
      connectedAt:       conn.connectedAt,
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

    // Test credentials
    let citiesCount = 0;
    try {
      const testRes = await axios.get(
        `${POSTEX_BASE}/order/get-operational-cities`,
        { headers: { token }, timeout: 15000 }
      );
      if (testRes.data?.statusCode !== '200') {
        return res.status(400).json({ error: `PostEx rejected: ${testRes.data?.statusMessage || 'Invalid token'}` });
      }
      citiesCount = testRes.data?.dist?.length || 0;
    } catch (axiosErr) {
      return res.status(400).json({ error: `Cannot reach PostEx API: ${axiosErr.message}` });
    }

    // Save to DB — upsert
    const { error: dbErr } = await supabase
      .from('settings')
      .upsert({ key: 'postex_connection', value: JSON.stringify({ token, merchantCode, pickupAddressCode, connectedAt: new Date().toISOString(), citiesCount }) }, { onConflict: 'key' });

    if (dbErr) return res.status(500).json({ error: `DB error: ${dbErr.message}` });

    res.json({ success: true, merchantCode, citiesCount });
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
    // Check if settings table exists and has postex_connection
    const { data: row, error: dbErr } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'postex_connection')
      .maybeSingle();

    if (dbErr) return res.status(500).json({ error: `DB error: ${dbErr.message} — run schema.sql in Supabase` });
    if (!row)  return res.status(400).json({ error: 'Settings table empty — run schema.sql in Supabase first' });
    if (!row.value) return res.status(400).json({ error: 'PostEx not connected — go to PostEx App page and connect first' });

    const { token } = JSON.parse(row.value);
    if (!token) return res.status(400).json({ error: 'Token missing in saved connection' });

    const testRes = await axios.get(
      `${POSTEX_BASE}/order/get-operational-cities`,
      { headers: { token }, timeout: 15000 }
    );

    res.json({
      success: true,
      cities:  testRes.data?.dist?.length || 0,
      status:  testRes.data?.statusMessage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/postex/cities ───────────────────────────────────
router.get('/cities', async (req, res) => {
  try {
    const { data: row } = await supabase.from('settings').select('value').eq('key', 'postex_connection').maybeSingle();
    if (!row?.value) return res.status(400).json({ error: 'PostEx not connected' });
    const { token } = JSON.parse(row.value);
    const { data } = await axios.get(`${POSTEX_BASE}/order/get-operational-cities`, { headers: { token }, timeout: 15000 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
