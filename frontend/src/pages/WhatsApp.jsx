import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function WhatsApp() {
  const qc = useQueryClient();
  const [testPhone, setTestPhone] = useState('');

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['wa-status'],
    queryFn:  () => axios.get(`${API}/api/whatsapp/status`).then(r => r.data),
    refetchInterval: 5000, // check every 5 seconds
  });

  const { data: qrData, refetch: refetchQr } = useQuery({
    queryKey: ['wa-qr'],
    queryFn:  () => axios.get(`${API}/api/whatsapp/qr`).then(r => r.data),
    refetchInterval: status?.isReady ? false : 8000, // refresh QR every 8s if not ready
    enabled: !status?.isReady,
  });

  const { data: stats } = useQuery({
    queryKey: ['wa-stats'],
    queryFn:  () => axios.get(`${API}/api/whatsapp/stats`).then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: logsData } = useQuery({
    queryKey: ['wa-logs'],
    queryFn:  () => axios.get(`${API}/api/whatsapp/logs`).then(r => r.data),
    refetchInterval: 15000,
  });

  const testMutation = useMutation({
    mutationFn: (phone) => axios.post(`${API}/api/whatsapp/test`, { phone }).then(r => r.data),
    onSuccess: () => toast.success('✅ Test message sent!'),
    onError:   (e) => toast.error(e.response?.data?.error || e.message),
  });

  const restartMutation = useMutation({
    mutationFn: () => axios.post(`${API}/api/whatsapp/restart`).then(r => r.data),
    onSuccess: () => { toast.success('WhatsApp restarting...'); setTimeout(() => refetchQr(), 5000); },
    onError:   (e) => toast.error(e.response?.data?.error || e.message),
  });

  const isReady = status?.isReady;

  return (
    <div className="page-shell">
      <div className="topbar">
        <div className="topbar-title">WhatsApp</div>
        <button className="btn" onClick={() => restartMutation.mutate()} disabled={restartMutation.isPending}>
          ↺ Restart
        </button>
      </div>

      <div className="content-scroll">
        {/* Stats */}
        <div className="grid-4" style={{ marginBottom:18 }}>
          <div className="metric-card">
            <div className="metric-label">Connection</div>
            <div className="metric-value" style={{ fontSize:18, color: isReady?'var(--green-600)':'var(--red-600)' }}>
              {isReady ? '● Connected' : '● Disconnected'}
            </div>
            <div className="metric-accent" style={{ background: isReady?'var(--green-500)':'var(--red-600)' }}/>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total Sent</div>
            <div className="metric-value">{stats?.total || 0}</div>
            <div className="metric-accent green"/>
          </div>
          <div className="metric-card">
            <div className="metric-label">Success</div>
            <div className="metric-value">{stats?.success || 0}</div>
            <div className="metric-accent teal"/>
          </div>
          <div className="metric-card">
            <div className="metric-label">Failed</div>
            <div className="metric-value" style={{ color:'var(--red-600)' }}>{stats?.failed || 0}</div>
            <div className="metric-accent amber"/>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:16, alignItems:'start' }}>
          {/* Left — logs */}
          <div>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>Message Logs</div>
            <div className="table-wrap">
              {(logsData?.logs || []).length === 0 ? (
                <div style={{ padding:40, textAlign:'center', color:'var(--gray-400)' }}>
                  No messages sent yet. Connect WhatsApp and send a test message.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Order</th><th>Phone</th><th>Event</th><th>Status</th><th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logsData?.logs || []).map(log => (
                      <tr key={log.id}>
                        <td className="td-mono">{log.order_id?.slice(0,8)}...</td>
                        <td className="td-muted">{log.phone}</td>
                        <td>
                          <span style={{ background:'var(--green-100)', color:'var(--green-700)', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                            {log.event}
                          </span>
                        </td>
                        <td>
                          <span style={{ background: log.status==='failed'?'var(--red-100)':'var(--green-100)', color: log.status==='failed'?'var(--red-600)':'var(--green-700)', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                            {log.status}
                          </span>
                        </td>
                        <td className="td-muted">
                          {new Date(log.sent_at).toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right — QR + test */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Connection card */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  {isReady ? '✅ WhatsApp Connected' : '📱 Scan QR to Connect'}
                </span>
              </div>
              <div className="card-body">
                {isReady ? (
                  <div style={{ textAlign:'center', padding:'20px 0' }}>
                    <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--green-700)' }}>WhatsApp is Connected!</div>
                    <div style={{ fontSize:12.5, color:'var(--gray-400)', marginTop:6 }}>
                      Messages will be sent automatically for all orders
                    </div>
                  </div>
                ) : qrData?.qrCode ? (
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:12.5, color:'var(--gray-500)', marginBottom:12 }}>
                      Open WhatsApp → Menu → Linked Devices → Link a Device → Scan this QR
                    </div>
                    <img src={qrData.qrCode} alt="WhatsApp QR Code"
                      style={{ width:'100%', maxWidth:220, borderRadius:12, border:'1px solid var(--gray-200)' }}/>
                    <div style={{ fontSize:11.5, color:'var(--gray-400)', marginTop:10 }}>
                      QR refreshes automatically every 8 seconds
                    </div>
                    <button className="btn btn-primary" style={{ marginTop:12, width:'100%', justifyContent:'center' }}
                      onClick={() => refetchQr()}>
                      ↺ Refresh QR
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign:'center', padding:'20px 0' }}>
                    <div style={{ fontSize:32, marginBottom:10 }}>⏳</div>
                    <div style={{ fontSize:13, color:'var(--gray-500)' }}>Initializing WhatsApp...</div>
                    <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:6 }}>This takes 10-15 seconds</div>
                    <button className="btn" style={{ marginTop:12 }} onClick={() => refetchQr()}>
                      Check Again
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Test message */}
            <div className="card">
              <div className="card-header"><span className="card-title">🧪 Send Test Message</span></div>
              <div className="card-body">
                <label className="field-label">Phone Number</label>
                <input className="field-input" value={testPhone} onChange={e => setTestPhone(e.target.value)}
                  placeholder="03001234567" style={{ marginBottom:12 }}
                  onFocus={e=>e.target.style.borderColor='var(--green-600)'}
                  onBlur={e=>e.target.style.borderColor='var(--gray-200)'}/>
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}
                  disabled={!testPhone || testMutation.isPending || !isReady}
                  onClick={() => testMutation.mutate(testPhone)}>
                  {testMutation.isPending ? '⏳ Sending...' : !isReady ? 'Connect WhatsApp First' : '📱 Send Test'}
                </button>
              </div>
            </div>

            {/* How it works */}
            <div style={{ background:'var(--gray-900)', borderRadius:14, padding:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#fff', marginBottom:12 }}>How it works</div>
              {[
                { n:1, t:'Scan QR above with your WhatsApp' },
                { n:2, t:'WhatsApp connects to your backend' },
                { n:3, t:'Messages send automatically for every order event' },
                { n:4, t:'Keep the Render backend running 24/7' },
              ].map(s => (
                <div key={s.n} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--green-600)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>{s.n}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', lineHeight:1.5 }}>{s.t}</div>
                </div>
              ))}
              <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(239,68,68,0.15)', borderRadius:8, fontSize:11.5, color:'#fca5a5' }}>
                ⚠️ <strong>Note:</strong> whatsapp-web.js is unofficial. WhatsApp may occasionally disconnect — just scan QR again if that happens.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
