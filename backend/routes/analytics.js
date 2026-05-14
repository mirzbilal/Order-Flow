// backend/routes/analytics.js
const express  = require('express');
const router   = express.Router();
const supabase = require('../lib/supabase');

// ─── GET /api/analytics/dashboard ────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    // Total counts by status
    const { data: statusCounts } = await supabase
      .from('orders')
      .select('status')
      .then(r => {
        const counts = {};
        (r.data || []).forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
        return { data: counts };
      });

    // Revenue this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthOrders } = await supabase
      .from('orders')
      .select('total_price, created_at')
      .gte('created_at', startOfMonth.toISOString())
      .neq('status', 'cancelled');

    const revenue = (monthOrders || []).reduce((sum, o) => sum + Number(o.total_price), 0);

    // Orders in last 7 days by day
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const { data: weekOrders } = await supabase
      .from('orders')
      .select('created_at, total_price')
      .gte('created_at', sevenDaysAgo.toISOString());

    const byDay = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      byDay[key] = { count: 0, revenue: 0 };
    }
    (weekOrders || []).forEach(o => {
      const key = o.created_at.slice(0, 10);
      if (byDay[key]) {
        byDay[key].count++;
        byDay[key].revenue += Number(o.total_price);
      }
    });

    // PostEx pending bookings
    const { count: unbooked } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing'])
      .is('postex_cn', null);

    res.json({
      statusCounts,
      revenue: Math.round(revenue),
      weeklyOrders: Object.entries(byDay).map(([date, v]) => ({ date, ...v })),
      unbookedCount: unbooked || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
