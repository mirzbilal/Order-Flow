import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ── Message Tags (dynamic placeholders) ──────────────────────
const MESSAGE_TAGS = [
  { label: 'User Name',     tag: '[User Name]' },
  { label: 'Order Number',  tag: '[Order No.]' },
  { label: 'Order Id',      tag: '[Order ID]' },
  { label: 'Products',      tag: '[Products]' },
  { label: 'Amount',        tag: '[Amount]' },
  { label: 'Address',       tag: '[Address]' },
  { label: 'City',          tag: '[City]' },
  { label: 'Phone',         tag: '[Phone]' },
  { label: 'Tracking No.',  tag: '[Tracking No.]' },
  { label: 'Payment Method',tag: '[Payment Method]' },
  { label: 'Store Name',    tag: '[Store Name]' },
  { label: 'Delivery Date', tag: '[Delivery Date]' },
];

// ── Webhook type options (matching Fulfillo) ──────────────────
const WEBHOOK_TYPES = [
  { value: '',                          label: 'Select Type' },
  { value: 'orders/creation',          label: 'orders / creation' },
  { value: 'orders/fulfillment',       label: 'orders / fulfillment' },
  { value: 'orders/cancellation',      label: 'orders / cancellation' },
  { value: 'abandoned_checkout',       label: 'Abandoned Checkout & Draft Order' },
];

// ── Replace tags with sample values for preview ───────────────
function renderPreview(message) {
  return message
    .replace(/\[User Name\]/g,     'Sara Ahmed')
    .replace(/\[Order No\.\]/g,    '#1001')
    .replace(/\[Order ID\]/g,      'ORD-2847')
    .replace(/\[Products\]/g,      'Wireless Earbuds Pro x1')
    .replace(/\[Amount\]/g,        'PKR 14,200')
    .replace(/\[Address\]/g,       '45 Garden Road, Karachi')
    .replace(/\[City\]/g,          'Karachi')
    .replace(/\[Phone\]/g,         '0312-1234567')
    .replace(/\[Tracking No\.\]/g, 'TCS-887234')
    .replace(/\[Payment Method\]/g,'COD')
    .replace(/\[Store Name\]/g,    'My Store')
    .replace(/\[Delivery Date\]/g, '15 May 2026');
}

// ── Highlight tags in textarea display ───────────────────────
function highlightTags(text) {
  return text.replace(/\[[^\]]+\]/g, match =>
    `<span style="background:#E8EEFB;color:#1A4FBF;border-radius:4px;padding:1px 3px;font-weight:600">${match}</span>`
  );
}

export default function WhatsAppMessages() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Form state
  const [webhookType, setWebhookType] = useState('');
  const [message,     setMessage]     = useState('');
  const [showDropdown,setShowDropdown]= useState(false);

  // Messages list
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['whatsapp-messages'],
    queryFn: () => axios.get(`${API}/api/whatsapp/messages`).then(r => r.data),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => axios.post(`${API}/api/whatsapp/messages`, payload).then(r => r.data),
    onSuccess: () => {
      toast.success('✅ Webhook message created!');
      qc.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      setWebhookType(''); setMessage('');
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/api/whatsapp/messages/${id}`).then(r => r.data),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['whatsapp-messages'] }); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => axios.patch(`${API}/api/whatsapp/messages/${id}`, { active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp-messages'] }),
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  // Insert tag at cursor position
  const insertTag = (tag) => {
    const ta = document.getElementById('msg-textarea');
    if (!ta) { setMessage(m => m + tag); return; }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const newVal = message.slice(0, start) + tag + message.slice(end);
    setMessage(newVal);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + tag.length; ta.focus(); }, 0);
  };

  const messages = messagesData?.messages || [];
  const preview  = message ? renderPreview(message) : '';

  const WEBHOOK_LABEL = {
    'orders/creation':    { label:'Order Created',      color:'#1A4FBF', bg:'#E8EEFB' },
    'orders/fulfillment': { label:'Order Fulfilled',    color:'#0A5C55', bg:'#E2F3F1' },
    'orders/cancellation':{ label:'Order Cancelled',    color:'#A3200D', bg:'#FAEAE7' },
    'abandoned_checkout': { label:'Abandoned Checkout', color:'#92500A', bg:'#FDF0E0' },
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#F3F4F6' }}>

      {/* Breadcrumb topbar */}
      <div style={{ background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', padding:'0 24px', height:50, display:'flex', alignItems:'center', gap:8, flexShrink:0, fontSize:13.5 }}>
        <span style={{ color:'#6B7280', cursor:'pointer' }} onClick={() => navigate('/whatsapp')}>Dashboard</span>
        <span style={{ color:'#D1D5DB' }}>/</span>
        <span style={{ color:'#0D0D0B', fontWeight:600 }}>Create Message</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={() => navigate('/whatsapp')} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif", color:'#6B7280' }}>
            ← All Messages
          </button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20, maxWidth:1100, alignItems:'start' }}>

          {/* ── Left: Form ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Basic Information card */}
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:28 }}>
              <h2 style={{ fontSize:17, fontWeight:700, color:'#0D0D0B', marginBottom:24 }}>Basic Information</h2>

              {/* Webhook Type */}
              <div style={{ marginBottom:24 }}>
                <label style={{ display:'block', fontSize:13.5, fontWeight:600, color:'#374151', marginBottom:8 }}>
                  Webhook Type
                </label>
                <div style={{ position:'relative' }}>
                  <select
                    value={webhookType}
                    onChange={e => setWebhookType(e.target.value)}
                    style={{
                      width:'100%', padding:'11px 14px',
                      border:`1.5px solid ${webhookType ? 'var(--green-600)' : '#E5E7EB'}`,
                      borderRadius:10, fontSize:14,
                      fontFamily:"'Inter',sans-serif",
                      color: webhookType ? '#0D0D0B' : '#9CA3AF',
                      background:'#fff', outline:'none', cursor:'pointer',
                      appearance:'none',
                      boxShadow: webhookType ? '0 0 0 3px rgba(22,163,74,0.1)' : 'none',
                      transition:'all 0.15s',
                    }}
                  >
                    {WEBHOOK_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#9CA3AF', fontSize:12 }}>▼</span>
                </div>
              </div>

              {/* Message textarea */}
              <div style={{ marginBottom:8 }}>
                <label style={{ display:'block', fontSize:13.5, fontWeight:600, color:'#374151', marginBottom:8 }}>
                  Message
                </label>
                <textarea
                  id="msg-textarea"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Write your WhatsApp message here. Click tags below to insert dynamic fields..."
                  rows={8}
                  style={{
                    width:'100%', padding:'12px 14px',
                    border:'1.5px solid #E5E7EB', borderRadius:10,
                    fontSize:13.5, fontFamily:"'Inter',sans-serif",
                    color:'#0D0D0B', background:'#fff', outline:'none',
                    resize:'vertical', lineHeight:1.7,
                    boxSizing:'border-box', transition:'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--green-600)'}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                />
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, color:'#9CA3AF', marginTop:5 }}>
                  <span>Tip: Click any tag below to insert it at cursor position</span>
                  <span>{message.length} chars</span>
                </div>
              </div>

              {/* Action buttons — matching Fulfillo */}
              <div style={{ display:'flex', gap:12, marginTop:24 }}>
                <button
                  onClick={() => { setWebhookType(''); setMessage(''); }}
                  style={{ padding:'10px 28px', borderRadius:8, border:'none', background:'#EF4444', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!webhookType) return toast.error('Select a Webhook Type');
                    if (!message.trim()) return toast.error('Write a message');
                    createMutation.mutate({ webhookType, message });
                  }}
                  disabled={createMutation.isPending}
                  style={{ padding:'10px 28px', borderRadius:8, border:'none', background: 'var(--green-600)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif", opacity: createMutation.isPending ? 0.7 : 1 }}
                >
                  {createMutation.isPending ? '⏳ Creating…' : 'Create Webhook'}
                </button>
              </div>
            </div>

            {/* Message Tags card */}
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'18px 24px 14px', borderBottom:'1px solid #F3F4F6' }}>
                <div style={{ fontSize:16, fontWeight:700, color:'#0D0D0B' }}>Message Tags</div>
                <div style={{ fontSize:12.5, color:'#9CA3AF', marginTop:3 }}>Click a tag to insert it into your message</div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <tbody>
                  {MESSAGE_TAGS.map((tag, i) => (
                    <tr key={tag.tag}
                      onClick={() => insertTag(tag.tag)}
                      style={{ borderBottom:'1px solid #F9FAFB', cursor:'pointer', transition:'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <td style={{ padding:'14px 24px', fontSize:14, fontWeight:500, color:'#374151' }}>
                        {tag.label}
                      </td>
                      <td style={{ padding:'14px 24px', textAlign:'right' }}>
                        <span style={{ fontSize:13.5, color:'#1A4FBF', fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>
                          {tag.tag}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Right: Preview ── */}
          <div style={{ position:'sticky', top:24, display:'flex', flexDirection:'column', gap:16 }}>

            {/* WhatsApp Preview */}
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #F3F4F6', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'#25D366', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>💬</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>Preview</div>
                  <div style={{ fontSize:11, color:'#9CA3AF' }}>How it looks to customer</div>
                </div>
              </div>

              {/* WhatsApp chat bubble */}
              <div style={{ padding:20, background:'#ECE5DD', minHeight:180 }}>
                {message ? (
                  <div style={{ maxWidth:'85%' }}>
                    <div style={{ background:'#fff', borderRadius:'0 12px 12px 12px', padding:'10px 14px', boxShadow:'0 1px 2px rgba(0,0,0,0.13)', fontSize:13.5, lineHeight:1.7, color:'#111', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                      {preview}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4, paddingLeft:4 }}>
                      <span style={{ fontSize:10.5, color:'#667781' }}>
                        {new Date().toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'})}
                      </span>
                      <span style={{ fontSize:13, color:'#53bdeb' }}>✓✓</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:140 }}>
                    <div style={{ textAlign:'center', color:'#9CA3AF' }}>
                      <div style={{ fontSize:28, marginBottom:8 }}>💬</div>
                      <div style={{ fontSize:13 }}>Your message will appear here...</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tag replacements reference */}
              {message && message.includes('[') && (
                <div style={{ padding:'12px 16px', background:'#F0FDF4', borderTop:'1px solid #BBF7D0' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--green-700)', marginBottom:6 }}>TAGS IN THIS MESSAGE</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {MESSAGE_TAGS.filter(t => message.includes(t.tag)).map(t => (
                      <span key={t.tag} style={{ fontSize:11, background:'var(--green-100)', color:'var(--green-700)', padding:'2px 8px', borderRadius:20, fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>
                        {t.tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Webhook type info */}
            {webhookType && WEBHOOK_LABEL[webhookType] && (
              <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>SELECTED TRIGGER</div>
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:WEBHOOK_LABEL[webhookType].bg, color:WEBHOOK_LABEL[webhookType].color, padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:700 }}>
                  {webhookType === 'orders/creation'     && '✅'}
                  {webhookType === 'orders/fulfillment'  && '🚚'}
                  {webhookType === 'orders/cancellation' && '❌'}
                  {webhookType === 'abandoned_checkout'  && '🛒'}
                  {WEBHOOK_LABEL[webhookType].label}
                </div>
                <div style={{ fontSize:12, color:'#9CA3AF', marginTop:8, lineHeight:1.5 }}>
                  This message will be sent automatically when the selected event occurs in Shopify.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── All Messages list ── */}
        {messages.length > 0 && (
          <div style={{ marginTop:24, maxWidth:1100 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#0D0D0B', marginBottom:14 }}>All Messages</div>
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#F9FAFB' }}>
                    {['Webhook Type','Message Preview','Status','Actions'].map(h => (
                      <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid #F3F4F6' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {messages.map(msg => {
                    const wl = WEBHOOK_LABEL[msg.webhook_type] || { label: msg.webhook_type, color:'#6B7280', bg:'#F3F4F6' };
                    return (
                      <tr key={msg.id} style={{ borderBottom:'1px solid #F9FAFB' }}>
                        <td style={{ padding:'14px 16px' }}>
                          <span style={{ background:wl.bg, color:wl.color, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                            {wl.label}
                          </span>
                        </td>
                        <td style={{ padding:'14px 16px', fontSize:13, color:'#374151', maxWidth:400 }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {msg.message}
                          </div>
                        </td>
                        <td style={{ padding:'14px 16px' }}>
                          <button
                            onClick={() => toggleMutation.mutate({ id: msg.id, active: !msg.active })}
                            style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:20, border:'none', background: msg.active ? 'var(--green-100)' : '#F3F4F6', color: msg.active ? 'var(--green-700)' : '#9CA3AF', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}
                          >
                            <span style={{ width:7, height:7, borderRadius:'50%', background: msg.active ? 'var(--green-600)' : '#9CA3AF', display:'inline-block' }}/>
                            {msg.active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ padding:'14px 16px' }}>
                          <button
                            onClick={() => { if (window.confirm('Delete this message?')) deleteMutation.mutate(msg.id); }}
                            style={{ padding:'5px 12px', borderRadius:7, border:'1px solid #FCA5A5', background:'#FEF2F2', color:'#DC2626', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && messages.length === 0 && (
          <div style={{ marginTop:24, maxWidth:1100, background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:'48px 24px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>💬</div>
            <div style={{ fontSize:15, fontWeight:700, color:'#0D0D0B', marginBottom:6 }}>No messages yet</div>
            <div style={{ fontSize:13.5, color:'#9CA3AF' }}>Create your first automated WhatsApp message above</div>
          </div>
        )}
      </div>
    </div>
  );
}
