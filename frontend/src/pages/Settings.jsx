import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Settings() {
  const navigate = useNavigate();
  const [company, setCompany]   = useState('My Store Pvt. Ltd.');
  const [currency, setCurrency] = useState('PKR — Pakistani Rupee');
  const [timezone, setTimezone] = useState('Asia/Karachi (PKT +5)');

  const { data: shopify } = useQuery({ queryKey:['shopify-status'], queryFn:()=>axios.get(`${API}/api/shopify/status`).then(r=>r.data), retry:false });
  const { data: postex  } = useQuery({ queryKey:['postex-status'],  queryFn:()=>axios.get(`${API}/api/postex/status`).then(r=>r.data),  retry:false });

  const syncMutation  = useMutation({ mutationFn:()=>axios.post(`${API}/api/shopify/sync`).then(r=>r.data), onSuccess:r=>toast.success(`✅ ${r.created||0} new orders`), onError:e=>toast.error(e.response?.data?.error||e.message) });
  const trackMutation = useMutation({ mutationFn:()=>axios.post(`${API}/api/postex/sync-tracking`).then(r=>r.data), onSuccess:r=>toast.success(`📡 ${r.updated||0} updated`), onError:e=>toast.error(e.response?.data?.error||e.message) });

  return (
    <div className="page-shell">
      <div className="topbar">
        <div className="topbar-title">Settings</div>
      </div>
      <div className="content-scroll">
        <div className="settings-grid">

          {/* Integrations */}
          <div className="setting-card">
            <div style={{ fontSize:14, fontWeight:700, color:'var(--gray-900)', marginBottom:18 }}>🔌 Integrations</div>
            {[
              { icon:'🛍', name:'Shopify',          sub: shopify?.connected ? shopify.shop : 'Not connected',        connected:shopify?.connected, path:'/shopify-connect' },
              { icon:'📦', name:'PostEx',            sub: postex?.connected  ? `Merchant: ${postex.merchantCode}` : 'Not connected', connected:postex?.connected,  path:'/postex-connect' },
              { icon:'💬', name:'WhatsApp (Twilio)', sub:'Auto order notifications', connected:false, path:'/whatsapp' },
            ].map(i=>(
              <div key={i.name} className="int-row">
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:18 }}>{i.icon}</span>
                  <div><div className="int-name">{i.name}</div><div className="int-sub">{i.sub}</div></div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span className={i.connected?'int-connected':'int-disconnected'}>{i.connected?'Connected':'Not Connected'}</span>
                  <button className="btn btn-sm" onClick={()=>navigate(i.path)}>{i.connected?'Manage →':'Connect →'}</button>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button className="btn btn-primary btn-sm" style={{ flex:1, justifyContent:'center' }} disabled={syncMutation.isPending||!shopify?.connected} onClick={()=>syncMutation.mutate()}>
                {syncMutation.isPending?'Syncing…':'⟳ Sync Shopify'}
              </button>
              <button className="btn btn-sm" style={{ flex:1, justifyContent:'center', background:postex?.connected?'var(--green-50)':'', color:postex?.connected?'var(--green-700)':'' }} disabled={trackMutation.isPending||!postex?.connected} onClick={()=>trackMutation.mutate()}>
                {trackMutation.isPending?'Syncing…':'📡 Sync Tracking'}
              </button>
            </div>
          </div>

          {/* General */}
          <div className="setting-card">
            <div style={{ fontSize:14, fontWeight:700, color:'var(--gray-900)', marginBottom:18 }}>⚙ General Settings</div>
            {[
              {label:'Company Name',    value:company,  set:setCompany,  ph:'My Store Pvt. Ltd.'},
              {label:'Default Currency',value:currency, set:setCurrency, ph:'PKR'},
              {label:'Timezone',        value:timezone, set:setTimezone, ph:'Asia/Karachi'},
            ].map(f=>(
              <div key={f.label} style={{ marginBottom:14 }}>
                <label className="field-label">{f.label}</label>
                <input className="field-input" value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                  onFocus={e=>e.target.style.borderColor='var(--green-600)'}
                  onBlur={e=>e.target.style.borderColor='var(--gray-200)'}
                />
              </div>
            ))}
            <button className="btn btn-primary btn-sm" onClick={()=>toast.success('✅ Settings saved')}>Save Changes</button>
          </div>

          {/* Scheduled Jobs */}
          <div className="setting-card">
            <div style={{ fontSize:14, fontWeight:700, color:'var(--gray-900)', marginBottom:16 }}>⏱ Scheduled Jobs</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                {name:'PostEx Tracking Sync', schedule:'Every hour'},
                {name:'Shopify Order Sync',   schedule:'Every 6 hours'},
                {name:'WhatsApp Retry',       schedule:'Every 15 min'},
              ].map(j=>(
                <div key={j.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 14px', background:'var(--gray-50)', borderRadius:8, border:'1px solid var(--gray-100)' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--gray-900)' }}>{j.name}</div>
                    <div style={{ fontSize:11.5, color:'var(--gray-400)', marginTop:1 }}>{j.schedule}</div>
                  </div>
                  <span style={{ fontSize:11.5, fontWeight:600, color:'var(--green-700)', background:'var(--green-50)', padding:'3px 10px', borderRadius:20, display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green-500)', display:'inline-block' }}/>Running
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook URLs */}
          <div className="setting-card">
            <div style={{ fontSize:14, fontWeight:700, color:'var(--gray-900)', marginBottom:6 }}>🔗 Webhook URLs</div>
            <div style={{ fontSize:12.5, color:'var(--gray-500)', marginBottom:16 }}>Register these in your dashboards for real-time updates.</div>
            {[
              {label:'Shopify Webhook', url:`${API}/api/shopify/webhook`,  note:'Register in Shopify Partner Dashboard'},
              {label:'PostEx Webhook',  url:`${API}/api/postex/webhook`,   note:'Register in PostEx Merchant Dashboard'},
            ].map(w=>(
              <div key={w.label} style={{ marginBottom:16 }}>
                <div className="field-label">{w.label}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--gray-50)', borderRadius:8, padding:'9px 12px', border:'1px solid var(--gray-200)' }}>
                  <code style={{ flex:1, fontSize:12, color:'var(--gray-900)', fontFamily:'var(--font-mono)', wordBreak:'break-all' }}>{w.url}</code>
                  <button className="btn btn-sm" onClick={()=>{navigator.clipboard.writeText(w.url);toast.success('Copied!');}}>Copy</button>
                </div>
                <div style={{ fontSize:11.5, color:'var(--gray-400)', marginTop:4 }}>{w.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
