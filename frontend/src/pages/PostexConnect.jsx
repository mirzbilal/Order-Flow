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

export default function PostexConnect() {
  const qc = useQueryClient();
  const [token, setToken] = useState('');
  const [merchantCode, setMerchantCode] = useState('');
  const [pickupCode, setPickupCode] = useState('');

  const { data: status, refetch } = useQuery({
    queryKey: ['postex-status'],
    queryFn: () => axios.get(`${API}/api/postex/status`).then(r=>r.data),
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: p => axios.post(`${API}/api/postex/connect`, p).then(r=>r.data),
    onSuccess: d => { toast.success(`✅ PostEx connected! ${d.citiesCount} cities available`); qc.invalidateQueries({queryKey:['postex-status']}); refetch(); },
    onError:   e => toast.error(e.response?.data?.error || e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => axios.post(`${API}/api/postex/disconnect`).then(r=>r.data),
    onSuccess: () => { toast.success('PostEx disconnected'); qc.invalidateQueries({queryKey:['postex-status']}); refetch(); },
    onError: e => toast.error(e.response?.data?.error || e.message),
  });

  const testMutation = useMutation({
    mutationFn: () => axios.post(`${API}/api/postex/test`).then(r=>r.data),
    onSuccess: r => toast.success(`✅ PostEx working! ${r.cities} operational cities`),
    onError:   e => toast.error(e.response?.data?.error || e.message),
  });

  const isConnected = status?.connected;

  return (
    <div className="page-shell" style={{ background:'var(--gray-50)' }}>
      <div className="breadcrumb">
        <span>Dashboard</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">PostEx App</span>
      </div>

      <div className="content-scroll" style={{ maxWidth:720 }}>
        {isConnected && (
          <div style={{ background:'var(--green-50)', border:'1.5px solid var(--green-200)', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
            <div style={{ width:38, height:38, borderRadius:'50%', background:'var(--green-600)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>📦</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--green-800)' }}>PostEx Connected</div>
              <div style={{ fontSize:12.5, color:'var(--green-700)', marginTop:2 }}>Merchant: {status?.merchantCode}</div>
            </div>
            <button className="btn btn-primary btn-sm" disabled={testMutation.isPending} onClick={()=>testMutation.mutate()}>{testMutation.isPending?'Testing…':'✓ Test API'}</button>
            <button className="btn btn-danger btn-sm" onClick={()=>disconnectMutation.mutate()}>Disconnect</button>
          </div>
        )}

        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ padding:28 }}>
            <h2 style={{ fontSize:22, fontWeight:700, color:'var(--gray-900)', marginBottom:6, letterSpacing:'-0.3px' }}>Connect Your PostEx Account</h2>
            <p style={{ fontSize:13.5, color:'var(--gray-500)', marginBottom:24 }}>Enter your PostEx merchant credentials to enable shipment booking and tracking.</p>
            <hr style={{ border:'none', borderTop:'1px solid var(--gray-100)', marginBottom:24 }}/>

            <Field label="API Token"           value={token}        onChange={setToken}        placeholder="Enter your PostEx API token"  type="password" hint="Provided by PostEx when you register as a merchant" />
            <Field label="Merchant Code"        value={merchantCode} onChange={setMerchantCode} placeholder="e.g. MC-12345"                hint="Your unique PostEx merchant identifier" />
            <Field label="Pickup Address Code"  value={pickupCode}   onChange={setPickupCode}   placeholder="e.g. PAC-001"                 hint="The address code for parcel pickup" />

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
              <span style={{ fontSize:13, fontWeight:600, color: isConnected?'var(--green-600)':'var(--red-600)', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:isConnected?'var(--green-500)':'var(--red-600)', display:'inline-block' }}/>
                {isConnected?'Connected':'Not Connected'}
              </span>
              <button className="btn btn-primary" disabled={connectMutation.isPending||isConnected} onClick={() => {
                if (!token) return toast.error('Enter your API Token');
                if (!merchantCode) return toast.error('Enter Merchant Code');
                if (!pickupCode) return toast.error('Enter Pickup Address Code');
                connectMutation.mutate({ token, merchantCode, pickupAddressCode: pickupCode });
              }} style={{ borderRadius:50, padding:'10px 28px' }}>
                {connectMutation.isPending?'Connecting…':isConnected?'Already Connected':'Connect PostEx'}
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ padding:24 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>🔑 How to Get Your Credentials</div>
            {[
              {n:1,t:'Register as a PostEx Merchant',    d:'Visit postex.pk or contact PostEx sales team'},
              {n:2,t:'Request API Access',               d:'Email support@postex.pk to request API credentials'},
              {n:3,t:'Get your API Token',               d:'PostEx provides a unique API token for authentication'},
              {n:4,t:'Get Merchant Code',                d:'Visible in your PostEx dashboard under Account Settings'},
              {n:5,t:'Get Pickup Address Code',          d:'Add pickup address in dashboard — each gets a unique code'},
            ].map(s => (
              <div key={s.n} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:13 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--green-600)', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'var(--gray-800)' }}>{s.t}</div>
                  <div style={{ fontSize:12.5, color:'var(--gray-500)', marginTop:3 }}>{s.d}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop:16, background:'var(--green-50)', border:'1px solid var(--green-200)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:18 }}>📞</span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--green-800)' }}>Need help?</div>
                <div style={{ fontSize:12, color:'var(--green-700)', marginTop:2 }}>Email: <strong>support@postex.pk</strong></div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ padding:24 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>📋 What This Enables</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                {icon:'📦',t:'Create Shipments',   d:'Book parcels from your order dashboard'},
                {icon:'🖨', t:'Print Labels',       d:'Generate PostEx shipping labels as PDF'},
                {icon:'📡',t:'Live Tracking',      d:'Auto-sync tracking status every hour'},
                {icon:'🔔',t:'Webhook Updates',    d:'Real-time delivery status updates'},
                {icon:'❌',t:'Cancel Shipments',   d:'Cancel bookings directly from the app'},
                {icon:'💰',t:'COD Reconciliation', d:'Track COD collection status per order'},
              ].map(f => (
                <div key={f.t} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', background:'var(--gray-50)', borderRadius:8, border:'1px solid var(--gray-100)' }}>
                  <span style={{ fontSize:18, lineHeight:1 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)' }}>{f.t}</div>
                    <div style={{ fontSize:11.5, color:'var(--gray-400)', marginTop:2 }}>{f.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
