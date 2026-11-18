import type React from 'react'

export const freeSlotStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  width: '100%',
  minHeight: '60px',
  boxSizing: 'border-box',
}

export const btnPrim: React.CSSProperties = {
  padding: '9px 17px',
  borderRadius: 9,
  fontSize: 14,
  fontWeight: 800,
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

export const btnSec: React.CSSProperties = {
  padding: '9px 15px',
  borderRadius: 9,
  fontSize: 14,
  fontWeight: 700,
  background: 'var(--surface)',
  color: 'var(--text2)',
  border: '1.5px solid var(--border2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export const thSt: React.CSSProperties = {
  padding: '9px 8px',
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--text3)',
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
}

export const spinInline: React.CSSProperties = {
  display: 'inline-block',
  width: 13,
  height: 13,
  border: '2px solid rgba(255,255,255,0.4)',
  borderTopColor: 'white',
  borderRadius: '50%',
  animation: 'edu-spin 0.7s linear infinite',
  verticalAlign: 'middle',
}
