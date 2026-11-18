import type { CSSProperties } from 'react'

export const DECO_BAND: CSSProperties = {
  height: 5,
  background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 16px,var(--green) 16px,var(--green) 32px,var(--red) 32px,var(--red) 48px,#60a5fa 48px,#60a5fa 64px,#d4a843 64px,#d4a843 80px)',
  flexShrink: 0,
}

// Cards avec border-radius moderne (16px au lieu de 13px)
export const CARD: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 12,
  border: '1px solid var(--border)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
}

// Section heading helper
export const SH: CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif',
  fontSize: 30,
  fontWeight: 700,
  color: 'var(--text)',
  textAlign: 'center',
}

// shared button styles — taille ultra-dense landing page
export const btnPrimary: CSSProperties = {
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
  color: 'white',
  fontWeight: 800,
  fontSize: 13,
  padding: '9px 18px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(142,42,58,0.18)',
  fontFamily: 'inherit',
  transition: 'all 150ms',
  display: 'inline-block',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

export const btnSecondary: CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--text2)',
  fontWeight: 700,
  fontSize: 13,
  padding: '9px 18px',
  borderRadius: 8,
  border: '1.5px solid var(--border2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 150ms',
  display: 'inline-block',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}
