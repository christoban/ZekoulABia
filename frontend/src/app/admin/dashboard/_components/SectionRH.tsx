'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { Users, Palmtree, CheckCircle2, FileText, AlertTriangle } from 'lucide-react'
import SectionStaffAttendanceAVerifier from './SectionStaffAttendanceAVerifier'

interface OnToast { (msg: string, type?: 'success' | 'error' | 'info' | 'warning'): void }

type EmployeeRole = 'TEACHER' | 'STAFF'
type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
type AttendanceStatut = 'PRESENT' | 'ABSENT' | 'RETARD'

interface EmployeeFile {
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

interface EmployeeItem {
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

interface EmployeeDetail {
  employee: EmployeeItem
  file: EmployeeFile | null
  careerEvents: Array<{ id: string; type: string; date: string; observation?: string | null }>
  leaveRequests: Array<{ id: string; type: string; dateDebut: string; dateFin: string; statut: LeaveStatus; motif?: string | null }>
  leaveBalance: { current: { soldeRestant: number; soldeInitial: number; annee: number } | null; balances: Array<{ annee: number; soldeRestant: number; soldeInitial: number }> }
}

interface LeaveRequestItem {
  id: string
  type: string
  dateDebut: string
  dateFin: string
  motif?: string | null
  statut: LeaveStatus
  user: { id: string; firstName: string; lastName: string; role: EmployeeRole }
  validator?: { id: string; firstName: string; lastName: string } | null
}

interface AttendanceItem {
  id: string
  userId: string
  statut: AttendanceStatut
  note?: string | null
  user: { id: string; firstName: string; lastName: string; role: EmployeeRole }
}

type Tab = 'personnel' | 'conges' | 'pointage' | 'documents'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 11px',
  borderRadius: 11,
  border: '1.5px solid var(--border2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--text3)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const chipStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 10,
  background: bg,
  color,
  fontSize: 12,
  fontWeight: 800,
})

const TABS: Array<{ key: Tab; icon: React.ReactNode }> = [
  { key: 'personnel', icon: <Users size={15} strokeWidth={2} /> },
  { key: 'conges', icon: <Palmtree size={15} strokeWidth={2} /> },
  { key: 'pointage', icon: <CheckCircle2 size={15} strokeWidth={2} /> },
  { key: 'documents', icon: <FileText size={15} strokeWidth={2} /> },
]

function fmtDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-CM', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function fmtDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-CM', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function SectionRH({ onToast }: { onToast: OnToast }) {
  const t = useT('admin')
  const [tab, setTab] = useState<Tab>('personnel')
  const [employees, setEmployees] = useState<EmployeeItem[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<EmployeeDetail | null>(null)
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([])
  const [loadingLeaves, setLoadingLeaves] = useState(false)

  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [attendanceRows, setAttendanceRows] = useState<Record<string, { statut: AttendanceStatut; note: string }>>({})
  const [attendanceSaved, setAttendanceSaved] = useState(false)

  const [docEmployeeId, setDocEmployeeId] = useState('')
  const [docType, setDocType] = useState<'attestation' | 'certificat' | 'mission'>('attestation')
  const [docForm, setDocForm] = useState({ motif: '', lieu: '', dateDebut: '', dateFin: '', signataire: '' })

  const currentEmployee = useMemo(() => employees.find(e => e.id === selectedEmployeeId) ?? null, [employees, selectedEmployeeId])

  // ... RESTORE INCOMPLETE - NEED FULL FILE
  return null
}
