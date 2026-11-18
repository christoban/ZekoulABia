import type React from 'react'
import type { FinancePayment } from '@/features/finance/financeShared'

export function getInvoicePaidAmount(payments: FinancePayment[]): number {
  return payments
    .filter(p => p.status === 'COMPLETED' || p.status === 'SUCCESS' || p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0)
}

export function getInvoiceStatusTranslationKey(status: string): string {
  if (status === 'PENDING') return 'finance.statusUnpaid'
  if (status === 'PARTIAL') return 'finance.statusPartial'
  if (status === 'PAID') return 'finance.statusPaid'
  if (status === 'OVERDUE') return 'finance.statusOverdue'
  return 'finance.statusCancelled'
}

export const sTitle: React.CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif',
  fontSize: 17,
  fontWeight: 700,
  color: 'var(--text)',
}

export const sSub: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text3)',
  marginTop: 2,
}

export const btnPrim: React.CSSProperties = {
  padding: '6px 13px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export const btnSec: React.CSSProperties = {
  padding: '5px 11px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--surface)',
  color: 'var(--text2)',
  border: '1px solid var(--border2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export const btnSecSm: React.CSSProperties = {
  padding: '4px 9px',
  borderRadius: 7,
  fontSize: 11.5,
  fontWeight: 700,
  background: 'var(--surface)',
  color: 'var(--text2)',
  border: '1px solid var(--border2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export const filterSt: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border2)',
  borderRadius: 8,
  padding: '5px 9px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text2)',
  outline: 'none',
  fontFamily: 'inherit',
}

export const thSt: React.CSSProperties = {
  padding: '7px 11px',
  textAlign: 'left',
  fontSize: 10.5,
  fontWeight: 800,
  color: 'var(--text3)',
  background: 'var(--bg2)',
  borderBottom: '1px solid var(--border)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
}

export const tdSt: React.CSSProperties = {
  padding: '8px 11px',
  fontSize: 12.5,
  color: 'var(--text2)',
  borderBottom: '1px solid var(--bg)',
  verticalAlign: 'middle',
}

export const fLb: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text2)',
  marginBottom: 3,
  display: 'block',
  letterSpacing: '0.4px',
  textTransform: 'uppercase',
}

export const fIn: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--bg2)',
  border: '1.5px solid var(--border2)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12.5,
  fontFamily: 'inherit',
  fontWeight: 600,
  outline: 'none',
  transition: 'all 0.15s',
  boxSizing: 'border-box',
}
