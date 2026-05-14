import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard       from './pages/Dashboard';
import Orders          from './pages/Orders';
import OrderDetail     from './pages/OrderDetail';
import Shipping        from './pages/Shipping';
import Returns         from './pages/Returns';
import Settings        from './pages/Settings';
import WhatsApp        from './pages/WhatsApp';
import WhatsAppMessages from './pages/WhatsAppMessages';
import ShopifyConnect  from './pages/ShopifyConnect';
import PostexConnect   from './pages/PostexConnect';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// ── SVG icon helper ───────────────────────────────────────────
function Ico({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const icons = {
  dashboard: <Ico><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Ico>,
  orders:    <Ico><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></Ico>,
  box:       <Ico><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></Ico>,
  truck:     <Ico><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3m-9 9h6m4 0a2 2 0 100-4 2 2 0 000 4zm-10 0a2 2 0 100-4 2 2 0 000 4z"/></Ico>,
  return:    <Ico><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6"/></Ico>,
  shopify:   <Ico><path d="M15.5 5.5c0-1.1-.9-2-2-2s-2 .9-2 2M8 19l1-8h6l1 8M5 9l1.5-1.5M19 9l-1.5-1.5M12 3v2"/><path d="M6 9h12l-1 11H7L6 9z"/></Ico>,
  parcel:    <Ico><path d="M21 10V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10"/><path d="M23 3H1v7h22V3z"/><path d="M12 3v7"/></Ico>,
  whatsapp:  <Ico><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></Ico>,
  msg:       <Ico><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></Ico>,
  settings:  <Ico><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></Ico>,
};

const NAV = [
  { section: 'Menu', items: [
    { to:'/',                  label:'Dashboard',        icon:icons.dashboard, end:true },
    { to:'/orders',            label:'Orders',           icon:icons.orders,    badge:'12' },
    { to:'/inventory',         label:'Inventory',        icon:icons.box },
  ]},
  { section: 'Fulfillment', items: [
    { to:'/shipping',          label:'Shipping',         icon:icons.truck,     badge:'7' },
    { to:'/returns',           label:'Returns',          icon:icons.return },
  ]},
  { section: 'Integrations', items: [
    { to:'/shopify-connect',   label:'Shopify App',      icon:icons.shopify },
    { to:'/postex-connect',    label:'PostEx App',       icon:icons.parcel },
    { to:'/whatsapp',          label:'WhatsApp',         icon:icons.whatsapp },
    { to:'/whatsapp/messages', label:'WA Messages',      icon:icons.msg },
  ]},
  { section: 'System', items: [
    { to:'/settings',          label:'Settings',         icon:icons.settings },
  ]},
];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div style={{ display:'flex', height:'100vh', width:'100%', background:'var(--gray-50)' }}>

          {/* ── Sidebar ── */}
          <aside style={{
            width: 236, flexShrink: 0,
            background: '#ffffff',
            borderRight: '1px solid var(--gray-200)',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 0 0 1px var(--gray-100)',
          }}>
            {/* Logo */}
            <div style={{ padding:'18px 20px 16px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{
                width:36, height:36, borderRadius:10,
                background:'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0, boxShadow:'0 2px 8px rgba(22,163,74,0.28)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--gray-900)', letterSpacing:'-0.3px', lineHeight:1.2 }}>OrderFlow</div>
                <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2, fontWeight:400 }}>Management System</div>
              </div>
            </div>

            {/* Nav */}
            <nav style={{ flex:1, overflowY:'auto', padding:'10px 0' }}>
              {NAV.map(section => (
                <div key={section.section} style={{ marginBottom:2 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'var(--gray-400)', padding:'12px 20px 5px' }}>
                    {section.section}
                  </div>
                  {section.items.map(item => (
                    <NavLink key={item.to} to={item.to} end={item.end}
                      style={({ isActive }) => ({
                        display:'flex', alignItems:'center', gap:10,
                        padding:'8px 10px', margin:'1px 8px',
                        borderRadius:8, fontSize:13.5, fontWeight: isActive ? 600 : 400,
                        textDecoration:'none', transition:'all 0.12s',
                        color: isActive ? 'var(--green-700)' : 'var(--gray-600)',
                        background: isActive ? 'var(--green-50)' : 'transparent',
                        borderLeft: isActive ? '2.5px solid var(--green-600)' : '2.5px solid transparent',
                      })}
                    >
                      <span style={{ opacity: 0.8, flexShrink:0 }}>{item.icon}</span>
                      <span style={{ flex:1 }}>{item.label}</span>
                      {item.badge && (
                        <span style={{ background:'var(--green-600)', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20 }}>
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>

            {/* User */}
            <div style={{ padding:'12px 14px 16px', borderTop:'1px solid var(--gray-100)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, cursor:'pointer', transition:'background 0.12s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--gray-50)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg, #22c55e 0%, #15803d 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11.5, fontWeight:700, color:'#fff', flexShrink:0 }}>AK</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-900)' }}>Ali Khan</div>
                  <div style={{ fontSize:11, color:'var(--gray-400)' }}>Administrator</div>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Main ── */}
          <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
            <Routes>
              <Route path="/"                  element={<Dashboard />} />
              <Route path="/orders"            element={<Orders />} />
              <Route path="/orders/:id"        element={<OrderDetail />} />
              <Route path="/inventory"         element={<Placeholder title="Inventory" />} />
              <Route path="/shipping"          element={<Shipping />} />
              <Route path="/returns"           element={<Returns />} />
              <Route path="/settings"          element={<Settings />} />
              <Route path="/whatsapp"          element={<WhatsApp />} />
              <Route path="/whatsapp/messages" element={<WhatsAppMessages />} />
              <Route path="/shopify-connect"   element={<ShopifyConnect />} />
              <Route path="/postex-connect"    element={<PostexConnect />} />
              <Route path="*"                  element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>

        <Toaster position="bottom-right" toastOptions={{
          duration: 3500,
          style: { background:'var(--gray-900)', color:'#fff', fontSize:13, fontFamily:"'Inter',sans-serif", borderRadius:10, boxShadow:'0 10px 30px rgba(0,0,0,0.2)', padding:'12px 16px' },
          success: { iconTheme:{ primary:'#22c55e', secondary:'#fff' } },
          error:   { iconTheme:{ primary:'#ef4444', secondary:'#fff' } },
        }}/>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function Placeholder({ title }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:14, color:'var(--gray-400)' }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
      <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-600)' }}>{title}</div>
      <div style={{ fontSize:13, color:'var(--gray-400)' }}>Coming soon</div>
    </div>
  );
}
