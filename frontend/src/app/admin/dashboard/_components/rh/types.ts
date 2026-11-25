import type React from 'react'

export interface OnToast {
  (msg: string, type?: 'success' | 'error' | 'info' | 'warning'): void
}

export type EmployeeRole = 'TEACHER' | 'STAFF'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type AttendanceStatut = 'PRESENT' | 'ABSENT' | 'RETARD'
export type RhTab = 'personnel' | 'conges' | 'pointage' | 'documents'
export type RhDocType = 'attestation' | 'certificat' | 'mission'

export interface EmployeeFile {
  dateNaissance?: string | null
  gender?: string | null
  diplomes?: unknown[]
  numeroCNPS?: string | null
  typeContrat?: string | null
  dateEmbauche?: string | null
  echelonActuel?: string | null
  documentsUrls?: { type: string; label: string; url: string; uploadedAt: string }[]
  selfServiceCompletedAt?: string | null
}

export interface EmployeeItem {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  role: EmployeeRole
  fullName: string
  teacherProfile?: { specialization?: string[]; supervisedSubjectIds?: string[] } | null
  staffProfile?: { title?: string | null; sectionId?: string | null } | null
  file?: EmployeeFile | null
}

export interface EmployeeDetail {
  employee: EmployeeItem
  file: EmployeeFile | null
  careerEvents: Array<{ id: string; type: string; date: string; observation?: string | null }>
  leaveRequests: Array<{ id: string; type: string; dateDebut: string; dateFin: string; statut: LeaveStatus; motif?: string | null }>
  leaveBalance: {
    current: { soldeRestant: number; soldeInitial: number; annee: number } | null
    balances: Array<{ annee: number; soldeRestant: number; soldeInitial: number }>
  }
}

export interface LeaveRequestItem {
  id: string
  type: string
  dateDebut: string
  dateFin: string
  motif?: string | null
  statut: LeaveStatus
  user: { id: string; firstName: string; lastName: string; role: EmployeeRole }
  validator?: { id: string; firstName: string; lastName: string } | null
}

export interface AttendanceRowState {
  statut: AttendanceStatut
  note: string
}

export interface DocFormState {
  motif: string
  lieu: string
  dateDebut: string
  dateFin: string
  signataire: string
}

export const rhInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 11px',
  borderRadius: 8,
  border: '1px solid var(--border2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 12.5,
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box',
}

export const rhLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--text3)',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
}

export const rhChipStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  borderRadius: 999,
  background: bg,
  color,
  fontSize: 11,
  fontWeight: 700,
})

export function fmtRhDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString()
}

export function fmtRhDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-CM', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
