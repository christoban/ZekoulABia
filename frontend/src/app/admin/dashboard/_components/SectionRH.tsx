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
  padding: '11px 14px',
  borderRadius: 11,
  border: '1.5px solid var(--border2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 14,
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
  borderRadius: 999,
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

  const loadEmployees = async () => {
    setLoadingEmployees(true)
    try {
      const r = await fetchApi('/api/v2/hr/employees', { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errLoadStaff'))
      setEmployees(d.data ?? [])
      if (!selectedEmployeeId && (d.data ?? []).length > 0) setSelectedEmployeeId((d.data ?? [])[0].id)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errLoadStaff'), 'error')
    } finally {
      setLoadingEmployees(false)
    }
  }

  const loadDetail = async (employeeId: string) => {
    setLoadingDetail(true)
    try {
      const r = await fetchApi(`/api/v2/hr/employees/${employeeId}`, { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errLoadFile'))
      setSelectedDetail(d.data)
      setSelectedEmployeeId(employeeId)
      setDocEmployeeId(employeeId)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errLoadFile'), 'error')
    } finally {
      setLoadingDetail(false)
    }
  }

  const loadLeaves = async () => {
    setLoadingLeaves(true)
    try {
      const r = await fetchApi('/api/v2/hr/leave-requests', { credentials: 'include' })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errLeaves'))
      setLeaveRequests(d.data ?? [])
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errLeaves'), 'error')
    } finally {
      setLoadingLeaves(false)
    }
  }

  useEffect(() => {
    if (tab === 'personnel' && employees.length === 0 && !loadingEmployees) loadEmployees()
  }, [tab])

  useEffect(() => {
    if (selectedEmployeeId && !selectedDetail) loadDetail(selectedEmployeeId)
  }, [selectedEmployeeId])

  useEffect(() => {
    if (tab === 'conges' && leaveRequests.length === 0 && !loadingLeaves) loadLeaves()
  }, [tab])

  // Rafraîchissement temps réel quand l'assistant IA traite une demande de congé.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'leaveRequest') loadLeaves()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'pointage' || employees.length > 0 || loadingEmployees) return
    loadEmployees()
  }, [tab])

  useEffect(() => {
    if (tab !== 'documents' && employees.length === 0 && !loadingEmployees) loadEmployees()
  }, [tab])

  useEffect(() => {
    if (!selectedEmployeeId && employees[0]) {
      setSelectedEmployeeId(employees[0].id)
      setDocEmployeeId(employees[0].id)
    }
  }, [employees, selectedEmployeeId])

  useEffect(() => {
    if (!employees.length) return
    setAttendanceRows(prev => {
      const next = { ...prev }
      for (const emp of employees) {
        if (!next[emp.id]) next[emp.id] = { statut: 'PRESENT', note: '' }
      }
      return next
    })
  }, [employees])

  const saveEmployeeFile = async (employeeId: string, payload: Record<string, unknown>) => {
    const r = await fetchApi(`/api/v2/hr/employees/${employeeId}/file`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    if (!d.success) throw new Error(d.message ?? t('rh.toast.errFile'))
    onToast(t('rh.toast.fileSaved'), 'success')
    await loadDetail(employeeId)
    await loadEmployees()
  }

  const handleApproveLeave = async (leaveId: string, statut: Exclude<LeaveStatus, 'PENDING'>) => {
    try {
      const r = await fetchApi(`/api/v2/hr/leave-requests/${leaveId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errLeave'))
      onToast(statut === 'APPROVED' ? t('rh.toast.leaveApproved') : t('rh.toast.leaveRejected'), 'success')
      loadLeaves()
      if (selectedEmployeeId) loadDetail(selectedEmployeeId)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errLeave'), 'error')
    }
  }

  const saveAttendance = async () => {
    try {
      const attendances = employees.map(emp => ({
        userId: emp.id,
        statut: attendanceRows[emp.id]?.statut ?? 'PRESENT',
        note: attendanceRows[emp.id]?.note?.trim() || undefined,
      }))
      const r = await fetchApi('/api/v2/hr/attendance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: attendanceDate, attendances }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.message ?? t('rh.toast.errAttendance'))
      setAttendanceSaved(true)
      onToast(t('rh.toast.attendanceSaved'), 'success')
      setTimeout(() => setAttendanceSaved(false), 1500)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errAttendance'), 'error')
    }
  }

  const generateDoc = async () => {
    if (!docEmployeeId) {
      onToast(t('rh.toast.selectEmployee'), 'error')
      return
    }

    try {
      let url = ''
      let method: 'GET' | 'POST' = 'GET'
      let body: string | undefined
      if (docType === 'attestation') {
        url = `/api/v2/hr/employees/${docEmployeeId}/attestation-travail`
      } else if (docType === 'certificat') {
        url = `/api/v2/hr/employees/${docEmployeeId}/certificat-travail`
      } else {
        url = '/api/v2/hr/mission-orders'
        method = 'POST'
        body = JSON.stringify({
          userId: docEmployeeId,
          motif: docForm.motif,
          lieu: docForm.lieu,
          dateDebut: docForm.dateDebut,
          dateFin: docForm.dateFin,
          signataire: docForm.signataire,
        })
      }

      const res = await fetchApi(url, {
        method,
        credentials: 'include',
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })

      if (docType === 'mission') {
        const d = await res.json()
        if (!d.success) throw new Error(d.message ?? t('rh.toast.errMission'))
        onToast(t('rh.toast.missionCreated'), 'success')
        return
      }

      if (!res.ok) throw new Error(t('rh.toast.errPdfGen'))
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${docType}-${docEmployeeId}.pdf`
      link.click()
      URL.revokeObjectURL(link.href)
      onToast(t('rh.toast.docDownloaded'), 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('rh.toast.errDoc'), 'error')
    }
  }

  const tabButton = (key: Tab, label: string, icon: React.ReactNode) => (
    <button key={key}
      onClick={() => setTab(key)}
      className="text-[12px] md:text-[14px] px-[12px] md:px-[18px] py-[8px] md:py-[9px] rounded-[12px] md:rounded-[11px]"
      style={{
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: 800,
        background: tab === key ? 'var(--sidebar)' : 'var(--bg2)',
        color: tab === key ? 'white' : 'var(--text2)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon} {label}
    </button>
  )

  return (
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="mb-[16px] md:mb-[22px]">
        <div className="text-[22px] md:text-[24px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('rh.title')}</div>
        <div className="text-[13px] md:text-[14px]" style={{ color: 'var(--text3)', fontWeight: 500, marginTop: 4 }}>{t('rh.subtitle')}</div>
      </div>

      {/* Onglets — mobile : puces défilables avec indicateur glissant, fondu de bord (maquette) */}
      <div className="relative md:hidden mb-[16px] -mr-4">
        <div className="flex gap-[6px] overflow-x-auto pr-8 py-[2px]" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tb => {
            const active = tab === tb.key
            return (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                className="relative flex-shrink-0 rounded-[12px] px-[14px] py-[9px] whitespace-nowrap border-0"
                style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {active && (
                  <motion.div layoutId="rh-tab-pill" className="absolute inset-0 rounded-[12px]"
                    style={{ background: 'var(--sidebar)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? '#fff' : 'var(--text3)' }}>
                  {tb.icon} {t(`rh.tabs.${tb.key}`)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="pointer-events-none absolute top-0 right-0 bottom-[4px] w-7" style={{ background: 'linear-gradient(90deg,transparent,var(--bg) 65%)' }} />
      </div>

      <div className="hidden md:flex" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {TABS.map(tb => tabButton(tb.key, t(`rh.tabs.${tb.key}`), tb.icon))}
      </div>

      {/* Sur mobile, la liste employes / detail (360px fixe) ecrasait l'ecran — empile en 1
          colonne en dessous de md, cote a cote a partir de md (inchange). */}
      {tab === 'personnel' && (
        <div className="grid grid-cols-1 md:[grid-template-columns:360px_1fr]" style={{ gap: 18 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className="px-[14px] py-[12px] md:px-[20px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('rh.staffList')}</div>
              <button
                title={t('rh.exportMinesecHint')}
                style={{ ...chipStyle('var(--green-light)', 'var(--green)'), border: 'none', cursor: 'pointer' }}
                onClick={async () => {
                  try {
                    const r = await fetchApi('/api/v2/hr/export/liste-nominale-minesec', { credentials: 'include' })
                    if (!r.ok) throw new Error(t('rh.toast.errPdf'))
                    const blob = await r.blob()
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = 'liste-nominale-minesec.xlsx'
                    link.click()
                    URL.revokeObjectURL(link.href)
                  } catch (error) {
                    onToast(error instanceof Error ? error.message : t('rh.toast.errPdf'), 'error')
                  }
                }}
              >{t('rh.exportMinesec')}</button>
            </div>
            {loadingEmployees ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>{t('rh.loading')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {employees.map(emp => {
                  const active = selectedEmployeeId === emp.id
                  return (
                    <button
                      key={emp.id}
                      onClick={() => loadDetail(emp.id)}
                      className="px-[14px] py-[12px] md:px-[18px] md:py-[14px]"
                      style={{
                        textAlign: 'left',
                        border: 'none',
                        background: active ? 'var(--bg2)' : 'white',
                        borderBottom: '1px solid var(--bg2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div className="w-9 h-9 md:hidden text-[12px]" style={{ borderRadius: 11, background: emp.role === 'TEACHER' ? 'var(--blue)' : 'var(--orange)', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {(emp.firstName[0] ?? '').toUpperCase()}{(emp.lastName[0] ?? '').toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div>
                          <div className="text-[13.5px] md:text-[15px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{emp.fullName}</div>
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={chipStyle(emp.role === 'TEACHER' ? 'var(--blue-light)' : 'var(--orange-light)', emp.role === 'TEACHER' ? 'var(--blue)' : 'var(--orange)')}>
                              {emp.role === 'TEACHER' ? t('rh.roleTeacher') : t('rh.roleStaff')}
                            </span>
                            {emp.staffProfile?.title && <span style={chipStyle('var(--purple-light)', 'var(--purple)')}>{emp.staffProfile.title}</span>}
                          </div>
                        </div>
                        <div className="hidden sm:block" style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{emp.email ?? '—'}</div>
                      </div>
                    </button>
                  )
                })}
                {employees.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>{t('rh.noEmployees')}</div>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              <div className="px-[14px] py-[12px] md:px-[20px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('rh.employeeCard')}</div>
                <button style={{ ...chipStyle('var(--bg2)', 'var(--text2)'), border: 'none', cursor: 'pointer' }} onClick={() => selectedEmployeeId && loadDetail(selectedEmployeeId)}>{t('rh.refresh')}</button>
              </div>
              {loadingDetail || !selectedDetail ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>{t('rh.selectEmployee')}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 p-[14px] md:p-[20px]" style={{ gap: 14 }}>
                  <div>
                    <div style={labelStyle}>{t('rh.fullName')}</div>
                    <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{selectedDetail.employee.fullName}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.role')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.employee.role}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.email')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.employee.email ?? '—'}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.phone')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.employee.phone ?? '—'}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.hireDate')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtDate(selectedDetail.file?.dateEmbauche ?? null)}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.cnps')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.file?.numeroCNPS ?? '—'}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.contractType')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.file?.typeContrat ?? '—'}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.echelon')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.file?.echelonActuel ?? '—'}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.gender')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.file?.gender === 'F' ? t('rh.genderF') : selectedDetail.file?.gender === 'M' ? t('rh.genderM') : '—'}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.documentsCount')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedDetail.file?.documentsUrls?.length ?? 0}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={labelStyle}>{t('rh.selfServiceStatus')}</div>
                    {selectedDetail.file?.selfServiceCompletedAt ? (
                      <span style={{ ...chipStyle('rgba(22,163,74,0.12)', 'var(--green)'), fontSize: 13, fontWeight: 700 }}>
                        <CheckCircle2 size={13} strokeWidth={2} /> {t('rh.selfServiceCompletedOn', { date: new Date(selectedDetail.file.selfServiceCompletedAt).toLocaleDateString() })}
                      </span>
                    ) : (
                      <span style={{ ...chipStyle('rgba(234,179,8,0.12)', '#b45309'), fontSize: 13, fontWeight: 700 }}>
                        <AlertTriangle size={13} strokeWidth={2} /> {t('rh.selfServiceNotCompleted')}
                      </span>
                    )}
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                    <button style={{ ...chipStyle('var(--blue-light)', 'var(--blue)'), border: 'none', cursor: 'pointer' }} onClick={() => saveEmployeeFile(selectedDetail.employee.id, (selectedDetail.file ?? {}) as Record<string, unknown>)}>{t('rh.saveFile')}</button>
                    <button style={{ ...chipStyle('var(--blue-light)', 'var(--blue)'), border: 'none', cursor: 'pointer' }} onClick={async () => {
                      const type = prompt(t('rh.prompt.eventType'))
                      if (!type) return
                      const date = prompt(t('rh.prompt.date'))
                      if (!date) return
                      const observation = prompt(t('rh.prompt.observation')) ?? ''
                      try {
                        const r = await fetchApi(`/api/v2/hr/employees/${selectedDetail.employee.id}/career-events`, {
                          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, date, observation }),
                        })
                        const d = await r.json()
                        if (!d.success) throw new Error(d.message ?? t('rh.toast.errEvent'))
                        onToast(t('rh.toast.eventAdded'), 'success')
                        loadDetail(selectedDetail.employee.id)
                      } catch (error) {
                        onToast(error instanceof Error ? error.message : t('rh.toast.errEvent'), 'error')
                      }
                    }}>{t('rh.addCareer')}</button>
                    <button style={{ ...chipStyle('var(--purple-light)', 'var(--purple)'), border: 'none', cursor: 'pointer' }} onClick={async () => {
                      try {
                        const r = await fetchApi(`/api/v2/hr/employees/${selectedDetail.employee.id}/attestation-travail`, { credentials: 'include' })
                        if (!r.ok) throw new Error(t('rh.toast.errAttestation'))
                        const blob = await r.blob()
                        const link = document.createElement('a')
                        link.href = URL.createObjectURL(blob)
                        link.download = `attestation-${selectedDetail.employee.id}.pdf`
                        link.click()
                        URL.revokeObjectURL(link.href)
                      } catch (error) {
                        onToast(error instanceof Error ? error.message : t('rh.toast.errPdf'), 'error')
                      }
                    }}>{t('rh.attestation')}</button>
                    <button style={{ ...chipStyle('var(--amber-light)', 'var(--amber)'), border: 'none', cursor: 'pointer' }} onClick={async () => {
                      try {
                        const r = await fetchApi(`/api/v2/hr/employees/${selectedDetail.employee.id}/certificat-travail`, { credentials: 'include' })
                        if (!r.ok) throw new Error(t('rh.toast.errCertificat'))
                        const blob = await r.blob()
                        const link = document.createElement('a')
                        link.href = URL.createObjectURL(blob)
                        link.download = `certificat-${selectedDetail.employee.id}.pdf`
                        link.click()
                        URL.revokeObjectURL(link.href)
                      } catch (error) {
                        onToast(error instanceof Error ? error.message : t('rh.toast.errPdf'), 'error')
                      }
                    }}>{t('rh.certificat')}</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              <div className="text-[14px] md:text-[16px] px-[14px] py-[12px] md:px-[20px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.historyTitle')}</div>
              {!selectedDetail ? (
                <div style={{ padding: 24, color: 'var(--text3)' }}>{t('rh.selectForHistory')}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 p-[14px] md:p-[20px]" style={{ gap: 16 }}>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 10 }}>{t('rh.careerEvents')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedDetail.careerEvents.length === 0 && <div style={{ color: 'var(--text3)' }}>{t('rh.noEvents')}</div>}
                      {selectedDetail.careerEvents.map(ev => (
                        <div key={ev.id} style={{ border: '1px solid var(--bg2)', borderRadius: 12, padding: '10px 12px', background: 'var(--bg)' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text)' }}>{ev.type}</div>
                          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{fmtDate(ev.date)}</div>
                          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{ev.observation ?? '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 10 }}>{t('rh.leaveBalance')}</div>
                    <div style={{ border: '1px solid var(--bg2)', borderRadius: 12, padding: 14, background: 'var(--bg)', marginBottom: 12 }}>
                      <div style={{ fontWeight: 800, color: 'var(--text)' }}>{selectedDetail.leaveBalance.current ? t('rh.daysRemaining', { n: selectedDetail.leaveBalance.current.soldeRestant }) : '—'}</div>
                      <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{t('rh.year', { y: selectedDetail.leaveBalance.current?.annee ?? new Date().getFullYear() })}</div>
                    </div>
                    <div style={{ ...labelStyle, marginBottom: 10 }}>{t('rh.leaveRequests')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedDetail.leaveRequests.length === 0 && <div style={{ color: 'var(--text3)' }}>{t('rh.noRequests')}</div>}
                      {selectedDetail.leaveRequests.map(req => (
                        <div key={req.id} style={{ border: '1px solid var(--bg2)', borderRadius: 12, padding: '10px 12px', background: 'var(--bg)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontWeight: 800, color: 'var(--text)' }}>{req.type}</div>
                            <span style={chipStyle(req.statut === 'APPROVED' ? 'var(--green-light)' : req.statut === 'REJECTED' ? 'var(--red-light)' : 'var(--amber-light)', req.statut === 'APPROVED' ? 'var(--green)' : req.statut === 'REJECTED' ? 'var(--red)' : 'var(--amber)')}>{req.statut}</span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{fmtDate(req.dateDebut)} → {fmtDate(req.dateFin)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'conges' && (
        <div className="grid grid-cols-1 md:[grid-template-columns:1fr_1fr]" style={{ gap: 18 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className="px-[14px] py-[12px] md:px-[20px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('rh.pendingRequests')}</div>
              <button style={{ ...chipStyle('var(--bg2)', 'var(--text2)'), border: 'none', cursor: 'pointer' }} onClick={loadLeaves}>{t('rh.refresh')}</button>
            </div>
            {loadingLeaves ? <div style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>{t('rh.loading')}</div> : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {leaveRequests.filter(l => l.statut === 'PENDING').map(req => (
                  <div key={req.id} style={{ border: '1px solid var(--bg2)', borderRadius: 12, padding: 14, background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text)' }}>{req.user.firstName} {req.user.lastName}</div>
                        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{req.type} · {fmtDate(req.dateDebut)} → {fmtDate(req.dateFin)}</div>
                      </div>
                      <span style={chipStyle('var(--amber-light)', 'var(--amber)')}>{req.statut}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>{req.motif ?? '—'}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button style={{ ...chipStyle('var(--green-light)', 'var(--green)'), border: 'none', cursor: 'pointer' }} onClick={() => handleApproveLeave(req.id, 'APPROVED')}>{t('rh.approve')}</button>
                      <button style={{ ...chipStyle('var(--red-light)', 'var(--red)'), border: 'none', cursor: 'pointer' }} onClick={() => handleApproveLeave(req.id, 'REJECTED')}>{t('rh.reject')}</button>
                    </div>
                  </div>
                ))}
                {leaveRequests.filter(l => l.statut === 'PENDING').length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>{t('rh.noPending')}</div>}
              </div>
            )}
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className="text-[14px] md:text-[16px] px-[14px] py-[12px] md:px-[20px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.leaveHistory')}</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {leaveRequests.filter(l => l.statut !== 'PENDING').map(req => (
                <div key={req.id} style={{ border: '1px solid var(--bg2)', borderRadius: 12, padding: 14, background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--text)' }}>{req.user.firstName} {req.user.lastName}</div>
                      <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{req.type} · {fmtDate(req.dateDebut)} → {fmtDate(req.dateFin)}</div>
                    </div>
                    <span style={chipStyle(req.statut === 'APPROVED' ? 'var(--green-light)' : 'var(--red-light)', req.statut === 'APPROVED' ? 'var(--green)' : 'var(--red)')}>{req.statut}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>{t('rh.validatedBy')} {req.validator ? `${req.validator.firstName} ${req.validator.lastName}` : '—'}</div>
                </div>
              ))}
              {leaveRequests.filter(l => l.statut !== 'PENDING').length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>{t('rh.noHistory')}</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'pointage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className="px-[14px] py-[12px] md:px-[20px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('rh.dailyAttendance')}</div>
              <button style={{ ...chipStyle('var(--blue-light)', 'var(--blue)'), border: 'none', cursor: 'pointer' }} onClick={saveAttendance}>{t('rh.saveAttendance')}</button>
            </div>
            <div style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={labelStyle}>{t('rh.date')}</div>
                <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} style={{ ...inputStyle, width: 200 }} />
              </div>
              <div style={{ color: attendanceSaved ? 'var(--green)' : 'var(--text3)', fontWeight: 700 }}>{attendanceSaved ? t('rh.attendanceSavedLabel') : t('rh.noRecentRecord')}</div>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className="text-[14px] md:text-[16px] px-[14px] py-[12px] md:px-[20px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.statusByEmployee')}</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {employees.map(emp => (
                <div key={emp.id} className="grid grid-cols-1 md:[grid-template-columns:1fr_180px_1.4fr]" style={{ gap: 10, alignItems: 'center', border: '1px solid var(--bg2)', borderRadius: 12, padding: 12, background: 'var(--bg)' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--text)' }}>{emp.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{emp.role}</div>
                  </div>
                  <select value={attendanceRows[emp.id]?.statut ?? 'PRESENT'} onChange={e => setAttendanceRows(prev => ({ ...prev, [emp.id]: { ...(prev[emp.id] ?? { note: '' }), statut: e.target.value as AttendanceStatut } }))} style={inputStyle}>
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="RETARD">RETARD</option>
                  </select>
                  <input value={attendanceRows[emp.id]?.note ?? ''} onChange={e => setAttendanceRows(prev => ({ ...prev, [emp.id]: { ...(prev[emp.id] ?? { statut: 'PRESENT' }), note: e.target.value } }))} placeholder={t('rh.optionalNote')} style={inputStyle} />
                </div>
              ))}
              {employees.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>{t('rh.loadStaffFirst')}</div>}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className="text-[14px] md:text-[16px] px-[14px] py-[12px] md:px-[20px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.aVerifier')}</div>
            <div style={{ padding: 16 }}>
              <SectionStaffAttendanceAVerifier onToast={onToast} />
            </div>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="grid grid-cols-1 md:[grid-template-columns:1fr_1fr]" style={{ gap: 18 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className="text-[14px] md:text-[16px] px-[14px] py-[12px] md:px-[20px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.generateDoc')}</div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={labelStyle}>{t('rh.employee')}</div>
                <select value={docEmployeeId} onChange={e => setDocEmployeeId(e.target.value)} style={inputStyle}>
                  <option value="">{t('rh.choose')}</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
                </select>
              </div>
              <div>
                <div style={labelStyle}>{t('rh.document')}</div>
                <select value={docType} onChange={e => setDocType(e.target.value as typeof docType)} style={inputStyle}>
                  <option value="attestation">{t('rh.docAttestation')}</option>
                  <option value="certificat">{t('rh.docCertificat')}</option>
                  <option value="mission">{t('rh.docMission')}</option>
                </select>
              </div>
              {docType === 'mission' && (
                <>
                  <div>
                    <div style={labelStyle}>{t('rh.motif')}</div>
                    <input value={docForm.motif} onChange={e => setDocForm(prev => ({ ...prev, motif: e.target.value }))} style={inputStyle} placeholder={t('rh.motifPlaceholder')} />
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.place')}</div>
                    <input value={docForm.lieu} onChange={e => setDocForm(prev => ({ ...prev, lieu: e.target.value }))} style={inputStyle} placeholder={t('rh.placePlaceholder')} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={labelStyle}>{t('rh.startDate')}</div>
                      <input type="date" value={docForm.dateDebut} onChange={e => setDocForm(prev => ({ ...prev, dateDebut: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <div style={labelStyle}>{t('rh.endDate')}</div>
                      <input type="date" value={docForm.dateFin} onChange={e => setDocForm(prev => ({ ...prev, dateFin: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>{t('rh.signatory')}</div>
                    <input value={docForm.signataire} onChange={e => setDocForm(prev => ({ ...prev, signataire: e.target.value }))} style={inputStyle} placeholder={t('rh.signatoryPlaceholder')} />
                  </div>
                </>
              )}
              <button onClick={generateDoc} style={{ ...chipStyle('var(--sidebar)', 'white'), border: 'none', cursor: 'pointer', justifyContent: 'center' }}>{t('rh.generate')}</button>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div className="text-[14px] md:text-[16px] px-[14px] py-[12px] md:px-[20px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.preview')}</div>
            <div style={{ padding: 18, color: 'var(--text2)', lineHeight: 1.7 }}>
              {docType === 'attestation' && t('rh.previewAttestation')}
              {docType === 'certificat' && t('rh.previewCertificat')}
              {docType === 'mission' && t('rh.previewMission')}
              <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text3)' }}>
                {t('rh.selectedEmployee')} <strong>{currentEmployee?.fullName ?? '—'}</strong>
                <br />{t('rh.lastFileUpdate')} <strong>{selectedDetail ? fmtDateTime(selectedDetail.employee.file ? (selectedDetail.employee.file.dateEmbauche ?? null) : null) : '—'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
