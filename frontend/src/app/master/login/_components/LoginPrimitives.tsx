'use client'

import { AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react'

export type AlertState = { msg: string; type: 'error' | 'success' }

export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return (local?.[0] ?? '') + '***@' + (domain ?? '')
}

export function Alert({ a }: { a: AlertState }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
      marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
      background: a.type === 'error' ? 'var(--red-light)' : 'var(--green-light)',
      border: a.type === 'error' ? '1px solid rgba(217,72,31,0.2)' : '1px solid rgba(47,143,91,0.2)',
      color: a.type === 'error' ? 'var(--red)' : 'var(--success)'
    }}>
      <span style={{ display: 'flex', alignItems: 'center' }}>{a.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}</span><span>{a.msg}</span>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, display: 'block', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 16, padding: 0 }}>
      <ArrowLeft size={16} /> Retour
    </button>
  )
}

export function FormHeader({ title, sub }: { title: string; sub: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h1 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', lineHeight: 1.2 }}>{title}</h1>
      <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.4 }}>{sub}</div>
    </div>
  )
}

export function SubmitBtn({ loading, onClick, children }: { loading: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width: '100%', minHeight: 48, padding: 12, background: 'var(--primary)',
      color: 'white', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 10,
      cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s',
      boxShadow: '0 4px 14px rgba(180,83,42,0.22)', marginTop: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.85 : 1
    }}
    onMouseEnter={e => !loading && (e.currentTarget.style.background = 'var(--primary-hover)')}
    onMouseLeave={e => !loading && (e.currentTarget.style.background = 'var(--primary)')}
    >
      {loading ? <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : children}
    </button>
  )
}

export const inputBaseStyle: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '12px 14px', background: 'var(--surface)',
  border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)',
  fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.2s'
}

export function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--accent)'
  e.target.style.boxShadow = '0 0 0 3px rgba(227, 176, 75, 0.2)'
}

export function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--border)'
  e.target.style.boxShadow = 'none'
}
