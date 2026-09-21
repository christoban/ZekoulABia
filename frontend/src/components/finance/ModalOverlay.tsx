'use client'
import React from 'react'

/**
 * Overlay modal réutilisable — fond semi-transparent + carte centrée.
 * Ferme sur clic du fond.
 */
export default function ModalOverlay({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="px-4 py-4 md:px-6 md:py-5"
        style={{
          background: 'var(--surface)',
          borderRadius: 14,
          width: 440,
          maxWidth: '94vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ── Style tokens réutilisables pour les formulaires dans les modales ── */
export const sLbCls = 'text-[11px] md:text-[11.5px] mb-1'
export const sLb: React.CSSProperties = { fontWeight: 700, color: 'var(--text3)' }
export const sInCls = 'rounded-lg px-2.5 py-1.5 mb-2 text-xs md:text-[12.5px]'
export const sIn: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
  outline: 'none',
}
export const sModalTitleCls = 'text-[15px] md:text-[17px]'

export const btnPrim: React.CSSProperties = {
  padding: '6px 13px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  background: 'linear-gradient(135deg,var(--green),var(--green2))',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
export const btnCancel: React.CSSProperties = {
  flex: 1,
  padding: '7px 12px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  background: 'var(--surface)',
  color: 'var(--text2)',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
export const btnSubmit: React.CSSProperties = {
  flex: 1,
  padding: '7px 12px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  background: 'linear-gradient(135deg,var(--green),var(--green2))',
  color: 'white',
  border: 'none',
  fontFamily: 'inherit',
}

export const FEE_TYPES = ['TUITION', 'REGISTRATION', 'EXAM', 'UNIFORM', 'TRANSPORT', 'CAUTION', 'OTHER']

export function fmtCFA(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}
