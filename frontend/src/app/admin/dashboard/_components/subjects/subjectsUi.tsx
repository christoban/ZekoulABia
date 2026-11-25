'use client'

import type React from 'react'

export function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="p-5 md:p-6 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)', borderRadius: 14, width: 440, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}

export const sModalTitleCls = 'text-lg font-bold font-spectral mb-3'
export const sModalTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
export const sLabelCls = 'text-xs font-bold mb-1'
export const sLabel: React.CSSProperties = { fontWeight: 700, color: 'var(--text3)' }
export const sInputCls = 'rounded-lg px-3 py-2 mb-3 text-xs md:text-sm font-nunito'
export const sInput: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
export const sError: React.CSSProperties = { background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, marginBottom: 10 }
export const btnPrim: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
export const btnSec2: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
export const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }
export const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }
export const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
