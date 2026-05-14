import { Topbar, Content, QsRow, TableWrap, Th, Td, Badge } from '../components/Layout';

const RETURNS = [
  { rma:'RMA-001', order:'#ORD-2838', customer:'David Park',  items:3, reason:'Wrong size',       refund:'₨17,700', status:'pending' },
  { rma:'RMA-002', order:'#ORD-2801', customer:'Nadia Shah',  items:1, reason:'Defective product', refund:'₨6,700',  status:'processing' },
  { rma:'RMA-003', order:'#ORD-2780', customer:'Umar Khan',   items:2, reason:'Not as described',  refund:'₨13,400', status:'pending' },
];

export default function Returns() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <Topbar title="Returns & Refunds"/>
      <Content>
        <QsRow stats={[
          { label:'Pending Returns',   value:3,       color:'#92500A' },
          { label:'Refunded (Month)',  value:'₨2.1L' },
          { label:'Return Rate',       value:'3.2%' },
        ]}/>
        <TableWrap>
          <thead>
            <tr style={{ background:'#F7F6F1' }}>
              <Th>RMA #</Th><Th>Order</Th><Th>Customer</Th><Th>Items</Th><Th>Reason</Th><Th>Refund</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {RETURNS.map(r => (
              <tr key={r.rma} style={{ cursor:'pointer' }}
                onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background='#F7F6F1')}
                onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background='')}>
                <Td mono>{r.rma}</Td>
                <Td mono order>{r.order}</Td>
                <Td><div style={{ fontWeight:500 }}>{r.customer}</div></Td>
                <Td muted>{r.items}</Td>
                <Td muted>{r.reason}</Td>
                <Td amount>{r.refund}</Td>
                <Td><Badge status={r.status}/></Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Content>
    </div>
  );
}
