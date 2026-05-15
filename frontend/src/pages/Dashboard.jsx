import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ordersApi, shopifyApi, postexApi } from '../lib/api';

function Badge({ status }) {
  const map = { pending:'badge-pending', booked:'badge-booked', in_transit:'badge-transit', delivered:'badge-delivered', cancelled:'badge-cancelled', returned:'badge-returned' };
  const labels = { pending:'Pending', booked:'Booked', in_transit:'In Transit', delivered:'Delivered', cancelled:'Cancelled', returned:'Returned' };
  return <span className={`badge ${map[status]||'badge-pending'}`}>{labels[status]||status}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Real data from API
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', 'all', '', 1],
    queryFn: () => ordersApi.list({ status: 'all', limit: 6 }),
    staleTime: 30000,
  });

  const { data: allOrders } = useQuery({
    queryKey: ['orders-stats'],
    queryFn: () => ordersApi.list({ status: 'all', limit: 1 }),
    staleTime: 60000,
  });

  const syncMutation = useMutation({
    mutationFn: shopifyApi.sync,
    onSuccess: r => { toast.success(`✅ Synced! ${r.created||0} new orders`); qc.invalidateQueries(); },
    onError:   e => toast.error(e.response?.data?.error || e.message),
  });

  const trackMutation = useMutation({
    mutationFn: postexApi.syncTracking,
    onSuccess: r => toast.success(`📡 Updated ${r.updated||0} shipments`),
    onError:   e => toast.error(e.response?.data?.error || e.message),
  });

  const recentOrders = ordersData?.orders || [];
  const totalOrders  = allOrders?.total   || 0;

  // Calculate revenue from recent orders
  const totalRevenue = recentOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

  // Count by status
  const pending   = recentOrders.filter(o => o.status === 'pending').length;
  const unbooked  = recentOrders.filter(o => !o.postex_cn).length;

  // Bar chart — last 7 days from real orders
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const today = new Date().getDay();
  const BAR_DATA = days.map((day, i) => {
    const count = recentOrders.filter(o => {
      const d = new Date(o.created_at);
      return d.getDay() === ((today - 6 + i + 7) % 7);
    }).length;
    return { day, val: count };
  });
  const maxBar = Math.max(...BAR_DATA.map(b => b.val), 1);

  return (
    <div className="page-shell">
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
        <button className="btn" disabled={trackMutation.isPending} onClick={() => trackMutation.mutate()}>
          {trackMutation.isPending ? '...' : '📡 Sync Tracking'}
        </button>
        <button className="btn btn-primary" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
          {syncMutation.isPending ? '...' : '⟳ Sync Shopify'}
        </button>
      </div>

      <div className="content-scroll">
        {/* Metrics — real data */}
        <div className="grid-4" style={{ marginBottom:18 }}>
          <div className="metric-card">
            <div className="metric-label">Total Orders</div>
            <div className="metric-value">{totalOrders.toLocaleString()}</div>
            <div className="metric-delta up">Live from Shopify</div>
            <div className="metric-accent green"/>
          </div>
          <div className="metric-card">
            <div className="metric-label">Revenue (Recent)</div>
            <div className="metric-value">₨{totalRevenue.toLocaleString()}</div>
            <div className="metric-delta up">Last 6 orders</div>
            <div className="metric-accent teal"/>
          </div>
          <div className="metric-card">
            <div className="metric-label">Unbooked Orders</div>
            <div className="metric-value">{unbooked}</div>
            <div className="metric-delta down">Needs PostEx booking</div>
            <div className="metric-accent amber"/>
          </div>
          <div className="metric-card">
            <div className="metric-label">Pending Orders</div>
            <div className="metric-value">{pending}</div>
            <div className="metric-delta down">Awaiting processing</div>
            <div className="metric-accent blue"/>
          </div>
        </div>

        {/* Charts */}
        <div className="grid-2" style={{ marginBottom:18 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Orders — Last 7 Days</span>
              <span className="card-link" onClick={() => navigate('/orders')}>See all →</span>
            </div>
            <div className="card-body">
              <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:110 }}>
                {BAR_DATA.map((b, i) => (
                  <div key={b.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:10, color:'var(--gray-600)', fontWeight:600 }}>{b.val}</span>
                    <div style={{ width:'100%', height:80, background:'var(--gray-100)', borderRadius:'5px 5px 0 0', display:'flex', alignItems:'flex-end' }}>
                      <div style={{ width:'100%', borderRadius:'5px 5px 0 0', height:`${Math.max((b.val/maxBar)*100, b.val>0?8:0)}%`, background: i===3?'linear-gradient(180deg,#22c55e,#15803d)':'linear-gradient(180deg,#4ade80,#16a34a)' }}/>
                    </div>
                    <span style={{ fontSize:10, color:'var(--gray-400)', fontWeight:500 }}>{b.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Orders by Status</span></div>
            <div className="card-body">
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { label:'Pending',    color:'#f59e0b', status:'pending'    },
                  { label:'Booked',     color:'#2563eb', status:'booked'     },
                  { label:'In Transit', color:'#0d9488', status:'in_transit' },
                  { label:'Delivered',  color:'#16a34a', status:'delivered'  },
                  { label:'Cancelled',  color:'#ef4444', status:'cancelled'  },
                ].map(s => {
                  const count = recentOrders.filter(o => o.status === s.status).length;
                  const pct   = totalOrders > 0 ? Math.round((count / recentOrders.length) * 100) : 0;
                  return (
                    <div key={s.label} style={{ display:'flex', alignItems:'center', gap:10, fontSize:12.5, cursor:'pointer' }}
                      onClick={() => navigate(`/orders?status=${s.status}`)}>
                      <div style={{ width:9, height:9, borderRadius:3, background:s.color, flexShrink:0 }}/>
                      <span style={{ color:'var(--gray-600)', flex:1 }}>{s.label}</span>
                      <div style={{ width:80, height:5, background:'var(--gray-100)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:s.color, borderRadius:3 }}/>
                      </div>
                      <span style={{ fontWeight:700, color:'var(--gray-900)', fontFamily:'var(--font-mono)', fontSize:12, width:20, textAlign:'right' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders — real data */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>Recent Orders</div>
          <span className="card-link" onClick={() => navigate('/orders')}>See all →</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order #</th><th>Customer</th><th>City</th>
                <th>Amount</th><th>Payment</th><th>Status</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:30, color:'var(--gray-400)' }}>Loading...</td></tr>
              )}
              {!isLoading && recentOrders.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:30, color:'var(--gray-400)' }}>
                  No orders yet — click Sync Shopify to import orders
                </td></tr>
              )}
              {recentOrders.map(o => (
                <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                  <td className="td-mono">{o.shopify_order_number}</td>
                  <td>
                    <div className="td-name">{o.customer_name}</div>
                    <div className="td-sub">{o.customer_email}</div>
                  </td>
                  <td className="td-muted">{o.shipping_city}</td>
                  <td className="td-amount">PKR {Number(o.total_price||0).toLocaleString()}</td>
                  <td>
                    <span style={{ background: o.payment_method==='COD'?'var(--amber-100)':'var(--green-100)', color: o.payment_method==='COD'?'var(--amber-700)':'var(--green-700)', padding:'2px 9px', borderRadius:5, fontSize:12, fontWeight:600 }}>
                      {o.payment_method||'COD'}
                    </span>
                  </td>
                  <td><Badge status={o.status}/></td>
                  <td className="td-muted">{new Date(o.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short'})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
