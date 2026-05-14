import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const EVENT_INFO = {
  confirmed: { icon:'✅', label:'Order Confirmed', color:'#1A6B3A', bg:'#E3F2E9', desc:'Sent when a new Shopify order is synced' },
  booked:    { icon:'📦', label:'PostEx Booked',   color:'#1A4FBF', bg:'#E8EEFB', desc:'Sent when a CN is assigned from PostEx' },
  shipped:   { icon:'🚚', label:'Shipped',          color:'#0A5C55', bg:'#E2F3F1', desc:'Sent when order goes in transit' },
  delivered: { icon:'🎉', label:'Delivered',        color:'#92500A', bg:'#FDF0E0', desc:'Sent when PostEx marks as delivered' },
};

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:16, padding:'18px 20px', display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ fontSize:22 }}>{icon}</div>
      <div style={{ fontSize:11, fontWeight:600, color:'#7A7A72', textTransform:'uppercase', letterSpacing:'0.6px', marginTop:4 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:600, fontFamily:'var(--font)', color: color||'#0D0D0B', letterSpacing:'-1px', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#AEADA6' }}>{sub}</div>}
    </div>
  );
}

function EventCard({ event, info, stats }) {
  const s = stats?.byEvent?.[event] || { sent:0, failed:0 };
  return (
    <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:42, height:42, borderRadius:12, background:info.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{info.icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#0D0D0B', marginBottom:2 }}>{info.label}</div>
        <div style={{ fontSize:11, color:'#AEADA6' }}>{info.desc}</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:18, fontWeight:700, fontFamily:'var(--font)', color:info.color }}>{s.sent}</div>
        <div style={{ fontSize:10, color:'#AEADA6' }}>sent</div>
      </div>
      {s.failed > 0 && (
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#A3200D' }}>{s.failed}</div>
          <div style={{ fontSize:10, color:'#AEADA6' }}>failed</div>
        </div>
      )}
    </div>
  );
}

export default function WhatsApp() {
  const [testPhone, setTestPhone] = useState('');
  const [previewEvent, setPreviewEvent] = useState('confirmed');

  const { data: stats }  = useQuery({ queryKey:['wa-stats'],  queryFn: () => axios.get(`${API}/api/whatsapp/stats`).then(r=>r.data),  refetchInterval:30000 });
  const { data: logsRes, refetch } = useQuery({ queryKey:['wa-logs'],   queryFn: () => axios.get(`${API}/api/whatsapp/logs?limit=50`).then(r=>r.data), refetchInterval:30000 });

  const testMutation = useMutation({
    mutationFn: (phone) => axios.post(`${API}/api/whatsapp/test`, { phone }).then(r=>r.data),
    onSuccess: (r) => { toast.success(`✅ Test sent! SID: ${r.sid}`); },
    onError:   (e) => toast.error(`❌ ${e.response?.data?.error || e.message}`),
  });

  const logs = logsRes?.logs || [];

  const PREVIEWS = {
    confirmed: `Hello Sara Ahmed! 👋\n\n✅ *Order Confirmed*\n\nYour order *#1001* has been received and is being processed.\n\n🛍 *Items:* 1x Wireless Earbuds Pro\n💰 *Amount:* PKR 14,200\n💳 *Payment:* COD\n📍 *Delivery to:* Karachi\n\nWe'll notify you once your order is dispatched. Thank you for shopping with us! 🙏`,
    booked:    `Hello Sara Ahmed! 📦\n\nYour order *#1001* has been handed over to *PostEx* for delivery.\n\n🔖 *Tracking No:* TCS-887234\n📍 *Delivery to:* 45 Garden Road, Karachi\n💰 *COD Amount:* PKR 14,200\n\nYou can track your parcel at:\n🔗 https://postex.pk/tracking?cn=TCS-887234\n\nExpected delivery: 2-4 working days. We'll update you when it's delivered! 🚚`,
    shipped:   `Hello Sara Ahmed! 🚚\n\nYour order *#1001* is now *On the Way!*\n\n📦 *PostEx Tracking:* TCS-887234\n📍 *Delivering to:* Karachi\n💰 *Amount to Pay:* PKR 14,200\n\nTrack live: https://postex.pk/tracking?cn=TCS-887234\n\nPlease keep your phone available for the delivery rider. 📞`,
    delivered: `Hello Sara Ahmed! 🎉\n\nYour order *#1001* has been *Delivered* successfully!\n\nWe hope you love your purchase. If you have any issues, please contact us and we'll be happy to help.\n\nThank you for choosing us! ⭐ Have a great day!`,
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Topbar */}
      <div style={{ background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', padding:'0 24px', height:56, display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
        <div style={{ fontFamily:'var(--font)', fontSize:18, fontWeight:600, flex:1 }}>WhatsApp Automation</div>
        <button onClick={() => refetch()} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid rgba(0,0,0,0.08)', background:'#fff', fontSize:12.5, fontFamily:"'Inter',sans-serif", fontWeight:500, cursor:'pointer' }}>↻ Refresh</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          <StatCard icon="💬" label="Total Sent"    value={stats?.total   || 0} color="#1A4FBF" />
          <StatCard icon="✅" label="Delivered"     value={stats?.success || 0} color="#1A6B3A" />
          <StatCard icon="❌" label="Failed"        value={stats?.failed  || 0} color="#A3200D" />
          <StatCard icon="📊" label="Success Rate"  value={stats?.total ? `${Math.round((stats.success/stats.total)*100)}%` : '—'} color="#0A5C55" />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:16, marginBottom:20 }}>
          {/* Left: events + logs */}
          <div>
            {/* Event triggers */}
            <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Automated Triggers</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {Object.entries(EVENT_INFO).map(([event, info]) => (
                <EventCard key={event} event={event} info={info} stats={stats} />
              ))}
            </div>

            {/* Message Log */}
            <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Recent Messages</div>
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:16, overflow:'hidden' }}>
              {logs.length === 0 ? (
                <div style={{ padding:40, textAlign:'center', color:'#AEADA6', fontSize:13 }}>
                  No messages sent yet.<br/>
                  <span style={{ fontSize:12 }}>Messages will appear here automatically.</span>
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#F7F6F1' }}>
                      {['Order','Customer','Phone','Event','Status','Time'].map(h => (
                        <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10.5, fontWeight:600, color:'#7A7A72', textTransform:'uppercase', letterSpacing:'0.6px', borderBottom:'1px solid rgba(0,0,0,0.08)', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const info = EVENT_INFO[log.event] || EVENT_INFO.confirmed;
                      const isOk = log.status !== 'failed';
                      return (
                        <tr key={log.id} style={{ borderBottom:'1px solid rgba(0,0,0,0.04)' }}>
                          <td style={{ padding:'10px 14px', fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#1A4FBF', fontWeight:500 }}>
                            {log.orders?.shopify_order_number || '—'}
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:12.5, fontWeight:500 }}>
                            {log.orders?.customer_name || '—'}
                          </td>
                          <td style={{ padding:'10px 14px', fontFamily:"'JetBrains Mono',monospace", fontSize:11.5, color:'#7A7A72' }}>{log.phone}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:info.bg, color:info.color, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                              {info.icon} {info.label}
                            </span>
                          </td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:4, background: isOk?'#E3F2E9':'#FAEAE7', color: isOk?'#1A6B3A':'#A3200D', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                              {isOk ? '✓ Sent' : '✕ Failed'}
                            </span>
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:11.5, color:'#AEADA6' }}>
                            {new Date(log.sent_at).toLocaleString('en-PK', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right: preview + test */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Test sender */}
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:16, padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>🧪 Send Test Message</div>
              <div style={{ fontSize:11.5, color:'#7A7A72', marginBottom:14 }}>Verify your Twilio connection is working</div>
              <label style={{ fontSize:11, fontWeight:600, color:'#7A7A72', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:5 }}>Phone Number</label>
              <input
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="03001234567"
                style={{ width:'100%', padding:'8px 12px', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, fontSize:13, fontFamily:"'Inter',sans-serif", marginBottom:12, outline:'none', boxSizing:'border-box' }}
              />
              <div style={{ fontSize:11, color:'#AEADA6', marginBottom:12, padding:'8px 10px', background:'#F7F6F1', borderRadius:8, lineHeight:1.5 }}>
                ⚠️ <strong>Sandbox mode:</strong> The recipient must first send <code style={{ background:'#E5E3DA', padding:'1px 4px', borderRadius:4 }}>join &lt;your-word&gt;</code> to <strong>+1 415 523 8886</strong> on WhatsApp to opt in.
              </div>
              <button
                onClick={() => testMutation.mutate(testPhone)}
                disabled={!testPhone || testMutation.isPending}
                style={{ width:'100%', padding:'9px', borderRadius:8, border:'none', background: testPhone?'#0D0D0B':'#E5E3DA', color: testPhone?'#fff':'#AEADA6', fontSize:13, fontWeight:600, cursor: testPhone?'pointer':'not-allowed', fontFamily:"'Inter',sans-serif", transition:'all 0.15s' }}
              >
                {testMutation.isPending ? '⏳ Sending…' : '📱 Send Test Message'}
              </button>
            </div>

            {/* Message Preview */}
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:16, padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Message Preview</div>
              <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
                {Object.entries(EVENT_INFO).map(([event, info]) => (
                  <button key={event} onClick={() => setPreviewEvent(event)} style={{ padding:'4px 10px', borderRadius:20, border:`1px solid ${previewEvent===event?info.color:'rgba(0,0,0,0.08)'}`, background: previewEvent===event?info.bg:'#fff', color: previewEvent===event?info.color:'#7A7A72', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif", transition:'all 0.12s' }}>
                    {info.icon} {info.label}
                  </button>
                ))}
              </div>

              {/* WhatsApp bubble */}
              <div style={{ background:'#E8F5E9', borderRadius:12, padding:4 }}>
                <div style={{ background:'#fff', borderRadius:'12px 12px 12px 2px', padding:'10px 14px', fontSize:12.5, lineHeight:1.6, color:'#111', whiteSpace:'pre-wrap', boxShadow:'0 1px 2px rgba(0,0,0,0.08)' }}>
                  {PREVIEWS[previewEvent]}
                </div>
                <div style={{ textAlign:'right', padding:'4px 8px 2px', fontSize:10, color:'#7A7A72' }}>
                  {new Date().toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit' })} ✓✓
                </div>
              </div>
            </div>

            {/* Setup guide */}
            <div style={{ background:'var(--gray-900)', borderRadius:16, padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#fff', marginBottom:12 }}>🚀 Setup Guide</div>
              {[
                { n:1, text:'Sign up at twilio.com and get Account SID + Auth Token' },
                { n:2, text:'Enable WhatsApp Sandbox in Twilio Console → Messaging → Try WhatsApp' },
                { n:3, text:'Add credentials to backend .env file' },
                { n:4, text:'Send test message to verify connection' },
                { n:5, text:'For production: apply for WhatsApp Business API in Twilio (takes 2-3 days)' },
              ].map(s => (
                <div key={s.n} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0, marginTop:1 }}>{s.n}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', lineHeight:1.5 }}>{s.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
