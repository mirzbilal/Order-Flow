import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ordersApi, shopifyApi, postexApi } from '../lib/api';

function Badge({ status }) {
  const map = { pending:'badge-pending', booked:'badge-booked', in_transit:'badge-transit', delivered:'badge-delivered', cancelled:'badge-cancelled', returned:'badge-returned' };
  const labels = { pending:'Pending', booked:'Booked', in_transit:'In Transit', delivered:'Delivered', cancelled:'Cancelled', returned:'Returned' };
  return <span className={`badge ${map[status]||'badge-pending'}`}>{labels[status]||status}</span>;
}

const DATE_PRESETS = [
  { label:'Today',       days:0    },
  { label:'Yesterday',   days:1    },
  { label:'Last 7 days', days:7    },
  { label:'Last 30 days',days:30   },
  { label:'Last 90 days',days:90   },
  { label:'All time',    days:null },
];

function getDateRange(days) {
  if (days === null) return { from: null, to: null };
  const to   = new Date();
  const from = new Date();
  if (days === 0) { from.setHours(0,0,0,0); to.setHours(23,59,59,999); }
  else { from.setDate(from.getDate() - days); from.setHours(0,0,0,0); }
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selectedPreset, setSelectedPreset] = useState('Last 7 days');
  const [customFrom,     setCustomFrom]     = useState('');
  const [customTo,       setCustomTo]       = useState('');
  const [showPicker,     setShowPicker]     = useState(false);

  const preset    = DATE_PRESETS.find(p => p.label === selectedPreset);
  const dateRange = customFrom && customTo
    ? { from: customFrom, to: customTo }
    : getDateRange(preset?.days ?? 7);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders-dashboard', dateRange.from, dateRange.to],
    queryFn:  () => ordersApi.list({
      status: 'all',
      limit:  10000,
      ...(dateRange.from && { date_from: dateRange.from }),
      ...(dateRange.to   && { date_to:   dateRange.to   }),
    }),
    staleTime: 30000,
  });

  const { data: totalData } = useQuery({
    queryKey: ['orders-total'],
    queryFn:  () => ordersApi.list({ status: 'all', limit: 1 }),
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

  const orders      = ordersData?.orders || [];
  const totalOrders = totalData?.total   || 0;
  const revenue     = orders.reduce((s, o) => s + Number(o.total_price||0), 0);
  const unbooked    = orders.filter(o => !o.postex_cn).length;
  const pending     = orders.filter(o => o.status === 'pending').length;

  const barData = Array.from({ length:7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr  = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { weekday:'short' });
    const count    = orders.filter(o => o.created_at?.startsWith(dateStr)).length;
    return { day: dayLabel, val: count };
  });
  const maxBar = Math.max(...barData.map(b => b.val), 1);

  const dateLabel = customFrom && customTo ? `${customFrom} → ${customTo}` : selectedPreset;

  return (
    <div className="page-shell">
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>

        {/* Date Filter */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setShowPicker(!showPicker)}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 13px', borderRadius:8, border:'1.5px solid var(--green-200)', background:'var(--green-50)', color:'var(--green-700)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
            📅 {dateLabel} ▾
          </button>

          {showPicker && (
            <>
              <div onClick={() => setShowPicker(false)} style={{ position:'fixed', inset:0, zIndex:99 }}/>
              <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'#fff', border:'1px solid var(--gray-200)', borderRadius:12, boxShadow:'var(--shadow-lg)', zIndex:100, width:260, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>Quick Select</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:14 }}>
                  {DATE_PRESETS.map(p => (
                    <button key={p.label} onClick={() => { setSelectedPreset(p.label); setCustomFrom(''); setCustomTo(''); setShowPicker(false); }}
                      style={{ padding:'6px 10px', borderRadius:7, border:`1.5px solid ${selectedPreset===p.label&&!customFrom?'var(--green-600)':'var(--gray-200)'}`, background:selectedPreset===p.label&&!customFrom?'var(--green-50)':'#fff', color:selectedPreset===p.label&&!customFrom?'var(--green-700)':'var(--gray-600)', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'var(--font)', textAlign:'left' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:8 }}>Custom Range</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:4 }}>From</div>
                    <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setSelectedPreset(''); }}
                      style={{ width:'100%', padding:'6px 8px', border:'1.5px solid var(--gray-200)', borderRadius:7, fontSize:12, fontFamily:'var(--font)', outline:'none', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'var(--gray-500)', marginBottom:4 }}>To</div>
                    <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setSelectedPreset(''); }}
                      style={{ width:'100%', padding:'6px 8px', border:'1.5px solid var(--gray-200)', borderRadius:7, fontSize:12, fontFamily:'var(--font)', outline:'none', boxSizing:'border-box' }}/>
                  </div>
                </div>
                {customFrom && customTo && (
                  <button onClick={() => setShowPicker(false)}
                    style={{ width:'100%', padding:'8px', borderRadius:7, border:'none', background:'var(--green-600)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
                    Apply Range
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <button className="btn" disabled={trackMutation.isPending} onClick={() => trackMutation.mutate()}>
          {trackMutation.isPending ? '...' : '📡 Sync Tracking'}
        </button>
        <button className="btn btn-primary" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
          {syncMutation.isPending ? '...' : '⟳ Sync Shopify'}
        </button>
      </div>

      <div className="content-scroll">
        {/* Date banner */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, fontSize:12.5, color:'var(--gray-500)' }}>
          📅 Showing: <strong style={{ color:'var(--green-700)' }}>{dateLabel}</strong>
          <span style={{ color:'var(--gray-300)' }}>•</span>
          <span>{isLoading ? '...' : `${orders.length} orders`}</span>
          {(customFrom || selectedPreset !== 'All time') && (
            <button onClick={() => { setSelectedPreset('All time'); setCustomFrom(''); setCustomTo(''); }}
              style={{ marginLeft:'auto', fontSize:11.5, color:'var(--gray-400)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
              Clear filter
            </button>
          )}
        </div>

        {/* Metrics — 100% real data */}
        <div className="grid-4" style={{ marginBottom:18 }}>
          <div className="metric-card">
            <div className="metric-label">Orders (Period)</div>
            <div className="metric-value">{isLoading ? '...' : orders.length.toLocaleString()}</div>
            <div className="metric-delta up">of {totalOrders.toLocaleString()} total in DB</div>
            <div className="metric-accent green"/>
          </div>
          <div className="metric-card">
            <div className="metric-label">Revenue (Period)</div>
            <div className="metric-value">₨{isLoading ? '...' : revenue.toLocaleString()}</div>
            <div className="metric-delta up">{dateLabel}</div>
            <div className="metric-accent teal"/>
          </div>
          <div className="metric-card">
            <div className="metric-label">Unbooked</div>
            <div className="metric-value">{isLoading ? '...' : unbooked}</div>
            <div className="metric-delta down">Needs PostEx booking</div>
            <div className="metric-accent amber"/>
          </div>
          <div className="metric-card">
            <div className="metric-label">Pending</div>
            <div className="metric-value">{isLoading ? '...' : pending}</div>
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
                {barData.map((b, i) => (
                  <div key={b.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:10, color:'var(--gray-600)', fontWeight:600 }}>{b.val}</span>
                    <div style={{ width:'100%', height:80, background:'var(--gray-100)', borderRadius:'5px 5px 0 0', display:'flex', alignItems:'flex-end' }}>
                      <div style={{ width:'100%', borderRadius:'5px 5px 0 0', height:`${Math.max((b.val/maxBar)*100, b.val>0?6:0)}%`, background:i===6?'linear-gradient(180deg,#22c55e,#15803d)':'linear-gradient(180deg,#4ade80,#16a34a)' }}/>
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
                  const count = orders.filter(o => o.status === s.status).length;
                  const pct   = orders.length > 0 ? Math.round((count/orders.length)*100) : 0;
                  return (
                    <div key={s.label} style={{ display:'flex', alignItems:'center', gap:10, fontSize:12.5, cursor:'pointer' }}
                      onClick={() => navigate('/orders')}>
                      <div style={{ width:9, height:9, borderRadius:3, background:s.color, flexShrink:0 }}/>
                      <span style={{ color:'var(--gray-600)', flex:1 }}>{s.label}</span>
                      <div style={{ width:80, height:5, background:'var(--gray-100)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:s.color, borderRadius:3 }}/>
                      </div>
                      <span style={{ fontWeight:700, color:'var(--gray-900)', fontFamily:'var(--font-mono)', fontSize:12, width:28, textAlign:'right' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders — 100% real data, NO sample data */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>
            Recent Orders <span style={{ fontSize:12, color:'var(--gray-400)', fontWeight:400 }}>— {dateLabel}</span>
          </div>
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
                <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--gray-400)' }}>
                  Loading real orders...
                </td></tr>
              )}
              {!isLoading && orders.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--gray-400)' }}>
                  No orders for <strong>{dateLabel}</strong> — try "All time" or sync Shopify
                </td></tr>
              )}
              {orders.slice(0, 10).map(o => (
                <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                  <td className="td-mono">{o.shopify_order_number}</td>
                  <td>
                    <div className="td-name">{o.customer_name}</div>
                    <div className="td-sub">{o.customer_email}</div>
                  </td>
                  <td className="td-muted">{o.shipping_city}</td>
                  <td className="td-amount">PKR {Number(o.total_price||0).toLocaleString()}</td>
                  <td>
                    <span style={{ background:o.payment_method==='COD'?'var(--amber-100)':'var(--green-100)', color:o.payment_method==='COD'?'var(--amber-700)':'var(--green-700)', padding:'2px 9px', borderRadius:5, fontSize:12, fontWeight:600 }}>
                      {o.payment_method||'COD'}
                    </span>
                  </td>
                  <td><Badge status={o.status}/></td>
                  <td className="td-muted">
                    {new Date(o.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
