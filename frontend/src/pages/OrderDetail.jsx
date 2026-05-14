import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Topbar, Content, Btn, Badge, PanelSection, DetailRow, Timeline } from '../components/Layout';
import { ordersApi } from '../lib/api';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id),
  });

  const bookMutation = useMutation({
    mutationFn: () => ordersApi.bookPostex(id),
    onSuccess: r => { toast.success(`✅ Booked! CN: ${r.postex_cn}`); qc.invalidateQueries({ queryKey:['order', id] }); },
    onError: e => toast.error(e.response?.data?.error || e.message),
  });
  const fulfillMutation = useMutation({
    mutationFn: () => ordersApi.fulfillShopify(id),
    onSuccess: () => { toast.success('✅ Fulfilled on Shopify!'); qc.invalidateQueries({ queryKey:['order', id] }); },
    onError: e => toast.error(e.response?.data?.error || e.message),
  });
  const trackMutation = useMutation({
    mutationFn: () => ordersApi.track(id),
    onSuccess: () => { toast.success('Tracking refreshed'); qc.invalidateQueries({ queryKey:['order', id] }); },
    onError: e => toast.error(e.response?.data?.error || e.message),
  });
  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: () => { toast.success('Order cancelled'); qc.invalidateQueries({ queryKey:['order', id] }); },
    onError: e => toast.error(e.response?.data?.error || e.message),
  });

  if (isLoading) return <div style={{ padding:40, textAlign:'center', color:'#AEADA6' }}>Loading…</div>;
  if (!order)    return <div style={{ padding:40, textAlign:'center', color:'#AEADA6' }}>Order not found</div>;

  const tlEvents = [
    { e:'Order Placed',       t: new Date(order.created_at).toLocaleString(),            done: true },
    { e:'Payment Confirmed',  t: 'Confirmed',                                             done: true },
    { e:'Booked with PostEx', t: order.postex_booked_at ? new Date(order.postex_booked_at).toLocaleString() : 'Pending', done: !!order.postex_cn },
    { e:'In Transit',         t: ['in_transit','delivered'].includes(order.status)?'Active':'Pending', done: ['in_transit','delivered'].includes(order.status) },
    { e:'Delivered',          t: order.status==='delivered'?'Completed':'Pending',        done: order.status==='delivered' },
  ];

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <Topbar title={order.shopify_order_number || 'Order Detail'}>
        <Badge status={order.status}/>
        {!order.postex_cn && <Btn primary loading={bookMutation.isPending} onClick={() => bookMutation.mutate()}>📦 Book PostEx</Btn>}
        {order.postex_cn  && <Btn loading={trackMutation.isPending} onClick={() => trackMutation.mutate()}>📡 Refresh Tracking</Btn>}
        {order.postex_cn  && !order.shopify_fulfilled && <Btn primary loading={fulfillMutation.isPending} onClick={() => fulfillMutation.mutate()}>✓ Fulfill on Shopify</Btn>}
        {order.postex_cn  && <Btn href={`${import.meta.env.VITE_API_URL||'http://localhost:4000'}/api/orders/${id}/label`}>🖨 Print Label</Btn>}
        {!['cancelled','delivered'].includes(order.status) && <Btn style={{ color:'#A3200D', borderColor:'rgba(163,32,13,0.3)' }} loading={cancelMutation.isPending} onClick={() => { if(confirm('Cancel this order?')) cancelMutation.mutate(); }}>✕ Cancel</Btn>}
        <Btn onClick={() => navigate('/orders')}>← Back</Btn>
      </Topbar>

      <Content>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:16, alignItems:'start' }}>
          <div>
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:16, padding:20, marginBottom:16 }}>
              <PanelSection label="Order Details">
                <DetailRow label="Order #"   value={order.shopify_order_number}/>
                <DetailRow label="Date"      value={new Date(order.created_at).toLocaleString()}/>
                <DetailRow label="Channel"   value={order.channel||'Shopify'}/>
                <DetailRow label="Payment"   value={order.payment_method||'COD'}/>
                <DetailRow label="Total"     value={`₨${Number(order.total_price).toLocaleString()} ${order.currency||'PKR'}`}/>
                {order.notes && <DetailRow label="Notes" value={order.notes}/>}
              </PanelSection>
            </div>

            {(order.line_items||[]).length > 0 && (
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:16, padding:20, marginBottom:16 }}>
                <div style={{ fontSize:9.5, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.9px', color:'#AEADA6', marginBottom:12 }}>Items</div>
                {(order.line_items||[]).map((item,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(0,0,0,0.04)', fontSize:13 }}>
                    <div>
                      <div style={{ fontWeight:500 }}>{item.title||item.name}</div>
                      {item.sku && <div style={{ fontSize:11, color:'#AEADA6', marginTop:2 }}>SKU: {item.sku}</div>}
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div>×{item.quantity}</div>
                      <div style={{ fontSize:12, color:'#AEADA6' }}>₨{Number(item.price).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {order.postex_cn && (
              <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:16, padding:20 }}>
                <PanelSection label="PostEx Shipment">
                  <DetailRow label="CN Number"   value={<span style={{ fontFamily:"'JetBrains Mono',monospace", color:'#1A4FBF' }}>{order.postex_cn}</span>}/>
                  <DetailRow label="Status"      value={order.postex_status||'—'}/>
                  <DetailRow label="Booked At"   value={order.postex_booked_at ? new Date(order.postex_booked_at).toLocaleString() : '—'}/>
                  <DetailRow label="Shopify"     value={order.shopify_fulfilled?'✅ Fulfilled':'❌ Not fulfilled'}/>
                </PanelSection>
                <PanelSection label="Tracking Timeline">
                  <Timeline events={tlEvents}/>
                </PanelSection>
              </div>
            )}
          </div>

          <div>
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:16, padding:20, marginBottom:14 }}>
              <PanelSection label="Customer">
                <DetailRow label="Name"  value={order.customer_name}/>
                <DetailRow label="Email" value={<span style={{ color:'#1A4FBF' }}>{order.customer_email}</span>}/>
                <DetailRow label="Phone" value={order.customer_phone}/>
              </PanelSection>
            </div>
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:16, padding:20 }}>
              <PanelSection label="Shipping Address">
                <DetailRow label="Address"  value={order.shipping_address}/>
                <DetailRow label="City"     value={order.shipping_city}/>
                <DetailRow label="Province" value={order.shipping_province}/>
                <DetailRow label="Country"  value={order.shipping_country||'Pakistan'}/>
              </PanelSection>
            </div>
          </div>
        </div>
      </Content>
    </div>
  );
}
