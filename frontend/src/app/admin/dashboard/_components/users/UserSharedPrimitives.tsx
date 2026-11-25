'use client'

import type React from 'react'
import { useState } from 'react'
import { useT } from '@/lib/i18n'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] md:text-[14px] mb-[4px] md:mb-[6px]" style={{ fontWeight: 700, color: 'var(--text2)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export function PasswordOnceNotice({ password, onClose }: { password: string; onClose: () => void }) {
  const t = useT('admin')
  const [copied, setCopied] = useState(false)

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard indisponible (non-HTTPS) : le texte reste sélectionnable manuellement.
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '10px 12px', background: 'var(--red-light)', borderRadius: 10, border: '1px solid rgba(220,38,38,0.2)', fontSize: 12.5, fontWeight: 700, color: 'var(--red)' }}>
        {t('users.test_mode_password.title')}
        <div style={{ fontWeight: 500, color: 'var(--text2)', marginTop: 2 }}>{t('users.test_mode_password.hint')}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code style={{ flex: 1, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'monospace', fontSize: 14, fontWeight: 700, letterSpacing: 0.5, userSelect: 'all', color: 'var(--text)' }}>{password}</code>
        <button onClick={copier} style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
          {copied ? t('users.test_mode_password.copied') : t('users.test_mode_password.copy')}
        </button>
      </div>
      <button onClick={onClose} style={{ padding: '10px', borderRadius: 9, border: 'none', background: 'var(--bg2)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        {t('users.test_mode_password.close')}
      </button>
    </div>
  )
}

export const badge = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2.5px 8.5px',
  borderRadius: 14,
  fontSize: 11,
  fontWeight: 700,
  background: bg,
  color,
  whiteSpace: 'nowrap',
})

export const inputStCls = 'rounded-[9px] px-[10px] py-[7.5px] text-[12.5px] md:px-[11px] md:py-[8px] md:text-[13px]'
export const inputSt: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid var(--border)',
  fontFamily: 'inherit',
  color: 'var(--text)',
  background: 'var(--bg)',
  outline: 'none',
  boxSizing: 'border-box',
}

export const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
export const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 2 }
export const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
export const btnSecSm: React.CSSProperties = { padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
export const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
export const tdStyle: React.CSSProperties = { padding: '9px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
export const sLb: React.CSSProperties = { fontWeight: 700, color: 'var(--text3)' }
export const sLbCls = 'text-[12px] md:text-[13px] mb-[4px] md:mb-[6px]'
export const sIn: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
export const sInCls = 'rounded-[9px] px-[10px] py-[7.5px] mb-[8px] text-[12.5px] md:px-[11px] md:py-[8px] md:mb-[10px] md:text-[13px]'
export const sErr: React.CSSProperties = { background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }
