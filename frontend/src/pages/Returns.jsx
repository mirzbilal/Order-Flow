import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function Badge({ status }) {
  const map = { pending:'badge-pending', booked:'badge-booked', in_transit:'badge-transit', delivered:'badge-delivered', cancelled:'badge-cancelled', returned:'badge-returned' };
  const labels = { pending:'Pending', booked:'Booked', in_transit:'In Transit', delivered:'Delivered', cancelled:'Cancelled', returned:'Returned' };
  return <span className={`badge ${map[status]||'badge-pending'}`}>{labels[status]||status}</span>;
}

export default function Returns() {
  const navigate = useNavigate();

  const { data: returnsData, isLoading } = useQuery({
    queryKey: ['orders', 'returned'],
    queryFn:  () => axios.get(`${API}/api/orders`, { params:{ status:'returned', limit:100 } }).then(r => r.data),
    staleTime: 30000,
  });

  const { data: cancelledData } = useQuery({
    queryKey: ['orders', 'cancelled'],
    queryFn:  () => axios.get(`${API}/api/orders`, { params:{ status:'cancelled', limit:100 } }).then(r => r.data),
    staleTime: 30000,
  });

  const returns   = returnsData?.orders   || [];
  const cancelled = cancelledData?.orders || [];
  const allOrders = [...returns, ...cancelled].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="page-shell">
      <div className="topbar">
        <div className="topbar-title">Returns & Cancellations</div>
      </div>

      <div className="content-scroll">
        {/* Stats */}
        <div className="qs-row">
          <div className="qs-card">
            <div className="qs-label">Total Returns</div>
            <div className="qs-value" style={{ color:'var(--amber-700)' }}>{returnsData?.total || 0}</div>
          </div>
          <div className="qs-card">
            <div className="qs-label">Cancelled Orders</div>
            <div className="qs-value" style={{ color:'var(--red-600)' }}>{cancelledData?.total || 0}</div>
          </div>
          <div className="qs-card">
            <div className="qs-label">Total Value</div>
            <div className="qs-value">
              PKR {allOrders.reduce((s,o) => s + Number(o.total_price||0), 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order #</th><th>Customer</th><th>City</th>
                <th>Amount</th><th>Payment</th><th>PostEx CN</th><th>Status</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>Loading...</td></tr>
              )}
              {!isLoading && allOrders.length === 0 && (
                <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>
                  No returns or cancellations found
                </td></tr>
              )}
              {allOrders.map(o => (
                <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                  <td className="td-mono">{o.shopify_order_number}</td>
                  <td><div className="td-name">{o.customer_name}</div><div className="td-sub">{o.customer_phone}</div></td>
                  <td className="td-muted">{o.shipping_city}</td>
                  <td className="td-amount">PKR {Number(o.total_price||0).toLocaleString()}</td>
                  <td>
                    <span style={{ background:o.payment_method==='COD'?'var(--amber-100)':'var(--green-100)', color:o.payment_method==='COD'?'var(--amber-700)':'var(--green-700)', padding:'2px 9px', borderRadius:5, fontSize:12, fontWeight:600 }}>
                      {o.payment_method||'COD'}
                    </span>
                  </td>
                  <td className="td-mono">{o.postex_cn || '—'}</td>
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
