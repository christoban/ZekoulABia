import type React from 'react'

export interface SchoolInfo {
  id?: string
  name: string
  logoUrl: string | null
  subdomain?: string
  city?: string
  phone?: string
  email?: string
  minesecSchoolCode?: string | null
}

export interface SectionSettingsProps {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  schoolInfo?: SchoolInfo | null
  onLogoUpdate?: (url: string) => void
}

export interface ActivityLog {
  id: string
  createdAt: string
  action: string
  description: string
  user?: { firstName?: string; lastName?: string } | null
}

export interface EmailLog {
  id: string
  createdAt: string
  to: string
  subject: string
  status: string
}

export interface AuditLog {
  id: string
  createdAt: string
  action: string
  description: string | null
  user: { id: string; firstName: string; lastName: string } | null
}

export interface AIActionAuditEntry {
  id: string
  timestamp: string
  actorUserId: string
  actorRole: string
  actionName: string
  origin: 'UI_DIRECT' | 'AI_ASSISTANT'
  outcome: 'SUCCES' | 'REFUSE' | 'ERREUR'
  refusalReason: string | null
}

export interface TimelineEntry {
  id: string
  type: string
  timestamp: string
  title: string
  details: string | null
}

export interface BackupInfo {
  lastBackupAt: string | null
  lastBackupFile: string | null
  latestFileExists?: boolean
}

export interface NotifSettings {
  smsAbsences: boolean
  smsPayments: boolean
  smsBulletins: boolean
  emailDigestAdmin: boolean
  smsLowBalance: boolean
}

export interface SecSettings {
  passwordMinLength: number
  passwordRequireUpper: boolean
  passwordRequireDigit: boolean
  sessionTimeoutMin: number
}

export interface PedSettings {
  passMark: number
  councilPassMark: number
  gradesPerTerm: number
  termsPerYear: number
  maxAbsences: number
  attendanceLateAsAbsence: boolean
  legalMaxContributionFirstCycle: number
  legalMaxContributionSecondCycle: number
  bulletinBlockOnUnpaidFees: boolean
  schoolLanguageMode: string
  academicCalendarType: string
  cycles: string[]
  smsEnabled: boolean
  offlineModeEnabled: boolean
  aiAlertsEnabled: boolean
  messageModeration: boolean
}

export interface StructConfigShape {
  niveaux1erCycle: string[]
  classesParNiveau: Record<string, number>
  niveauxPrimaire: string[]
  classesParNiveauPrimaire: Record<string, number>
}

export function isNetworkErr(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = e instanceof Error ? e.message : String(e || '')
  return msg.includes('fetch') || msg.includes('Network') || msg.includes('Failed')
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
export const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 2 }
export const btnPrimCls = 'text-xs md:text-[13px] px-3.5 py-2 md:px-4 md:py-2'
export const btnPrim: React.CSSProperties = { borderRadius: 8, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
export const btnSecCls = 'text-xs md:text-[13px] px-3 py-1.5 md:px-3.5 md:py-2'
export const btnSec: React.CSSProperties = { borderRadius: 8, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
export const cardHeaderCls = 'px-3.5 py-2.5 md:px-4 md:py-3 flex-wrap gap-2'
export const cardHeader: React.CSSProperties = { borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
export const cardTitle: React.CSSProperties = { fontWeight: 700, color: 'var(--text)' }
export const fieldLabelCls = 'text-[11px] md:text-xs'
export const fieldLabel: React.CSSProperties = { fontWeight: 700, color: 'var(--text2)', marginBottom: 4, display: 'block', letterSpacing: '0.3px', textTransform: 'uppercase' }
export const fieldInputCls = 'text-xs md:text-[13px] px-2.5 py-1.5 md:px-3 md:py-2'
export const fieldInput: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' }
export const fieldSelectCls = 'text-xs md:text-[13px] px-2.5 py-1.5 md:px-3 md:py-2'
export const fieldSelect: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }
export const thLogCls = 'text-[11px] md:text-[11.5px] px-2.5 py-2 md:px-3 md:py-2'
export const thLog: React.CSSProperties = { textAlign: 'left', fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }
export const tdLogCls = 'text-xs md:text-[12.5px] px-2.5 py-2 md:px-3 md:py-2'
export const tdLog: React.CSSProperties = { color: 'var(--text2)', border: '1px solid var(--bg2)', verticalAlign: 'top' }
