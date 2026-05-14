import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const STATUSES = ['all','pending','booked','in_transit','delivered','cancelled','returned'];

function Badge({ status }) {
  const map = { pending:'badge-pending', booked:'badge-booked', in_transit:'badge-transit', delivered:'badge-delivered', cancelled:'badge-cancelled', returned:'badge-returned' };
  const labels = { pending:'Pending', booked:'Booked', in_transit:'In Transit', delivered:'Delivered', cancelled:'Cancelled', returned:'Returned' };
  return <span className={`badge ${map[status]||'badge-pending'}`}>{labels[status]||status}</span>;
}

// Fallback sample data when API not connected
const SAMPLE = [
  { id:'ord-1', shopify_order_number:'#2847', customer_name:'Sara Ahmed',   customer_phone:'0312-1234567', shipping_city:'Karachi',    total_price:14200, payment_method:'COD',     postex_cn:'TCS-887234', status:'delivered', channel:'Shopify', created_at:'2026-05-03' },
  { id:'ord-2', shopify_order_number:'#2846', customer_name:'James Wilson', customer_phone:'0321-9876543', shipping_city:'Lahore',     total_price:6750,  payment_method:'Prepaid', postex_cn:'DHL-442198', status:'in_transit', channel:'Amazon',  created_at:'2026-05-03' },
  { id:'ord-3', shopify_order_number:'#2845', customer_name:'Maria Santos', customer_phone:'0333-5551234', shipping_city:'Islamabad',  total_price:28900, payment_method:'COD',     postex_cn:'',           status:'pending',   channel:'Direct',  created_at:'2026-05-02' },
  { id:'ord-4', shopify_order_number:'#2844', customer_name:'Chen Wei',     customer_phone:'0341-7771122', shipping_city:'Rawalpindi', total_price:8800,  payment_method:'COD',     postex_cn:'',           status:'pending',   channel:'Shopify', created_at:'2026-05-02' },
  { id:'ord-5', shopify_order_number:'#2843', customer_name:'Aisha Malik',  customer_phone:'0300-1112233', shipping_city:'Faisalabad', total_price:21500, payment_method:'COD',     postex_cn:'TCS-881220', status:'delivered', channel:'Amazon',  created_at:'2026-05-01' },
  { id:'ord-6', shopify_order_number:'#2842', customer_name:'Tom Lee',      customer_phone:'0345-9998877', shipping_city:'Multan',     total_price:4500,  payment_method:'Prepaid', postex_cn:'',           status:'cancelled', channel:'Direct',  created_at:'2026-05-01' },
  { id:'ord-7', shopify_order_number:'#2841', customer_name:'Fatima Raza',  customer_phone:'0311-4443322', shipping_city:'Peshawar',   total_price:13400, payment_method:'COD',     postex_cn:'TCS-880001', status:'delivered', channel:'Shopify', created_at:'2026-04-30' },
  { id:'ord-8', shopify_order_number:'#2840', customer_name:'Robert Kim',   customer_phone:'0321-6665544', shipping_city:'Quetta',     total_price:36700, payment_method:'COD',     postex_cn:'FedEx-99213',status:'in_transit', channel:'Amazon',  created_at:'2026-04-30' },
];

export default function Orders() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filter, search],
    queryFn: () => axios.get(`${API}/api/orders`, { params:{ status:filter, search } }).then(r => r.data),
    retry: false,
  });

  const bookMutation = useMutation({
    mutationFn: (id) => axios.post(`${API}/api/orders/${id}/book-postex`).then(r => r.data),
    onSuccess: (r) => { toast.success(`✅ PostEx booked! CN: ${r.tracking_number}`); qc.invalidateQueries({queryKey:['orders']}); },
    onError:   (e) => toast.error(e.response?.data?.error || e.message),
  });

  const orders = data?.orders || SAMPLE;
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const searched = search ? filtered.filter(o =>
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.shopify_order_number?.includes(search) ||
    o.postex_cn?.includes(search)
  ) : filtered;

  return (
    <div className="page-shell">
      <div className="topbar">
        <div className="topbar-title">Orders</div>
        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" placeholder="Search orders…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => toast('New order form coming soon')}>+ New Order</button>
      </div>

      <div className="content-scroll">
        <div className="table-wrap">
          <div className="table-toolbar">
            {STATUSES.map(s => (
              <button key={s} className={`filter-pill ${filter===s?'active':''}`} onClick={() => setFilter(s)}>
                {s === 'all' ? 'All' : s === 'in_transit' ? 'In Transit' : s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
            <div style={{ marginLeft:'auto', fontSize:12, color:'var(--gray-400)', fontFamily:'var(--font-mono)' }}>
              {searched.length} orders
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th><input type="checkbox" style={{ accentColor:'var(--green-600)' }}/></th>
                <th>Order #</th><th>Customer</th><th>City</th>
                <th>Amount</th><th>Payment</th><th>PostEx CN</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:'var(--gray-400)' }}>Loading…</td></tr>
              ) : searched.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:'var(--gray-400)' }}>No orders found</td></tr>
              ) : searched.map(o => (
                <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                  <td onClick={e=>e.stopPropagation()}><input type="checkbox" style={{ accentColor:'var(--green-600)' }}/></td>
                  <td className="td-mono">{o.shopify_order_number}</td>
                  <td><div className="td-name">{o.customer_name}</div><div className="td-sub">{o.customer_phone}</div></td>
                  <td className="td-muted">{o.shipping_city}</td>
                  <td className="td-amount">PKR {Number(o.total_price||0).toLocaleString()}</td>
                  <td>
                    <span style={{ background: o.payment_method==='COD'?'var(--amber-100)':'var(--green-100)', color: o.payment_method==='COD'?'var(--amber-700)':'var(--green-700)', padding:'2px 9px', borderRadius:5, fontSize:12, fontWeight:600 }}>
                      {o.payment_method||'COD'}
                    </span>
                  </td>
                  <td className="td-mono">{o.postex_cn || '—'}</td>
                  <td><Badge status={o.status}/></td>
                  <td onClick={e=>e.stopPropagation()}>
                    {!o.postex_cn ? (
                      <button className="action-btn primary" onClick={() => bookMutation.mutate(o.id)}>
                        📦 Book PostEx
                      </button>
                    ) : (
                      <a href={`${API}/api/orders/${o.id}/label`} target="_blank" rel="noreferrer" className="action-btn" onClick={e=>e.stopPropagation()}>
                        🖨 Label
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <div className="pg-info">Showing {searched.length} of {data?.total || searched.length} orders</div>
            <div style={{ display:'flex', gap:4 }}>
              {['←','1','2','3','→'].map((p,i) => (
                <button key={i} className={`pg-btn ${p==='1'?'active':''}`}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
