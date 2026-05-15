import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Topbar, Content, Btn, Badge } from '../components/Layout';
import { ordersApi, postexApi } from '../lib/api';

export default function Shipping() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: booked,    isLoading: l1 } = useQuery({
    queryKey: ['orders','booked'],
    queryFn:  () => ordersApi.list({ status:'booked',     limit:100 }),
    staleTime: 30000,
  });
  const { data: inTransit, isLoading: l2 } = useQuery({
    queryKey: ['orders','in_transit'],
    queryFn:  () => ordersApi.list({ status:'in_transit', limit:100 }),
    staleTime: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: postexApi.syncTracking,
    onSuccess: r => { toast.success(`📡 Updated ${r.updated||0} shipments`); qc.invalidateQueries({ queryKey:['orders'] }); },
    onError:   e => toast.error(e.response?.data?.error || e.message),
  });

  const fulfillMutation = useMutation({
    mutationFn: id => ordersApi.fulfillShopify(id),
    onSuccess: () => { toast.success('✅ Fulfilled on Shopify!'); qc.invalidateQueries({ queryKey:['orders'] }); },
    onError:   e => toast.error(e.response?.data?.error || e.message),
  });

  const bookedOrders  = booked?.orders    || [];
  const transitOrders = inTransit?.orders || [];
  const allOrders     = [...bookedOrders, ...transitOrders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const bookedCount  = booked?.total    || 0;
  const transitCount = inTransit?.total || 0;
  const isLoading    = l1 || l2;

  return (
    <div className="page-shell">
      <Topbar title="Shipping & Tracking">
        <Btn loading={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
          📡 Sync All Tracking
        </Btn>
      </Topbar>

      <Content>
        {/* Stats */}
        <div className="qs-row">
          <div className="qs-card">
            <div className="qs-label">Ready to Ship</div>
            <div className="qs-value" style={{ color:'var(--green-700)' }}>{bookedCount}</div>
          </div>
          <div className="qs-card">
            <div className="qs-label">In Transit</div>
            <div className="qs-value" style={{ color:'var(--teal-600)' }}>{transitCount}</div>
          </div>
          <div className="qs-card">
            <div className="qs-label">Total Active</div>
            <div className="qs-value" style={{ color:'var(--blue-600)' }}>{bookedCount + transitCount}</div>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PostEx CN</th><th>Order #</th><th>Customer</th>
                <th>Phone</th><th>City</th><th>Amount</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>
                  Loading shipments...
                </td></tr>
              )}
              {!isLoading && allOrders.length === 0 && (
                <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>
                  No active shipments — book orders with PostEx first
                </td></tr>
              )}
              {allOrders.map(o => (
                <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                  <td className="td-mono">{o.postex_cn || '—'}</td>
                  <td className="td-mono">{o.shopify_order_number}</td>
                  <td><div className="td-name">{o.customer_name}</div></td>
                  <td className="td-muted">{o.customer_phone}</td>
                  <td className="td-muted">{o.shipping_city}</td>
                  <td className="td-amount">PKR {Number(o.total_price||0).toLocaleString()}</td>
                  <td><Badge status={o.status}/></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', gap:6 }}>
                      {!o.shopify_fulfilled && (
                        <button className="action-btn primary"
                          onClick={() => fulfillMutation.mutate(o.id)}
                          disabled={fulfillMutation.isPending}>
                          ✓ Fulfill
                        </button>
                      )}
                      <a
                        href={`${import.meta.env.VITE_API_URL||'http://localhost:4000'}/api/orders/${o.id}/label`}
                        target="_blank" rel="noreferrer" className="action-btn"
                        onClick={e => e.stopPropagation()}>
                        🖨 Label
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Content>
    </div>
  );
}
