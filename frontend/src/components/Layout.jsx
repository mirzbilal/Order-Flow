// Shared UI primitives — clean green/white design

// ── Topbar ───────────────────────────────────────────────────
export function Topbar({ title, subtitle, children }) {
  return (
    <div style={{
      background: '#fff', borderBottom: '1px solid #e5e7eb',
      padding: '0 24px', height: 58,
      display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Scrollable content area ───────────────────────────────────
export function Content({ children, style = {} }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', ...style }}>
      {children}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────
export function Btn({ onClick, primary, accent, danger, outline, sm, loading, disabled, children, style = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: sm ? '5px 12px' : '7px 16px',
    borderRadius: 8, fontSize: sm ? 12 : 13, fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    cursor: loading || disabled ? 'not-allowed' : 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.12s', whiteSpace: 'nowrap',
    opacity: loading || disabled ? 0.6 : 1,
    ...style,
  };
  if (primary) return <button onClick={onClick} disabled={loading || disabled} style={{ ...base, background: '#16a34a', color: '#fff', borderColor: '#16a34a', boxShadow: '0 1px 3px rgba(22,163,74,0.3)' }}>{loading ? '...' : children}</button>;
  if (danger)  return <button onClick={onClick} disabled={loading || disabled} style={{ ...base, background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}>{loading ? '...' : children}</button>;
  if (outline) return <button onClick={onClick} disabled={loading || disabled} style={{ ...base, background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}>{loading ? '...' : children}</button>;
  return <button onClick={onClick} disabled={loading || disabled} style={{ ...base, background: '#fff', color: '#374151', borderColor: '#e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>{loading ? '...' : children}</button>;
}

// ── Metric Card ───────────────────────────────────────────────
export function MetricCard({ label, value, delta, deltaUp, color = 'green', icon }) {
  const colors = {
    green: { bg: '#f0fdf4', accent: '#16a34a', text: '#15803d' },
    amber: { bg: '#fffbeb', accent: '#d97706', text: '#92400e' },
    blue:  { bg: '#eff6ff', accent: '#2563eb', text: '#1e40af' },
    red:   { bg: '#fef2f2', accent: '#dc2626', text: '#991b1b' },
    teal:  { bg: '#f0fdfa', accent: '#0d9488', text: '#115e59' },
  };
  const c = colors[color] || colors.green;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 12, padding: '18px 20px',
      transition: 'box-shadow 0.15s', cursor: 'default',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.accent, fontSize: 16 }}>{icon || '●'}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', letterSpacing: '-1px', lineHeight: 1, marginBottom: 8 }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 12, color: deltaUp ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
          {deltaUp ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ title, action, children, style = {} }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', ...style }}>
      {title && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111827' }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
export function Badge({ status }) {
  const map = {
    pending:    { bg: '#fffbeb', color: '#92400e', label: 'Pending' },
    processing: { bg: '#eff6ff', color: '#1e40af', label: 'Processing' },
    booked:     { bg: '#eff6ff', color: '#1e40af', label: 'Booked' },
    in_transit: { bg: '#f0fdfa', color: '#115e59', label: 'In Transit' },
    shipped:    { bg: '#f0fdfa', color: '#115e59', label: 'Shipped' },
    delivered:  { bg: '#f0fdf4', color: '#15803d', label: 'Delivered' },
    cancelled:  { bg: '#fef2f2', color: '#991b1b', label: 'Cancelled' },
    returned:   { bg: '#f3f4f6', color: '#374151', label: 'Returned' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.color,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, opacity: 0.7, flexShrink: 0 }}/>
      {s.label}
    </span>
  );
}

// ── Table wrapper ─────────────────────────────────────────────
export function Table({ headers, children, toolbar }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      {toolbar}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {headers.map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── Table Row ─────────────────────────────────────────────────
export function TR({ onClick, children }) {
  return (
    <tr
      onClick={onClick}
      style={{ borderBottom: '1px solid #f3f4f6', cursor: onClick ? 'pointer' : 'default', transition: 'background 0.08s' }}
      onMouseEnter={e => { if(onClick) e.currentTarget.style.background = '#f9fafb'; }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </tr>
  );
}

export function TD({ children, mono, muted, style = {} }) {
  return (
    <td style={{
      padding: '12px 16px', fontSize: 13.5,
      fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
      color: muted ? '#9ca3af' : mono ? '#2563eb' : '#111827',
      fontSize: mono ? 12.5 : 13.5,
      ...style,
    }}>
      {children}
    </td>
  );
}

// ── Stat mini card ────────────────────────────────────────────
export function StatCard({ label, value, color = '#111827' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
export function Empty({ icon = '📭', title = 'No data', desc }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9ca3af' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{title}</div>
      {desc && <div style={{ fontSize: 13 }}>{desc}</div>}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, value, onChange, placeholder, type = 'text', hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '9px 12px',
          border: '1px solid #e5e7eb', borderRadius: 8,
          fontSize: 13.5, fontFamily: "'Inter', sans-serif",
          color: '#111827', background: '#fff', outline: 'none',
          boxSizing: 'border-box', transition: 'all 0.12s',
        }}
        onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.1)'; }}
        onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
      />
      {hint && <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
