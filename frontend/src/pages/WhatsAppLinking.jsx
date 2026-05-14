// WhatsApp Linking — connect Twilio account (like Fulfillo's WhatsApp Linking page)
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function Field({ label, value, onChange, placeholder, type = 'text', hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display:'block', fontSize:14, fontWeight:600, color:'#111827', marginBottom:7 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', padding:'11px 14px', border:`1.5px solid ${focused?'#16a34a':'#E5E7EB'}`, borderRadius:10, fontSize:14,
          fontFamily:"'DM Sans',sans-serif", color:'#111827', background:'#fff', outline:'none',
          boxShadow: focused?'0 0 0 3px rgba(22,163,74,0.1)':'none', transition:'all 0.15s', boxSizing:'border-box' }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      {hint && <div style={{ fontSize:11.5, color:'#9CA3AF', marginTop:5 }}>{hint}</div>}
    </div>
  );
}

export default function WhatsAppLinking() {
  const qc = useQueryClient();
  const [sid,   setSid]   = useState('');
  const [token, setToken] = useState('');
  const [from,  setFrom]  = useState('whatsapp:+14155238886');
  const [testPhone, setTestPhone] = useState('');

  const { data: status, refetch } = useQuery({
    queryKey: ['wa-link-status'],
    queryFn:  () => axios.get(`${API}/api/whatsapp/link-status`).then(r => r.data),
    retry: false,
  });

  const linkMutation = useMutation({
    mutationFn: (p) => axios.post(`${API}/api/whatsapp/link`, p).then(r => r.data),
    onSuccess: () => { toast.success('✅ WhatsApp linked successfully!'); qc.invalidateQueries({queryKey:['wa-link-status']}); refetch(); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const testMutation = useMutation({
    mutationFn: (phone) => axios.post(`${API}/api/whatsapp/test`, { phone }).then(r => r.data),
    onSuccess: () => toast.success('✅ Test message sent!'),
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const isLinked = status?.linked;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#F3F4F6' }}>
      <div style={{ padding:'14px 28px', display:'flex', alignItems:'center', gap:8, fontSize:13.5, color:'#6B7280', background:'#F3F4F6' }}>
        <span style={{ color:'#6B7280' }}>Dashboard</span>
        <span style={{ color:'#D1D5DB' }}>/</span>
        <span style={{ color:'#111827', fontWeight:600 }}>WhatsApp Linking</span>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'0 28px 28px', display:'flex', flexDirection:'column', gap:20, alignItems:'flex-start' }}>

        {/* Connected banner */}
        {isLinked && (
          <div style={{ width:'100%', maxWidth:680, background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:28 }}>💬</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#15803D' }}>WhatsApp Linked</div>
              <div style={{ fontSize:12.5, color:'#166534', marginTop:2 }}>From: {status?.fromNumber}</div>
            </div>
            <span style={{ fontSize:11, fontWeight:700, background:'#DCFCE7', color:'#15803D', padding:'4px 12px', borderRadius:20 }}>● Active</span>
          </div>
        )}

        {/* Main card */}
        <div style={{ width:'100%', maxWidth:680, background:'#fff', border:'1px solid #E5E7EB', borderRadius:16, padding:32, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize:24, fontWeight:700, color:'#111827', marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}>
            WhatsApp Linking
          </h2>
          <p style={{ fontSize:14, color:'#6B7280', marginBottom:24 }}>
            Connect your Twilio account to send automated WhatsApp messages to customers.
          </p>
          <hr style={{ border:'none', borderTop:'1px solid #F3F4F6', marginBottom:28 }} />

          <Field label="Account SID"  value={sid}   onChange={setSid}   placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" hint="Found in your Twilio Console dashboard" />
          <Field label="Auth Token"   value={token} onChange={setToken} type="password" placeholder="Your Twilio auth token" hint="Found next to your Account SID in Twilio Console" />
          <Field label="From Number"  value={from}  onChange={setFrom}  placeholder="whatsapp:+14155238886" hint="Sandbox: whatsapp:+14155238886 | Production: whatsapp:+92xxxxxxxxxx" />

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
            <span style={{ fontSize:13.5, fontWeight:600, color: isLinked?'#16a34a':'#DC2626' }}>
              {isLinked ? '● Linked' : '● Not Linked'}
            </span>
            <button onClick={() => linkMutation.mutate({ accountSid:sid, authToken:token, fromNumber:from })}
              disabled={linkMutation.isPending || !sid || !token}
              style={{ padding:'11px 28px', borderRadius:50, border:'none', fontSize:14, fontWeight:700, background: (!sid||!token)?'#E5E7EB':'#16a34a', color: (!sid||!token)?'#9CA3AF':'#fff', cursor: (!sid||!token)?'not-allowed':'pointer', fontFamily:"'DM Sans',sans-serif", boxShadow: (sid&&token)?'0 2px 8px rgba(22,163,74,0.3)':'none', transition:'all 0.15s' }}>
              {linkMutation.isPending ? '⏳ Linking…' : isLinked ? 'Re-link Account' : 'Link Account'}
            </button>
          </div>
        </div>

        {/* Test message */}
        {isLinked && (
          <div style={{ width:'100%', maxWidth:680, background:'#fff', border:'1px solid #E5E7EB', borderRadius:16, padding:28 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>🧪 Send Test Message</div>
            <Field label="Phone Number" value={testPhone} onChange={setTestPhone} placeholder="03001234567" hint="Recipient must first send 'join <word>' to the sandbox number" />
            <button onClick={() => testMutation.mutate(testPhone)} disabled={!testPhone || testMutation.isPending}
              style={{ padding:'10px 24px', borderRadius:8, border:'none', background: testPhone?'#16a34a':'#E5E7EB', color: testPhone?'#fff':'#9CA3AF', fontSize:13, fontWeight:700, cursor: testPhone?'pointer':'not-allowed', fontFamily:"'DM Sans',sans-serif" }}>
              {testMutation.isPending ? '⏳ Sending…' : '📱 Send Test'}
            </button>
          </div>
        )}

        {/* Setup guide */}
        <div style={{ width:'100%', maxWidth:680, background:'#fff', border:'1px solid #E5E7EB', borderRadius:16, padding:28 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:20 }}>🚀 Setup Guide</div>
          {[
            { n:1, t:'Create Twilio account', d:'Go to twilio.com → sign up free. You get $15 trial credit.' },
            { n:2, t:'Enable WhatsApp Sandbox', d:'Twilio Console → Messaging → Try it out → Send a WhatsApp message' },
            { n:3, t:'Copy credentials', d:'Account SID and Auth Token are on your Twilio Console homepage' },
            { n:4, t:'Customer opt-in (Sandbox)', d:'Each customer sends "join <word>" to +1 415 523 8886 once' },
            { n:5, t:'Go live (Production)', d:'Apply for WhatsApp Business API in Twilio — takes 2-3 days approval' },
          ].map(s => (
            <div key={s.n} style={{ display:'flex', gap:14, marginBottom:14 }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:'#16a34a', color:'#fff', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{s.n}</div>
              <div>
                <div style={{ fontSize:13.5, fontWeight:600, color:'#111827' }}>{s.t}</div>
                <div style={{ fontSize:12.5, color:'#6B7280', marginTop:2 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
