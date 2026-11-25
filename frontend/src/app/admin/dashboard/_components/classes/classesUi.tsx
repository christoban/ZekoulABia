'use client'
import React from 'react'

export interface ClassItem {
  id: string
  name: string
  level: string | null
  filiere: string | null
  serie: string | null
  capacity: number
  pebsBadge?: string | null
  professorPrincipal: { id: string; firstName: string; lastName: string } | null
  _count: { students: number }
}

export interface SchoolInfo {
  id: string
  subsystem: string
  hasPEBSFrancophone: boolean
  hasPEBSAnglophone: boolean
}

export interface SubjectItem {
  id: string
  name: string
}

export interface ClassTarget {
  id: string
  name: string
}

export type ToastFn = (msg: string, type?: 'success' | 'error' | 'info') => void

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export const SECOND_CYCLE_SERIES_VALUES = [
  'A4-Allemand', 'A4-Arabe', 'A4-Chinois', 'A4-Espagnol', 'A', 'C', 'D', 'TI',
] as const

export const FILIERE_VALUES = ['Scientifique', 'Littéraire', 'Technique'] as const

export function getCollegeFiliereOptions(
  college: boolean,
  schoolInfo: SchoolInfo | null,
  t: TranslateFn,
): { value: string; label: string }[] {
  if (!college || !schoolInfo) return []
  const isFR = schoolInfo.subsystem === 'FRANCOPHONE'
  const opts: { value: string; label: string }[] = isFR
    ? [{ value: 'FR_GENERAL', label: t('classes.filiere_labels.FR_GENERAL') }]
    : [{ value: 'EN_GENERAL', label: t('classes.filiere_labels.EN_GENERAL') }]
  if (isFR && schoolInfo.hasPEBSFrancophone) {
    opts.push({ value: 'FR_PEBS', label: t('classes.filiere_labels.FR_PEBS') })
  }
  if (!isFR && schoolInfo.hasPEBSAnglophone) {
    opts.push({ value: 'EN_PEBS', label: t('classes.filiere_labels.EN_PEBS') })
  }
  return opts
}

export function getLevelBadge(name: string, t: TranslateFn): { bg: string; color: string; label: string } {
  const u = name.toUpperCase()
  if (u.startsWith('6') || u.startsWith('5') || u.startsWith('4')) {
    return { bg: 'var(--blue-light)', color: 'var(--blue)', label: t('classes.level_badges.college') }
  }
  if (u.startsWith('3')) {
    return { bg: 'var(--purple-light)', color: 'var(--purple)', label: t('classes.level_badges.bepc') }
  }
  if (u.startsWith('2NDE') || u.startsWith('2')) {
    return { bg: 'var(--orange-light)', color: 'var(--orange)', label: t('classes.level_badges.lycee') }
  }
  if (u.startsWith('1')) {
    return { bg: 'var(--orange-light)', color: 'var(--orange)', label: t('classes.level_badges.lycee') }
  }
  if (u.startsWith('TLE') || u.startsWith('T ') || u.startsWith('T.')) {
    return { bg: 'var(--red-light)', color: 'var(--red)', label: t('classes.level_badges.bac') }
  }
  return { bg: 'var(--bg2)', color: 'var(--text2)', label: name.split(' ')[0] ?? '' }
}

export function ClassModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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
export const btnSecSm: React.CSSProperties = { padding: '5.5px 11px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
export const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }
