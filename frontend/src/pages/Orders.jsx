import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Topbar, Content, Btn, Badge } from '../components/Layout';
import { ordersApi } from '../lib/api';

const STATUSES = ['all','pending','booked','in_transit','delivered','cancelled','returned'];

export default function Orders() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', filter, search, page],
    queryFn: () => ordersApi.list({ status: filter, search, page, limit: 20 }),
    retry: 1,
    staleTime: 30000,
  });

  const bookMutation = useMutation({
    mutationFn: (id) => ordersApi.bookPostex(id),
    onSuccess: (r) => { toast.success(`✅ PostEx booked! CN: ${r.tracking_number}`); qc.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const orders = data?.orders || [];
  const total  = data?.total  || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="page-shell">
      <div className="topbar">
        <div className="topbar-title">Orders</div>
        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" placeholder="Search orders, customer, phone…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn btn-primary" onClick={() => toast('New order form coming soon')}>+ New Order</button>
      </div>

      <div className="content-scroll">
        <div className="table-wrap">
          <div className="table-toolbar">
            {STATUSES.map(s => (
              <button key={s} className={`filter-pill ${filter===s?'active':''}`}
                onClick={() => { setFilter(s); setPage(1); }}>
                {s==='all' ? 'All' : s==='in_transit' ? 'In Transit' : s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
            <div style={{ marginLeft:'auto', fontSize:12, color:'var(--gray-400)', fontFamily:'var(--font-mono)' }}>
              {total} orders
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
              {isLoading && (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:'var(--gray-400)' }}>
                  Loading orders...
                </td></tr>
              )}
              {error && (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:'var(--red-600)' }}>
                  Failed to load orders: {error.message}
                </td></tr>
              )}
              {!isLoading && !error && orders.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:'var(--gray-400)' }}>
                  No orders found
                </td></tr>
              )}
              {orders.map(o => (
                <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                  <td onClick={e=>e.stopPropagation()}><input type="checkbox" style={{ accentColor:'var(--green-600)' }}/></td>
                  <td className="td-mono">{o.shopify_order_number}</td>
                  <td>
                    <div className="td-name">{o.customer_name}</div>
                    <div className="td-sub">{o.customer_phone}</div>
                  </td>
                  <td className="td-muted">{o.shipping_city}</td>
                  <td className="td-amount">PKR {Number(o.total_price||0).toLocaleString()}</td>
                  <td>
                    <span style={{
                      background: o.payment_method==='COD' ? 'var(--amber-100)' : 'var(--green-100)',
                      color:      o.payment_method==='COD' ? 'var(--amber-700)' : 'var(--green-700)',
                      padding:'2px 9px', borderRadius:5, fontSize:12, fontWeight:600
                    }}>
                      {o.payment_method || 'COD'}
                    </span>
                  </td>
                  <td className="td-mono">{o.postex_cn || '—'}</td>
                  <td><Badge status={o.status}/></td>
                  <td onClick={e=>e.stopPropagation()}>
                    {!o.postex_cn ? (
                      <button className="action-btn primary"
                        onClick={() => bookMutation.mutate(o.id)}
                        disabled={bookMutation.isPending}>
                        📦 Book PostEx
                      </button>
                    ) : (
                      <a href={`${import.meta.env.VITE_API_URL||'http://localhost:4000'}/api/orders/${o.id}/label`}
                        target="_blank" rel="noreferrer" className="action-btn"
                        onClick={e => e.stopPropagation()}>
                        🖨 Label
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <div className="pg-info">Showing {orders.length} of {total} orders</div>
            <div style={{ display:'flex', gap:4 }}>
              <button className="pg-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>←</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} className={`pg-btn ${page===p?'active':''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="pg-btn" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}>→</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
