import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function Field({ label, value, onChange, placeholder, type='text', hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom:18 }}>
      <label className="field-label">{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        className="field-input"
        style={{ borderColor: focused?'var(--green-600)':'var(--gray-200)', boxShadow: focused?'0 0 0 3px rgba(22,163,74,0.1)':'' }}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
      />
      {hint && <div style={{ fontSize:11.5, color:'var(--gray-400)', marginTop:5 }}>{hint}</div>}
    </div>
  );
}

export default function ShopifyConnect() {
  const qc = useQueryClient();
  const [shop, setShop] = useState('');
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [method, setMethod] = useState('oauth');

  const { data: status, refetch } = useQuery({
    queryKey: ['shopify-status'],
    queryFn: () => axios.get(`${API}/api/shopify/status`).then(r=>r.data),
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: p => axios.post(`${API}/api/shopify/connect`, p).then(r=>r.data),
    onSuccess: d => { if (d.authUrl) window.location.href=d.authUrl; else { toast.success('✅ Shopify connected!'); qc.invalidateQueries({queryKey:['shopify-status']}); refetch(); } },
    onError:   e => toast.error(e.response?.data?.error || e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => axios.post(`${API}/api/shopify/disconnect`).then(r=>r.data),
    onSuccess: () => { toast.success('Disconnected'); qc.invalidateQueries({queryKey:['shopify-status']}); refetch(); },
    onError: e => toast.error(e.response?.data?.error || e.message),
  });

  const syncMutation = useMutation({
    mutationFn: () => axios.post(`${API}/api/shopify/sync`).then(r=>r.data),
    onSuccess: r => toast.success(`✅ ${r.created||0} new orders synced`),
    onError: e => toast.error(e.response?.data?.error || e.message),
  });

  const isConnected = status?.connected;

  return (
    <div className="page-shell" style={{ background:'var(--gray-50)' }}>
      <div className="breadcrumb">
        <span>Dashboard</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Shopify App</span>
      </div>

      <div className="content-scroll" style={{ maxWidth:720 }}>
        {isConnected && (
          <div style={{ background:'var(--green-50)', border:'1.5px solid var(--green-200)', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
            <div style={{ width:38, height:38, borderRadius:'50%', background:'var(--green-600)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, color:'#fff', fontWeight:700 }}>✓</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--green-800)' }}>Store Connected</div>
              <div style={{ fontSize:12.5, color:'var(--green-700)', marginTop:2 }}>{status?.shop}</div>
            </div>
            <button className="btn btn-primary btn-sm" disabled={syncMutation.isPending} onClick={()=>syncMutation.mutate()}>{syncMutation.isPending?'Syncing…':'⟳ Sync Orders'}</button>
            <button className="btn btn-danger btn-sm" onClick={()=>disconnectMutation.mutate()}>Disconnect</button>
          </div>
        )}

        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ padding:28 }}>
            <h2 style={{ fontSize:22, fontWeight:700, color:'var(--gray-900)', marginBottom:6, letterSpacing:'-0.3px' }}>Connect Your Shopify Store</h2>
            <p style={{ fontSize:13.5, color:'var(--gray-500)', marginBottom:24 }}>Enter your Shopify credentials to connect your store.</p>
            <hr style={{ border:'none', borderTop:'1px solid var(--gray-100)', marginBottom:24 }}/>

            {/* Toggle */}
            <div style={{ display:'flex', gap:0, marginBottom:22, background:'var(--gray-100)', borderRadius:8, padding:3 }}>
              {[{k:'oauth',l:'OAuth App (Recommended)'},{k:'token',l:'Access Token'}].map(m=>(
                <button key={m.k} onClick={()=>setMethod(m.k)} style={{ flex:1, padding:'7px 16px', borderRadius:6, border:'none', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)', transition:'all 0.13s', background:method===m.k?'#fff':'transparent', color:method===m.k?'var(--gray-900)':'var(--gray-400)', boxShadow:method===m.k?'var(--shadow-sm)':'none' }}>{m.l}</button>
              ))}
            </div>

            <Field label="Shop Domain" value={shop} onChange={setShop} placeholder="your-store.myshopify.com" hint="e.g. my-store.myshopify.com (no https://)" />
            {method==='oauth' ? <>
              <Field label="Client ID"     value={clientId} onChange={setClientId} placeholder="Enter your client ID" hint="Found in Shopify Partner Dashboard → Apps → Client credentials" />
              <Field label="Client Secret" value={secret}   onChange={setSecret}   placeholder="Enter your client secret" type="password" hint="Keep this secret — never share publicly" />
            </> : (
              <Field label="Access Token" value={accessToken} onChange={setAccessToken} placeholder="shpat_xxxxxxxxxxxx" type="password" hint="Shopify Admin → Apps → Develop apps → API credentials" />
            )}

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
              <span style={{ fontSize:13, fontWeight:600, color: isConnected?'var(--green-600)':'var(--red-600)', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:isConnected?'var(--green-500)':'var(--red-600)', display:'inline-block' }}/>
                {isConnected?'Connected':'Not Connected'}
              </span>
              <button className="btn btn-primary" disabled={connectMutation.isPending||isConnected} onClick={() => {
                if (!shop) return toast.error('Enter your shop domain');
                const clean = shop.replace(/https?:\/\//,'').replace(/\/$/,'');
                if (method==='oauth') { if(!clientId||!secret) return toast.error('Enter Client ID and Secret'); connectMutation.mutate({shop:clean,clientId,clientSecret:secret,method:'oauth'}); }
                else { if(!accessToken) return toast.error('Enter Access Token'); connectMutation.mutate({shop:clean,accessToken,method:'token'}); }
              }} style={{ borderRadius:50, padding:'10px 28px' }}>
                {connectMutation.isPending?'Connecting…':isConnected?'Already Connected':'Connect Store'}
              </button>
            </div>
          </div>
        </div>

        {/* Guide */}
        <div className="card">
          <div style={{ padding:24 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--gray-900)', marginBottom:16 }}>
              {method==='oauth'?'🔑 How to get Client ID & Secret':'🔑 How to get Access Token'}
            </div>
            {(method==='oauth' ? [
              {n:1,t:'Go to Shopify Partner Dashboard',d:'Visit partners.shopify.com and log in'},
              {n:2,t:'Create or open your app',d:'Click Apps → Create app → Custom app'},
              {n:3,t:'Set Redirect URL',d:`Add: ${API}/api/shopify/callback`},
              {n:4,t:'Copy credentials',d:'Copy Client ID and Client Secret'},
              {n:5,t:'Set API scopes',d:'Enable: read_orders, write_orders, write_fulfillments, read_products'},
            ]:[
              {n:1,t:'Go to Shopify Admin',d:'Visit your-store.myshopify.com/admin'},
              {n:2,t:'Open Apps section',d:'Settings → Apps and sales channels → Develop apps'},
              {n:3,t:'Create a private app',d:'Create an app → name it "OrderFlow"'},
              {n:4,t:'Configure API access',d:'Enable: read_orders, write_fulfillments, read_products'},
              {n:5,t:'Install and copy token',d:'Install app → copy Admin API access token (shpat_...)'},
            ]).map(s => (
              <div key={s.n} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:14 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--green-600)', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'var(--gray-800)' }}>{s.t}</div>
                  <div style={{ fontSize:12.5, color:'var(--gray-500)', marginTop:3 }}>{s.d}</div>
                </div>
              </div>
            ))}

            {method==='oauth' && (
              <div style={{ marginTop:16, background:'var(--gray-50)', borderRadius:8, padding:'12px 16px', border:'1px solid var(--gray-200)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Redirect URL</div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <code style={{ flex:1, fontSize:12.5, color:'var(--gray-900)', fontFamily:'var(--font-mono)' }}>{API}/api/shopify/callback</code>
                  <button className="btn btn-sm" onClick={()=>{navigator.clipboard.writeText(`${API}/api/shopify/callback`);toast.success('Copied!');}}>Copy</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
