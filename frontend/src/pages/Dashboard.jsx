import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const SAMPLE_ORDERS = [
  { id:'#ORD-2847', customer:'Sara Ahmed',   email:'sara@gmail.com',  channel:'Shopify', amount:'PKR 14,200', cn:'TCS-887234', status:'delivered', date:'May 3' },
  { id:'#ORD-2846', customer:'James Wilson', email:'jwilson@mail.com', channel:'Amazon',  amount:'PKR 6,750',  cn:'DHL-442198', status:'in_transit', date:'May 3' },
  { id:'#ORD-2845', customer:'Maria Santos', email:'msantos@email.com',channel:'Direct',  amount:'PKR 28,900', cn:'—',          status:'pending',   date:'May 2' },
  { id:'#ORD-2844', customer:'Chen Wei',     email:'cw@test.com',     channel:'Shopify', amount:'PKR 8,800',  cn:'—',          status:'pending',   date:'May 2' },
  { id:'#ORD-2843', customer:'Aisha Malik',  email:'aisha@pk.net',    channel:'Amazon',  amount:'PKR 21,500', cn:'TCS-881220', status:'delivered', date:'May 1' },
  { id:'#ORD-2842', customer:'Tom Lee',      email:'tlee@web.io',     channel:'Direct',  amount:'PKR 4,500',  cn:'—',          status:'cancelled', date:'May 1' },
];

const BAR_DATA = [
  {day:'Mon',val:42,h:52},{day:'Tue',val:67,h:83},{day:'Wed',val:51,h:63},
  {day:'Thu',val:81,h:100,peak:true},{day:'Fri',val:73,h:90},
  {day:'Sat',val:58,h:71},{day:'Sun',val:34,h:42},
];

function Badge({ status }) {
  const map = {
    pending:   'badge-pending',   booked:    'badge-booked',
    in_transit:'badge-transit',   delivered: 'badge-delivered',
    cancelled: 'badge-cancelled', returned:  'badge-returned',
  };
  const labels = { pending:'Pending', booked:'Booked', in_transit:'In Transit', delivered:'Delivered', cancelled:'Cancelled', returned:'Returned' };
  return <span className={`badge ${map[status]||'badge-pending'}`}>{labels[status]||status}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: () => axios.post(`${API}/api/shopify/sync`).then(r=>r.data),
    onSuccess: r => { toast.success(`✅ Synced! ${r.created||0} new orders`); qc.invalidateQueries(); },
    onError:   e => toast.error(e.response?.data?.error || e.message),
  });
  const trackMutation = useMutation({
    mutationFn: () => axios.post(`${API}/api/postex/sync-tracking`).then(r=>r.data),
    onSuccess: r => toast.success(`📡 Updated ${r.updated||0} shipments`),
    onError:   e => toast.error(e.response?.data?.error || e.message),
  });

  return (
    <div className="page-shell">
      {/* Topbar */}
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
        {/* Metrics */}
        <div className="grid-4" style={{ marginBottom:18 }}>
          {[
            { label:'Total Orders',     value:'2,847', delta:'↑ 12.4% vs last month', up:true,  accent:'green' },
            { label:'Revenue (MTD)',     value:'₨9.4L', delta:'↑ 8.7% vs last month',  up:true,  accent:'teal' },
            { label:'Unbooked Orders',  value:'127',   delta:'Needs PostEx booking',   up:false, accent:'amber' },
            { label:'On-Time Delivery', value:'96.2%', delta:'↑ 1.1% this week',       up:true,  accent:'blue' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value">{m.value}</div>
              <div className={`metric-delta ${m.up?'up':'down'}`}>{m.delta}</div>
              <div className={`metric-accent ${m.accent}`}/>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid-2" style={{ marginBottom:18 }}>
          {/* Bar chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Orders — Last 7 Days</span>
              <span className="card-link">View report →</span>
            </div>
            <div className="card-body">
              <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:110 }}>
                {BAR_DATA.map(b => (
                  <div key={b.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:10, color:'var(--gray-600)', fontWeight:600 }}>{b.val}</span>
                    <div style={{ width:'100%', height:80, background:'var(--gray-100)', borderRadius:'5px 5px 0 0', display:'flex', alignItems:'flex-end' }}>
                      <div style={{ width:'100%', borderRadius:'5px 5px 0 0', animation:'barGrow 0.5s ease both', height:`${b.h}%`, background: b.peak ? 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)' : 'linear-gradient(180deg, #4ade80 0%, #16a34a 100%)' }}/>
                    </div>
                    <span style={{ fontSize:10, color:'var(--gray-400)', fontWeight:500 }}>{b.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Donut */}
          <div className="card">
            <div className="card-header"><span className="card-title">Orders by Status</span></div>
            <div className="card-body">
              <div style={{ display:'flex', alignItems:'center', gap:24 }}>
                <svg width="110" height="110" viewBox="0 0 110 110">
                  <circle cx="55" cy="55" r="44" fill="none" stroke="var(--gray-100)" strokeWidth="14"/>
                  <circle cx="55" cy="55" r="44" fill="none" stroke="#16a34a" strokeWidth="14" strokeDasharray="276.5" strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 55 55)"/>
                  <circle cx="55" cy="55" r="44" fill="none" stroke="#0d9488" strokeWidth="14" strokeDasharray="276.5" strokeDashoffset="-168.7" strokeLinecap="round" transform="rotate(-90 55 55)"/>
                  <circle cx="55" cy="55" r="44" fill="none" stroke="#f59e0b" strokeWidth="14" strokeDasharray="276.5" strokeDashoffset="-224" strokeLinecap="round" transform="rotate(-90 55 55)"/>
                  <circle cx="55" cy="55" r="44" fill="none" stroke="#ef4444" strokeWidth="14" strokeDasharray="276.5" strokeDashoffset="-251.65" strokeLinecap="round" transform="rotate(-90 55 55)"/>
                  <text x="55" y="51" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="17" fontWeight="700" fill="#111827">61%</text>
                  <text x="55" y="64" textAnchor="middle" fontSize="9" fill="#9ca3af" fontFamily="Inter,sans-serif">Delivered</text>
                </svg>
                <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                  {[
                    { color:'#16a34a', label:'Delivered',  val:'1,736' },
                    { color:'#0d9488', label:'In Transit', val:'512'   },
                    { color:'#f59e0b', label:'Pending',    val:'341'   },
                    { color:'#ef4444', label:'Cancelled',  val:'258'   },
                  ].map(d => (
                    <div key={d.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5 }}>
                      <div style={{ width:9, height:9, borderRadius:3, background:d.color, flexShrink:0 }}/>
                      <span style={{ color:'var(--gray-600)', flex:1 }}>{d.label}</span>
                      <span style={{ fontWeight:700, color:'var(--gray-900)', fontFamily:'var(--font-mono)', fontSize:12 }}>{d.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-900)' }}>Recent Orders</div>
          <span className="card-link" onClick={() => navigate('/orders')}>See all →</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th><th>Customer</th><th>Channel</th>
                <th>Amount</th><th>PostEx CN</th><th>Status</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ORDERS.map(o => (
                <tr key={o.id} onClick={() => navigate('/orders')}>
                  <td className="td-mono">{o.id}</td>
                  <td><div className="td-name">{o.customer}</div><div className="td-sub">{o.email}</div></td>
                  <td><span className="channel-chip">{o.channel}</span></td>
                  <td className="td-amount">{o.amount}</td>
                  <td className="td-mono">{o.cn}</td>
                  <td><Badge status={o.status}/></td>
                  <td className="td-muted">{o.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
