'use client'
import React from 'react'

export interface AcademicSequence {
  id: string
  name: string
  type: string
  orderIndex: number
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface AcademicPeriod {
  id: string
  name: string
  type: string
  orderIndex: number
  startDate: string
  endDate: string
  isCurrent: boolean
  sequences: AcademicSequence[]
}

export interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  status: string
  periods: AcademicPeriod[]
}

export type PStatus = 'done' | 'active' | 'pending'

export interface CalSequence {
  id?: string
  name: string
  type: string
  orderIndex: number
  startDate: string
  endDate: string
}

export interface CalPeriode {
  id?: string
  name: string
  type: 'TRIMESTER' | 'SEMESTER'
  orderIndex: number
  startDate: string
  endDate: string
  sequences: CalSequence[]
}

export interface FeePlanItem {
  id: string
  name: string
  amount: number
  feeType: string
  level: string | null
  isRefundable: boolean
  dueDate: string | null
  description: string | null
  sectionId: string | null
}

export interface ReconductionRow extends FeePlanItem {
  include: boolean
  editedAmount: string
}

export type YearToastFn = (msg: string, type?: 'success' | 'error' | 'info') => void

export const STATUS_BADGE: Record<PStatus, { bg: string; color: string }> = {
  done: { bg: 'var(--green-light)', color: 'var(--green)' },
  active: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  pending: { bg: 'var(--bg2)', color: 'var(--text2)' },
}

export function getPStatus(isCurrent: boolean, startDate: string, endDate: string): PStatus {
  if (isCurrent) return 'active'
  const now = Date.now()
  if (new Date(endDate).getTime() < now) return 'done'
  return 'pending'
}

export function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function toDateInput(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

export function YearModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 18, width: 460, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}

export const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
export const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
export const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
export const btnSecSm: React.CSSProperties = { padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
export const thStyle: React.CSSProperties = { padding: '11px 20px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
export const tdStyle: React.CSSProperties = { padding: '15px 20px', fontSize: 17, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
export const sLbCls = 'text-[11.5px] md:text-[13px]'
export const sLb: React.CSSProperties = { fontWeight: 700, color: 'var(--text3)', marginBottom: 4, display: 'block' }
export const sInCls = 'rounded-[9px] px-[10px] py-[8px] mb-[8px] text-[12.5px] md:px-[12px] md:py-[9px] md:mb-[10px] md:text-[14px]'
export const sIn: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
