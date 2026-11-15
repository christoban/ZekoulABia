'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, WifiOff, Target, Check, CheckCircle2, Save, ClipboardList, AlertTriangle,
} from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import TeacherPresenceCheckIn from './TeacherPresenceCheckIn'
import TeacherAttendanceStudentRow from './TeacherAttendanceStudentRow'
import {
  buildArrivalIso,
  getCurrentHhMm,
  getDefaultAttendancePeriod,
  isoToHhMm,
  type ExistingAttendanceApiRecord,
  type LateEntryDetail,
  type TeacherAttendanceStudent,
  type TeacherAttStatus,
  type TeacherClassOption,
  type TeacherSubjectOption,
} from './teacherAttendanceTypes'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

export default function SectionTeacherAttendance({ onToast }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const { isOnline, addToQueue } = useSyncQueue()

  const [classes, setClasses] = useState<TeacherClassOption[]>([])
  const [subjects, setSubjects] = useState<TeacherSubjectOption[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<'MORNING' | 'AFTERNOON'>(getDefaultAttendancePeriod)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<TeacherAttendanceStudent[]>([])
  const [statuses, setStatuses] = useState<Record<string, TeacherAttStatus>>({})
  const [lateDetails, setLateDetails] = useState<Record<string, LateEntryDetail>>({})
  const [justifiedIds, setJustifiedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rosterLabel, setRosterLabel] = useState<string | null>(null)
  const [teacherCheckedIn, setTeacherCheckedIn] = useState(false)
  const [clockSkewAlert, setClockSkewAlert] = useState<string | null>(null)

  useEffect(() => {
    try {
      const prefillClass = sessionStorage.getItem('zekoulabia_prefill_class')
      const prefillSubject = sessionStorage.getItem('zekoulabia_prefill_subject')
      if (prefillClass) {
        setSelectedClass(prefillClass)
        sessionStorage.removeItem('zekoulabia_prefill_class')
      }
      if (prefillSubject) {
        setSelectedSubject(prefillSubject)
        sessionStorage.removeItem('zekoulabia_prefill_subject')
      }
    } catch { /* ignore */ }

    if (navigator.onLine) {
      Promise.all([
        fetchApi('/api/v2/classes', { credentials: 'include' }).then((r) => r.json()),
        fetchApi('/api/v2/subjects', { credentials: 'include' }).then((r) => r.json()),
      ]).then(async ([clsRes, subRes]) => {
        if (clsRes.success && Array.isArray(clsRes.data)) {
          setClasses(clsRes.data)
          await putCachedData('teacher:classes', clsRes.data)
        }
        if (subRes.success && Array.isArray(subRes.data)) {
          setSubjects(subRes.data)
          await putCachedData('teacher:subjects', subRes.data)
        }
      }).catch(() => {}).finally(() => setLoading(false))
    } else {
      Promise.all([
        getCachedData<TeacherClassOption[]>('teacher:classes'),
        getCachedData<TeacherSubjectOption[]>('teacher:subjects'),
      ]).then(([clsCache, subCache]) => {
        if (clsCache) setClasses(clsCache.data)
        if (subCache) setSubjects(subCache.data)
      }).catch(() => {}).finally(() => setLoading(false))
    }
  }, [])

  const initDefaultPresent = useCallback((list: TeacherAttendanceStudent[]): Record<string, TeacherAttStatus> => {
    const init: Record<string, TeacherAttStatus> = {}
    for (const st of list) init[st.id] = 'PRESENT'
    return init
  }, [])

  const loadAttendance = useCallback(async () => {
    if (!selectedClass) {
      onToast(t('attendance.toast_select_class'), 'warning')
      return
    }
    setLoading(true)
    setError(null)
    setRosterLabel(null)
    setClockSkewAlert(null)
    try {
      if (!isOnline) {
        const cached = await getCachedData<TeacherAttendanceStudent[]>(`teacher:students:${selectedClass}`)
        if (cached) {
          setStudents(cached.data)
          setStatuses(initDefaultPresent(cached.data))
          setLateDetails({})
          setJustifiedIds(new Set())
          onToast(t('attendance.toast_offline_cache'), 'info')
        } else {
          setStudents([])
          onToast(t('attendance.toast_no_cache'), 'warning')
        }
        return
      }

      let studentList: TeacherAttendanceStudent[] = []
      try {
        const resCls = await fetchApi(`/api/v2/classes/${selectedClass}/students`, { credentials: 'include' }).then((r) => r.json())
        if (resCls.success && Array.isArray(resCls.data) && resCls.data.length > 0) {
          studentList = resCls.data.map((s: { id: string; firstName?: string; lastName?: string; matricule?: string }) => ({
            id: s.id,
            name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || t('grades_section.unknown_student'),
            firstName: s.firstName,
            lastName: s.lastName,
            matricule: s.matricule,
          }))
        }
      } catch { /* fallback */ }

      if (studentList.length === 0) {
        try {
          const usersRes = await fetchApi(`/api/v2/users?role=STUDENT&classId=${selectedClass}&limit=100`, { credentials: 'include' }).then((r) => r.json())
          if (usersRes.success && Array.isArray(usersRes.data)) {
            studentList = usersRes.data.map((u: { id: string; firstName?: string; lastName?: string; studentProfile?: { matricule?: string } }) => ({
              id: u.id,
              name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || t('grades_section.unknown_student'),
              firstName: u.firstName,
              lastName: u.lastName,
              matricule: u.studentProfile?.matricule,
            }))
          }
        } catch { /* ignore */ }
      }

      const q = new URLSearchParams({ classId: selectedClass, date: selectedDate, period: selectedPeriod, limit: '100' })
      if (selectedSubject) q.set('subjectId', selectedSubject)
      const res = await fetchApi(`/api/v2/attendance?${q.toString()}`, { credentials: 'include' }).then((r) => r.json())

      // Défaut local = PRESENT (aucune écriture tant que l'enseignant ne clique pas Valider)
      const mapped = initDefaultPresent(studentList)
      const nextLate: Record<string, LateEntryDetail> = {}
      const nextJustified = new Set<string>()
      const records: ExistingAttendanceApiRecord[] = Array.isArray(res.records) ? res.records : []

      for (const rec of records) {
        if (rec.status === 'ABSENT_JUSTIFIED') {
          nextJustified.add(rec.studentId)
          mapped[rec.studentId] = 'ABSENT'
        } else if (rec.status === 'ABSENT' || rec.status === 'LATE' || rec.status === 'PRESENT') {
          mapped[rec.studentId] = rec.status
        }
        if (rec.status === 'LATE') {
          nextLate[rec.studentId] = {
            arrivedTime: isoToHhMm(rec.arrivedAt),
            lateNote: rec.lateNote || '',
          }
        }
        if (!studentList.some((s) => s.id === rec.studentId)) {
          studentList.push({
            id: rec.studentId,
            name: rec.student?.name || `${rec.student?.firstName || ''} ${rec.student?.lastName || ''}`.trim() || t('grades_section.unknown_student'),
          })
        }
      }

      let filteredRoster = false
      if (selectedSubject) {
        try {
          const roster = await fetchApi(`/api/v2/teacher/roster?classId=${selectedClass}&subjectId=${selectedSubject}`, { credentials: 'include' }).then((r) => r.json())
          if (roster?.success && roster.data?.filtered && Array.isArray(roster.data.students)) {
            studentList = roster.data.students.map((s: { id: string; name: string; className?: string }) => ({
              id: s.id, name: s.name, className: s.className,
            }))
            setRosterLabel(roster.data.label)
            filteredRoster = true
            const allowed = new Set<string>(studentList.map((s) => s.id))
            for (const k of Object.keys(mapped)) if (!allowed.has(k)) delete mapped[k]
          }
        } catch { /* fallback */ }
      }

      setStudents(studentList)
      setStatuses(mapped)
      setLateDetails(nextLate)
      setJustifiedIds(nextJustified)
      if (studentList.length === 0) onToast(t('attendance.toast_no_students'), 'info')
      if (!filteredRoster) await putCachedData(`teacher:students:${selectedClass}`, studentList)
    } catch (err) {
      setError(err instanceof Error ? err.message : tcommon('status.error'))
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedDate, selectedPeriod, selectedSubject, isOnline, initDefaultPresent, onToast, t, tcommon])

  useEffect(() => {
    if (selectedClass && selectedDate) void loadAttendance()
  }, [selectedClass, selectedDate, selectedPeriod, selectedSubject, loadAttendance])

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'attendance' && selectedClass) void loadAttendance()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [selectedClass, loadAttendance])

  const setStudentStatus = (studentId: string, nextStatus: TeacherAttStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: nextStatus }))
    if (nextStatus === 'LATE') {
      setLateDetails((prev) => ({
        ...prev,
        [studentId]: prev[studentId] ?? { arrivedTime: getCurrentHhMm(), lateNote: '' },
      }))
    }
  }

  const updateLateField = (studentId: string, patch: Partial<LateEntryDetail>) => {
    setLateDetails((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? { arrivedTime: getCurrentHhMm(), lateNote: '' }), ...patch },
    }))
  }

  const saveAttendance = async () => {
    if (!selectedClass || !students.length) { onToast(t('attendance.toast_nothing_save'), 'warning'); return }
    if (!teacherCheckedIn) {
      onToast("Veuillez d'abord signaler votre présence (Étape 1) avant de valider l'appel.", 'warning')
      return
    }
    const clientRecordedAt = new Date().toISOString()
    const presences = students.map((st) => {
      const statut = statuses[st.id] ?? 'PRESENT'
      if (statut === 'LATE') {
        const detail = lateDetails[st.id] ?? { arrivedTime: getCurrentHhMm(), lateNote: '' }
        return {
          studentId: st.id,
          statut: 'LATE' as const,
          arrivedAt: buildArrivalIso(selectedDate, detail.arrivedTime),
          lateNote: detail.lateNote.trim() || undefined,
        }
      }
      return { studentId: st.id, statut }
    })

    const payload = {
      classId: selectedClass,
      subjectId: selectedSubject || undefined,
      date: selectedDate,
      period: selectedPeriod,
      presences,
      clientRecordedAt,
      allowUpdate: true,
      isOfflineSync: !isOnline,
    }

    if (!isOnline) {
      await addToQueue({ type: 'ATTENDANCE', endpoint: '/api/v2/attendance', method: 'POST', payload })
      onToast(t('attendance.toast_offline_cache'), 'warning')
      return
    }

    setLoading(true)
    setClockSkewAlert(null)
    try {
      const res = await fetchApi('/api/v2/attendance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json())
      if (res.success) {
        if (res.data?.clockSkewWarning) {
          const skewSec = res.data.maxClockSkewSeconds ?? 0
          const msg = `Horloge de l'appareil décalée (${skewSec}s) : heure serveur conservée pour l'audit.`
          setClockSkewAlert(msg)
          onToast(msg, 'warning')
        } else {
          onToast(t('attendance.toast_saved'), 'success')
        }
      } else {
        onToast(res.message || t('attendance.toast_save_error'), 'error')
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('attendance.toast_save_error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const counts = { P: 0, A: 0, R: 0 }
  for (const s of students) {
    const st = statuses[s.id] ?? 'PRESENT'
    if (st === 'PRESENT') counts.P++
    else if (st === 'ABSENT') counts.A++
    else counts.R++
  }

  if (loading && !students.length) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5 h-full flex items-center justify-center">
        <div className="text-xs font-semibold text-[var(--text3)]">{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5 h-full overflow-y-auto text-center">
        <div className="text-xs font-bold text-[var(--red)] mb-2.5">{error}</div>
        <button onClick={() => void loadAttendance()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface)] text-[var(--text2)] border border-[var(--border2)] cursor-pointer">
          <RefreshCw size={13} /> {tcommon('actions.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <div style={sTitle}>{t('attendance.title')}</div>
          <div style={sSub}>{t('attendance.subtitle')} · {selectedDate} ({selectedPeriod === 'MORNING' ? 'Matin' : 'Après-midi'})</div>
        </div>
      </div>

      <TeacherPresenceCheckIn onPresenceConfirmed={() => setTeacherCheckedIn(true)} onToast={onToast} classId={selectedClass} subjectId={selectedSubject} />

      {!isOnline && (
        <div className="rounded-lg p-2.5 flex items-center gap-2 border border-[var(--amber)] bg-[var(--amber-light)] text-[var(--amber)] text-xs font-bold">
          <WifiOff size={15} /> <span>{t('attendance.offline_banner')}</span>
        </div>
      )}

      {clockSkewAlert && (
        <div className="rounded-lg p-2.5 flex items-center gap-2 border border-[var(--amber)] bg-[var(--amber-light)] text-[var(--amber)] text-xs font-bold">
          <AlertTriangle size={15} /> <span>{clockSkewAlert}</span>
        </div>
      )}

      <div className="p-2.5 sm:p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] grid grid-cols-2 sm:flex sm:flex-row gap-2 items-center">
        <select className="w-full sm:w-auto h-9" style={filterSt} value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          <option value="">Sélectionne une classe</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="w-full sm:w-auto h-9" style={filterSt} value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
          <option value="">Matière (optionnelle)</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="w-full sm:w-auto h-9" style={filterSt} value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value as 'MORNING' | 'AFTERNOON')}>
          <option value="MORNING">Matin (07h-12h)</option>
          <option value="AFTERNOON">Après-midi (13h-18h)</option>
        </select>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full sm:w-auto h-9" style={{ ...filterSt, backgroundImage: 'none', paddingRight: 10 }} />
        <button className="w-full sm:w-auto h-9 px-4 shrink-0 inline-flex items-center justify-center font-bold" style={btnPrim} onClick={() => void loadAttendance()} disabled={loading}>
          Charger
        </button>
      </div>

      {rosterLabel && (
        <div className="rounded-lg p-2.5 flex items-center gap-2 border border-[var(--blue)] bg-[var(--blue-light)] text-[var(--blue)] text-xs font-extrabold">
          <Target size={15} /> <span>{rosterLabel}</span>
        </div>
      )}

      {students.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t('attendance.stats_present'), count: counts.P, bg: 'var(--green-light)', color: 'var(--green)' },
              { label: t('attendance.stats_absent'), count: counts.A, bg: 'var(--red-light)', color: 'var(--red)' },
              { label: t('attendance.stats_late'), count: counts.R, bg: 'var(--amber-light)', color: 'var(--amber)' },
            ].map((s) => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="h-9 px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              style={{ color: 'var(--green)', border: '1.5px solid rgba(142,42,58,0.3)', background: 'var(--green-light)' }}
              onClick={() => { setStatuses(initDefaultPresent(students)); setLateDetails({}) }}
            >
              <Check size={14} strokeWidth={2.5} /> <span>Tous présents (local)</span>
            </button>
            <span className="text-xs text-[var(--text3)] font-semibold">{students.length} élèves · Non validé tant que non enregistré</span>
          </div>

          <div className="space-y-2">
            {students.map((student, i) => (
              <TeacherAttendanceStudentRow
                key={student.id}
                student={student}
                index={i}
                status={statuses[student.id] ?? 'PRESENT'}
                lateInfo={lateDetails[student.id]}
                isJustified={justifiedIds.has(student.id)}
                showClassName={Boolean(rosterLabel)}
                onStatusChange={setStudentStatus}
                onLateFieldChange={updateLateField}
              />
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              className="w-full sm:w-auto h-10 px-5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))' }}
              onClick={() => void saveAttendance()}
              disabled={loading}
            >
              {loading ? <Save size={15} /> : isOnline ? <CheckCircle2 size={15} /> : <WifiOff size={15} />}
              <span>{loading ? 'Validation...' : isOnline ? "Valider l'appel" : "Mettre en file d'attente"}</span>
            </button>
          </div>
        </>
      )}

      {!loading && students.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-9 text-center">
          <div className="flex justify-center mb-3"><ClipboardList size={36} /></div>
          <div className="text-sm font-bold text-[var(--text)] mb-1">Sélectionne une classe et clique sur Charger</div>
          <div className="text-xs text-[var(--text3)]">Tous les élèves apparaîtront Présents localement jusqu&apos;à validation</div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 24px 5px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238c6b45' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }
