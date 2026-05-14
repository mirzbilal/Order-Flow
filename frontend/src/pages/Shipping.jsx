import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Topbar, Content, Btn, QsRow, TableWrap, Th, Td, Chip, Badge } from '../components/Layout';
import { ordersApi, postexApi } from '../lib/api';

export default function Shipping() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: booked }    = useQuery({ queryKey:['orders','booked'],    queryFn:() => ordersApi.list({ status:'booked',    limit:50 }), placeholderData:{ orders:[] } });
  const { data: inTransit } = useQuery({ queryKey:['orders','in_transit'],queryFn:() => ordersApi.list({ status:'in_transit', limit:50 }), placeholderData:{ orders:[] } });

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

  const allOrders = [...(booked?.orders||[]), ...(inTransit?.orders||[])].sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
  const bookedCount = booked?.total || 0;
  const transitCount = inTransit?.total || 0;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <Topbar title="Shipping & Tracking">
        <Btn loading={syncMutation.isPending} onClick={() => syncMutation.mutate()}>📡 Sync All Tracking</Btn>
      </Topbar>
      <Content>
        <QsRow stats={[
          { label:'Ready to Ship (Booked)', value:bookedCount,  color:'#1A6B3A' },
          { label:'In Transit',             value:transitCount, color:'#0A5C55' },
          { label:'Total Active',           value:bookedCount+transitCount, color:'#1A4FBF' },
        ]}/>
        <TableWrap>
          <thead>
            <tr style={{ background:'#F7F6F1' }}>
              <Th>PostEx CN</Th><Th>Order #</Th><Th>Customer</Th><Th>Phone</Th>
              <Th>City</Th><Th>Amount</Th><Th>Status</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {allOrders.length === 0 && <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'#AEADA6' }}>No active shipments</td></tr>}
            {allOrders.map(o => (
              <tr key={o.id} style={{ cursor:'pointer' }}
                onClick={() => navigate(`/orders/${o.id}`)}
                onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background='#F7F6F1')}
                onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background='')}>
                <Td mono style={{ color:'#1A4FBF' }}>{o.postex_cn||'—'}</Td>
                <Td mono order>{o.shopify_order_number}</Td>
                <Td><div style={{ fontWeight:500 }}>{o.customer_name}</div></Td>
                <Td muted>{o.customer_phone}</Td>
                <Td muted>{o.shipping_city}</Td>
                <Td amount>₨{Number(o.total_price).toLocaleString()}</Td>
                <Td><Badge status={o.status}/></Td>
                <Td onClick={e => e.stopPropagation()} style={{ whiteSpace:'nowrap' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    {!o.shopify_fulfilled && (
                      <button onClick={() => fulfillMutation.mutate(o.id)}
                        style={{ padding:'3px 8px', fontSize:11, borderRadius:6, border:'1px solid #1A4FBF', background:'#E8EEFB', color:'#1A4FBF', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontWeight:500 }}>
                        ✓ Fulfill
                      </button>
                    )}
                    <a href={`${import.meta.env.VITE_API_URL||'http://localhost:4000'}/api/orders/${o.id}/label`}
                      target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                      style={{ padding:'3px 8px', fontSize:11, borderRadius:6, border:'1px solid rgba(0,0,0,0.08)', background:'#fff', color:'#3A3A35', textDecoration:'none', fontFamily:"'Inter',sans-serif" }}>
                      🖨 Label
                    </a>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Content>
    </div>
  );
}
