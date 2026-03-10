import React from 'react'

// ── Button ─────────────────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md'
}
export const Btn: React.FC<BtnProps> = ({ variant = 'secondary', size = 'md', children, style, ...rest }) => {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: 'none',
    transition: 'all .15s', fontFamily: 'var(--sans)', letterSpacing: '.01em',
    padding: size === 'sm' ? '5px 10px' : '7px 14px',
    fontSize: size === 'sm' ? 11 : 12,
    opacity: rest.disabled ? 0.4 : 1,
    pointerEvents: rest.disabled ? 'none' : 'auto',
  }
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--accent)', color: '#000' },
    secondary: { background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)' },
    danger:    { background: 'transparent', color: 'var(--accent3)', border: '1px solid rgba(255,94,125,.3)' },
  }
  return <button style={{ ...base, ...variants[variant], ...style }} {...rest}>{children}</button>
}

// ── Card ───────────────────────────────────────────────────────────────────
export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; className?: string }> = ({ children, style, className }) => (
  <div className={className} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 16, ...style }}>
    {children}
  </div>
)

// ── CardTitle ──────────────────────────────────────────────────────────────
export const CardTitle: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14, ...style }}>
    {children}
  </div>
)

// ── StatCard ───────────────────────────────────────────────────────────────
export const StatCard: React.FC<{ value: React.ReactNode; label: string; color?: string }> = ({ value, label, color }) => (
  <div style={{ flex: 1, minWidth: 100, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
    <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
  </div>
)

// ── ProgressBar ────────────────────────────────────────────────────────────
export const ProgressBar: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ height: 6, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden', margin: '12px 0' }}>
    <div style={{ height: '100%', width: `${value}%`, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 4, transition: 'width .3s ease' }} />
  </div>
)

// ── Tag ────────────────────────────────────────────────────────────────────
export const Tag: React.FC<{ color?: 'green' | 'blue' | 'red' | 'yellow'; children: React.ReactNode }> = ({ color = 'green', children }) => {
  const colors: Record<string, React.CSSProperties> = {
    green:  { background: 'rgba(0,229,160,.12)',  color: 'var(--accent)' },
    blue:   { background: 'rgba(0,144,255,.12)',  color: 'var(--accent2)' },
    red:    { background: 'rgba(255,94,125,.12)', color: 'var(--accent3)' },
    yellow: { background: 'rgba(255,217,80,.12)', color: 'var(--yellow)' },
  }
  return (
    <span style={{ display: 'inline-block', fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 7px', borderRadius: 3, letterSpacing: '.05em', ...colors[color] }}>
      {children}
    </span>
  )
}

// ── StatusDot ──────────────────────────────────────────────────────────────
export const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const c: Record<string, string> = { done: '#00e5a0', running: '#0090ff', pending: '#555b6e', failed: '#ff5e7d' }
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: c[status] || c.pending, marginRight: 6, flexShrink: 0,
      animation: status === 'running' ? 'pulse 1.4s ease infinite' : 'none',
    }} />
  )
}

// ── FormGroup ──────────────────────────────────────────────────────────────
export const FormGroup: React.FC<{ label: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ label, children, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
    <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'var(--mono)' }}>{label}</label>
    {children}
  </div>
)

// ── Select / Input ─────────────────────────────────────────────────────────
const fieldStyle: React.CSSProperties = {
  background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6,
  padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--sans)',
  outline: 'none', appearance: 'none' as const, width: '100%',
}
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select style={fieldStyle} {...props} />
)
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input style={fieldStyle} {...props} />
)

// ── Divider ────────────────────────────────────────────────────────────────
export const Divider: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div style={{ height: 1, background: 'var(--border)', margin: '14px 0', ...style }} />
)

// ── EmptyState ─────────────────────────────────────────────────────────────
export const EmptyState: React.FC<{ icon: string; title: string; sub?: string }> = ({ icon, title, sub }) => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
    <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>{title}</div>
    {sub && <div style={{ fontSize: 12 }}>{sub}</div>}
  </div>
)

// ── LogBox ─────────────────────────────────────────────────────────────────
export const LogBox: React.FC<{ lines: string[]; status: string }> = ({ lines, status }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
      <StatusDot status={status} /> Training Log
    </div>
    <ProgressBar value={lines.length > 0 ? Math.min((lines.length / 10) * 100, status === 'done' ? 100 : 95) : 0} />
    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.9, maxHeight: 160, overflowY: 'auto' }}>
      {lines.map((line, i) => (
        <div key={i} style={{ color: i === lines.length - 1 ? 'var(--accent)' : 'var(--text3)' }}>
          <span style={{ color: 'var(--border2)', marginRight: 8 }}>›</span>{line}
        </div>
      ))}
    </div>
  </div>
)
