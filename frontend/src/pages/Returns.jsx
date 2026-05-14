import { Topbar, Content, Badge } from '../components/Layout';

const RETURNS = [
  { rma:'RMA-001', order:'#ORD-2838', customer:'David Park',  items:3, reason:'Wrong size',       refund:'PKR 17,700', status:'pending' },
  { rma:'RMA-002', order:'#ORD-2801', customer:'Nadia Shah',  items:1, reason:'Defective product', refund:'PKR 6,700',  status:'processing' },
  { rma:'RMA-003', order:'#ORD-2780', customer:'Umar Khan',   items:2, reason:'Not as described',  refund:'PKR 13,400', status:'pending' },
];

export default function Returns() {
  return (
    <div className="page-shell">
      <Topbar title="Returns & Refunds" />
      <Content>
        <div className="qs-row">
          {[
            { label:'Pending Returns',  value:3,       color:'var(--amber-700)' },
            { label:'Refunded (Month)', value:'₨2.1L', color:'var(--gray-900)'  },
            { label:'Return Rate',      value:'3.2%',  color:'var(--gray-900)'  },
          ].map(s => (
            <div key={s.label} className="qs-card">
              <div className="qs-label">{s.label}</div>
              <div className="qs-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>RMA #</th><th>Order</th><th>Customer</th><th>Items</th><th>Reason</th><th>Refund</th><th>Status</th></tr>
            </thead>
            <tbody>
              {RETURNS.map(r => (
                <tr key={r.rma}>
                  <td className="td-mono">{r.rma}</td>
                  <td className="td-mono">{r.order}</td>
                  <td><div className="td-name">{r.customer}</div></td>
                  <td className="td-muted">{r.items}</td>
                  <td className="td-muted">{r.reason}</td>
                  <td className="td-amount">{r.refund}</td>
                  <td><Badge status={r.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Content>
    </div>
  );
}
