'use client'
import { useState } from 'react'
import { X, EyeOff, Eye, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
      {children}
    </div>
  )
}

export function ModalWrap({ children, size = 'md' }: { children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const maxW = size === 'sm' ? 440 : size === 'lg' ? 660 : 480
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 16, padding: '24px 28px',
      maxWidth: maxW, width: '92%', maxHeight: '85vh', overflowY: 'auto',
      position: 'relative', animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
      border: '1px solid var(--border)'
    }}>
      {children}
    </div>
  )
}

export function ModalHeader({ title, sub, onClose, danger, icon: Icon }: { title: string; sub?: string; onClose: () => void; danger?: boolean; icon?: LucideIcon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: danger ? '#dc2626' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={18} />}{title}
        </div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{sub}</div>}
      </div>
      <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border2)', background: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16} /></button>
    </div>
  )
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, display: 'block', letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function FieldInput({ placeholder, type = 'text', value, onChange, style, autoComplete = 'off', showToggle }: { placeholder?: string; type?: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; style?: React.CSSProperties; autoComplete?: string; showToggle?: boolean }) {
  const [show, setShow] = useState(false)
  const base: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, outline: 'none', ...style }
  if (showToggle && type === 'password') {
    return (
      <div style={{ position: 'relative' }}>
        <input type={show ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={onChange} autoComplete={autoComplete}
          style={{ ...base, paddingRight: 40 }} />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a89478', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    )
  }
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange} autoComplete={autoComplete}
      style={base} />
  )
}

export function BtnPrimary({ onClick, children, disabled, type = 'button' }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, background: disabled ? '#6b7280' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: disabled ? 'none' : '0 2px 8px rgba(142,42,58,0.18)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

export function BtnSecondary({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

export function SchoolSummary({ initials: init, name, meta, danger }: { initials: string; name: string; meta: string; danger?: boolean }) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: danger ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,var(--primary),var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
        {init}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{meta}</div>
      </div>
    </div>
  )
}

export function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fef3c7', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#92400e', fontWeight: 600, lineHeight: 1.6, marginBottom: 18, display: 'flex', gap: 8 }}>
      {children}
    </div>
  )
}

export function SensitiveAuthFields({ mfaEnabled, password, onPassword, mfaCode, onMfaCode }: {
  mfaEnabled: boolean
  password: string
  onPassword: (v: string) => void
  mfaCode: string
  onMfaCode: (v: string) => void
}) {
  return (
    <div style={{ background: '#fef3c7', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, padding: '12px 14px', marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Shield size={13} /> Vérification d&apos;identité requise
      </div>
      {/* Honeypot — absorbe l'autofill Chrome/Firefox avant les vrais champs */}
      <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
      <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
      <Field label="Votre mot de passe master *">
        <FieldInput type="password" placeholder="••••••••••••" value={password} onChange={e => onPassword(e.target.value)} autoComplete="new-password" showToggle />
      </Field>
      {mfaEnabled && (
        <Field label="Code TOTP ou code de récupération *" hint="Requis car le MFA est actif">
          <FieldInput type="text" placeholder="123456" value={mfaCode} onChange={e => onMfaCode(e.target.value)}
            style={{ textAlign: 'center', fontSize: 12, fontWeight: 900, letterSpacing: 3 }} />
        </Field>
      )}
    </div>
  )
}
