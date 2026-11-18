import type React from 'react'

export interface AcademicEvent {
  id: string
  type: string
  category: 'FIXED_DATE' | 'MANUAL_TRIGGER' | 'SLIDING_WINDOW'
  title: string
  description: string | null
  targetRoles: string[]
  openDate: string | null
  closeDate: string | null
  status: 'UPCOMING' | 'ACTIVE' | 'CLOSED'
  entranceExamSessionId?: string | null
  createdBy?: { firstName: string; lastName: string }
}

export const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  UPCOMING: { bg: 'var(--blue-light)', color: 'var(--blue)' },
  ACTIVE: { bg: 'var(--green-light)', color: 'var(--green)' },
  CLOSED: { bg: 'var(--bg2)', color: 'var(--text3)' },
}

export const CATEGORY_COLOR: Record<string, { bg: string; color: string }> = {
  FIXED_DATE: { bg: 'var(--purple-light)', color: 'var(--purple)' },
  MANUAL_TRIGGER: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  SLIDING_WINDOW: { bg: 'var(--primary-light)', color: 'var(--primary)' },
}

export const sTitle: React.CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif',
  fontWeight: 700,
  color: 'var(--text)',
}

export const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 2 }

export const btnPrim: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
}

export const btnSec: React.CSSProperties = {
  padding: '5px 11px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--surface)',
  color: 'var(--text2)',
  border: '1.5px solid var(--border2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export const btnRetry: React.CSSProperties = {
  padding: '5px 11px',
  borderRadius: 7,
  background: 'var(--surface)',
  color: 'var(--red)',
  border: '1.5px solid rgba(220,38,38,0.3)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 12,
}

export const inputSt: React.CSSProperties = {
  padding: '5px 9px',
  borderRadius: 7,
  border: '1.5px solid var(--border2)',
  fontSize: 12,
  fontFamily: 'inherit',
  color: 'var(--text)',
  background: 'var(--bg2)',
  outline: 'none',
}
