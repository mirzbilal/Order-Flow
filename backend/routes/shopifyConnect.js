// backend/routes/shopifyConnect.js
// Shopify OAuth + Access Token connection management

const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const crypto   = require('crypto');
const supabase = require('../lib/supabase');

// ─── GET /api/shopify/status ─────────────────────────────────
// Returns current connection status from DB
router.get('/status', async (req, res) => {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'shopify_connection')
      .maybeSingle();

    if (!data?.value) return res.json({ connected: false });

    const conn = JSON.parse(data.value);
    res.json({
      connected:   true,
      shop:        conn.shop,
      method:      conn.method,
      connectedAt: conn.connectedAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/shopify/connect ───────────────────────────────
// Method 1: OAuth — returns authUrl for redirect
// Method 2: Access Token — saves directly
router.post('/connect', async (req, res) => {
  try {
    const { shop, method, clientId, clientSecret, accessToken } = req.body;
    if (!shop) return res.status(400).json({ error: 'shop is required' });

    const cleanShop = shop.replace(/https?:\/\//, '').replace(/\/$/, '');

    if (method === 'oauth') {
      if (!clientId || !clientSecret) {
        return res.status(400).json({ error: 'clientId and clientSecret are required for OAuth' });
      }

      // Save client creds temporarily (needed for callback)
      await supabase.from('settings').upsert([
        { key: 'shopify_pending_oauth', value: JSON.stringify({ shop: cleanShop, clientId, clientSecret }) },
      ], { onConflict: 'key' });

      // Build Shopify OAuth URL
      const scopes   = 'read_orders,write_orders,write_fulfillments,read_products';
      const redirect = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/shopify/callback`;
      const state    = crypto.randomBytes(16).toString('hex');

      await supabase.from('settings').upsert([
        { key: 'shopify_oauth_state', value: state },
      ], { onConflict: 'key' });

      const authUrl = `https://${cleanShop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`;
      return res.json({ authUrl });
    }

    if (method === 'token') {
      if (!accessToken) return res.status(400).json({ error: 'accessToken is required' });

      // Verify token works
      const testRes = await axios.get(`https://${cleanShop}/admin/api/2024-10/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });

      if (!testRes.data?.shop) throw new Error('Invalid access token — could not connect to store');

      // Save to DB
      await supabase.from('settings').upsert([{
        key: 'shopify_connection',
        value: JSON.stringify({
          shop:        cleanShop,
          accessToken,
          method:      'token',
          connectedAt: new Date().toISOString(),
          storeName:   testRes.data.shop.name,
        }),
      }], { onConflict: 'key' });

      return res.json({ success: true, shop: cleanShop, storeName: testRes.data.shop.name });
    }

    res.status(400).json({ error: 'method must be oauth or token' });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.errors || err.message });
  }
});

// ─── GET /api/shopify/callback ───────────────────────────────
// OAuth callback from Shopify after merchant approves
router.get('/callback', async (req, res) => {
  try {
    const { shop, code, state, hmac } = req.query;

    // Verify state
    const { data: stateRow } = await supabase
      .from('settings').select('value').eq('key', 'shopify_oauth_state').maybeSingle();
    if (stateRow?.value !== state) {
      return res.status(403).send('Invalid state — possible CSRF attack');
    }

    // Load pending OAuth creds
    const { data: pendingRow } = await supabase
      .from('settings').select('value').eq('key', 'shopify_pending_oauth').maybeSingle();
    if (!pendingRow?.value) return res.status(400).send('No pending OAuth session found');

    const { clientId, clientSecret } = JSON.parse(pendingRow.value);

    // Verify HMAC
    const params  = Object.keys(req.query).filter(k => k !== 'hmac').sort();
    const message = params.map(k => `${k}=${req.query[k]}`).join('&');
    const digest  = crypto.createHmac('sha256', clientSecret).update(message).digest('hex');
    if (digest !== hmac) return res.status(403).send('HMAC verification failed');

    // Exchange code for access token
    const tokenRes = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id:     clientId,
      client_secret: clientSecret,
      code,
    });

    const accessToken = tokenRes.data.access_token;

    // Get store info
    const shopRes = await axios.get(`https://${shop}/admin/api/2024-10/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });

    // Save connection
    await supabase.from('settings').upsert([{
      key: 'shopify_connection',
      value: JSON.stringify({
        shop, accessToken, clientId, clientSecret,
        method: 'oauth',
        connectedAt: new Date().toISOString(),
        storeName: shopRes.data.shop.name,
      }),
    }], { onConflict: 'key' });

    // Cleanup temp keys
    await supabase.from('settings').delete().eq('key', 'shopify_pending_oauth');
    await supabase.from('settings').delete().eq('key', 'shopify_oauth_state');

    // Redirect to frontend settings page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/shopify-connect?connected=true`);
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.status(500).send(`Connection failed: ${err.message}`);
  }
});

// ─── POST /api/shopify/disconnect ────────────────────────────
router.post('/disconnect', async (req, res) => {
  try {
    await supabase.from('settings').delete().eq('key', 'shopify_connection');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
