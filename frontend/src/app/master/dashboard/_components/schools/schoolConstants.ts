import type React from 'react'

export const STATUS_LABELS: Record<string, string> = {
  active:    'ACTIVE',
  pending:   'À APPROUVER',
  approved:  'APPROUVÉE',
  draft:     'INVITÉE',
  suspended: 'SUSPENDUE',
  rejected:  'REJETÉE',
}

export const PLAN_LABELS: Record<string, string> = {
  deco: 'Découverte',
  std: 'Standard',
  prem: 'Premium',
}

export const btnPrimary: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 9,
  fontSize: 13,
  fontWeight: 800,
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  minHeight: 38,
  boxShadow: '0 2px 8px rgba(142,42,58,0.18)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

export const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--text2)',
  verticalAlign: 'middle',
}
