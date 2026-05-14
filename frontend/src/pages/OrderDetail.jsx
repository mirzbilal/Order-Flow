import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Topbar, Content, Btn, Badge } from '../components/Layout';
import { ordersApi } from '../lib/api';

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--gray-400)', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13, gap: 12 }}>
      <span style={{ color: 'var(--gray-500)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, color: 'var(--gray-900)', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

function Timeline({ events }) {
  return (
    <div>
      {events.map((ev, i) => {
        const isLast = i === events.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: ev.done ? 'var(--green-500)' : 'var(--gray-200)', border: `2px solid ${ev.done ? 'var(--green-500)' : 'var(--gray-200)'}`, flexShrink: 0, marginTop: 3 }} />
              {!isLast && <div style={{ width: 2, flex: 1, background: ev.done ? 'var(--green-200)' : 'var(--gray-200)', margin: '4px 0', minHeight: 18 }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-900)' }}>{ev.e}</div>
              <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 2 }}>{ev.t}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id),
    retry: false,
  });

  const bookMutation = useMutation({
    mutationFn: () => ordersApi.bookPostex(id),
    onSuccess: (r) => { toast.success(`✅ PostEx booked! CN: ${r.tracking_number}`); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const fulfillMutation = useMutation({
    mutationFn: () => ordersApi.fulfillShopify(id),
    onSuccess: () => { toast.success('✅ Fulfilled on Shopify!'); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: () => { toast.success('Order cancelled'); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const trackMutation = useMutation({
    mutationFn: () => ordersApi.track(id),
    onSuccess: () => { toast.success('Tracking refreshed'); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Loading order...</div>;
  if (!order)    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Order not found</div>;

  const timeline = order.timeline || [
    { e: 'Order Placed',       t: order.created_at ? new Date(order.created_at).toLocaleString() : '—', done: true },
    { e: 'Booked with PostEx', t: order.postex_booked_at ? new Date(order.postex_booked_at).toLocaleString() : 'Pending', done: !!order.postex_cn },
    { e: 'Shipped',            t: order.status === 'in_transit' || order.status === 'delivered' ? 'In transit' : 'Pending', done: ['in_transit','delivered'].includes(order.status) },
    { e: 'Delivered',          t: order.delivered_at ? new Date(order.delivered_at).toLocaleString() : 'Pending', done: order.status === 'delivered' },
  ];

  return (
    <div className="page-shell">
      <Topbar title={order.shopify_order_number || `Order ${id.slice(0,8)}`}>
        <button className="btn" onClick={() => navigate('/orders')}>← Back</button>
        {!order.postex_cn && (
          <Btn primary loading={bookMutation.isPending} onClick={() => bookMutation.mutate()}>📦 Book PostEx</Btn>
        )}
        {order.postex_cn && !order.shopify_fulfilled && (
          <Btn primary loading={fulfillMutation.isPending} onClick={() => fulfillMutation.mutate()}>✓ Fulfill Shopify</Btn>
        )}
        {order.postex_cn && (
          <Btn loading={trackMutation.isPending} onClick={() => trackMutation.mutate()}>📡 Track</Btn>
        )}
        {order.postex_cn && (
          <a href={`${API}/api/orders/${id}/label`} target="_blank" rel="noreferrer" className="btn">🖨 Label</a>
        )}
        {!['cancelled','delivered'].includes(order.status) && (
          <Btn danger loading={cancelMutation.isPending} onClick={() => { if (window.confirm('Cancel this order?')) cancelMutation.mutate(); }}>Cancel</Btn>
        )}
        <Badge status={order.status} />
      </Topbar>

      <Content>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
          {/* Left */}
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-header"><span className="card-title">Order Details</span></div>
              <div className="card-body">
                <Row label="Order #"      value={order.shopify_order_number} />
                <Row label="Date"         value={order.created_at ? new Date(order.created_at).toLocaleString() : '—'} />
                <Row label="Channel"      value={order.channel} />
                <Row label="Payment"      value={order.payment_method} />
                <Row label="Total"        value={`PKR ${Number(order.total_price || 0).toLocaleString()}`} />
                {order.notes && <Row label="Notes" value={order.notes} />}
              </div>
            </div>

            {(order.line_items || []).length > 0 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-header"><span className="card-title">Items</span></div>
                <div className="card-body">
                  {(order.line_items || []).map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{item.title}</div>
                        {item.sku && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>SKU: {item.sku}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div>×{item.quantity}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>PKR {Number(item.price || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.postex_cn && (
              <div className="card">
                <div className="card-header"><span className="card-title">PostEx Shipment</span></div>
                <div className="card-body">
                  <Row label="CN Number"        value={<span style={{ fontFamily: 'var(--font-mono)', color: 'var(--green-700)' }}>{order.postex_cn}</span>} />
                  <Row label="PostEx Status"    value={order.postex_status} />
                  <Row label="Booked At"        value={order.postex_booked_at ? new Date(order.postex_booked_at).toLocaleString() : '—'} />
                  <Row label="Shopify Fulfilled" value={order.shopify_fulfilled ? '✅ Yes' : '❌ No'} />
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--gray-400)', marginBottom: 12 }}>Tracking Timeline</div>
                    <Timeline events={timeline} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-header"><span className="card-title">Customer</span></div>
              <div className="card-body">
                <Row label="Name"  value={order.customer_name} />
                <Row label="Email" value={order.customer_email} />
                <Row label="Phone" value={order.customer_phone} />
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Shipping Address</span></div>
              <div className="card-body">
                <Row label="Address"  value={order.shipping_address} />
                <Row label="City"     value={order.shipping_city} />
                <Row label="Province" value={order.shipping_province} />
                <Row label="Country"  value={order.shipping_country} />
              </div>
            </div>
          </div>
        </div>
      </Content>
    </div>
  );
}
