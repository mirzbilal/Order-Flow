import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Topbar, Content, Btn, Badge } from '../components/Layout';
import { ordersApi, postexApi } from '../lib/api';

const SAMPLE = [
  { id:'s1', postex_cn:'TCS-8872341', shopify_order_number:'#2847', customer_name:'Sara Ahmed',  customer_phone:'0312-1234567', shipping_city:'Karachi',  total_price:14200, status:'delivered',  shopify_fulfilled:true },
  { id:'s2', postex_cn:'DHL-4421987', shopify_order_number:'#2846', customer_name:'James Wilson',customer_phone:'0321-9876543', shipping_city:'Lahore',   total_price:6750,  status:'in_transit', shopify_fulfilled:false },
  { id:'s3', postex_cn:'FedEx-99213', shopify_order_number:'#2840', customer_name:'Robert Kim',  customer_phone:'0321-6665544', shipping_city:'Quetta',   total_price:36700, status:'in_transit', shopify_fulfilled:false },
];

export default function Shipping() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: booked }    = useQuery({ queryKey:['orders','booked'],     queryFn:() => ordersApi.list({ status:'booked',     limit:50 }), retry:false });
  const { data: inTransit } = useQuery({ queryKey:['orders','in_transit'], queryFn:() => ordersApi.list({ status:'in_transit',  limit:50 }), retry:false });

  const syncMutation = useMutation({
    mutationFn: postexApi.syncTracking,
    onSuccess: r => { toast.success(`📡 Updated ${r.updated||0} shipments`); qc.invalidateQueries({ queryKey:['orders'] }); },
    onError: e => toast.error(e.response?.data?.error || e.message),
  });

  const fulfillMutation = useMutation({
    mutationFn: id => ordersApi.fulfillShopify(id),
    onSuccess: () => { toast.success('✅ Fulfilled on Shopify!'); qc.invalidateQueries({ queryKey:['orders'] }); },
    onError: e => toast.error(e.response?.data?.error || e.message),
  });

  const allOrders = [...(booked?.orders||[]), ...(inTransit?.orders||[])];
  const orders = allOrders.length > 0 ? allOrders : SAMPLE;
  const bookedCount  = booked?.total  || 0;
  const transitCount = inTransit?.total || 0;

  return (
    <div className="page-shell">
      <Topbar title="Shipping & Tracking">
        <Btn loading={syncMutation.isPending} onClick={() => syncMutation.mutate()}>📡 Sync All Tracking</Btn>
      </Topbar>
      <Content>
        {/* Stats */}
        <div className="qs-row">
          {[
            { label:'Ready to Ship', value: bookedCount,  color:'var(--green-700)' },
            { label:'In Transit',    value: transitCount, color:'var(--teal-600)'  },
            { label:'Total Active',  value: bookedCount + transitCount, color:'var(--blue-600)' },
          ].map(s => (
            <div key={s.label} className="qs-card">
              <div className="qs-label">{s.label}</div>
              <div className="qs-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PostEx CN</th><th>Order #</th><th>Customer</th><th>Phone</th>
                <th>City</th><th>Amount</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>No active shipments</td></tr>
              )}
              {orders.map(o => (
                <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                  <td className="td-mono">{o.postex_cn||'—'}</td>
                  <td className="td-mono">{o.shopify_order_number}</td>
                  <td><div className="td-name">{o.customer_name}</div></td>
                  <td className="td-muted">{o.customer_phone}</td>
                  <td className="td-muted">{o.shipping_city}</td>
                  <td className="td-amount">PKR {Number(o.total_price||0).toLocaleString()}</td>
                  <td><Badge status={o.status}/></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', gap:6 }}>
                      {!o.shopify_fulfilled && (
                        <button className="action-btn primary" onClick={() => fulfillMutation.mutate(o.id)}>✓ Fulfill</button>
                      )}
                      <a href={`${import.meta.env.VITE_API_URL||'http://localhost:4000'}/api/orders/${o.id}/label`}
                        target="_blank" rel="noreferrer" className="action-btn" onClick={e => e.stopPropagation()}>
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
