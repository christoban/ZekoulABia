'use client'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

export interface DailyClassStatusItem {
  classId: string
  className: string
  level: string | null
  studentCount: number
  recordedCount: number
  presentCount: number
  absentCount: number
  lateCount: number
  isDone: boolean
  recordedAt: string | null
  recordedBy: { id: string; firstName: string; lastName: string } | null
}

export interface RepeatedAbsenceItem {
  studentId: string
  firstName: string
  lastName: string
  classId: string
  className: string
  unjustifiedCount: number
  justifiedCount: number
  totalAbsences: number
  lastAbsenceDate: string | null
}

interface DailyStatusPanelProps {
  date: string
  period?: string
}

export function AttendanceDailyStatusPanel({ date, period }: DailyStatusPanelProps) {
  const [classes, setClasses] = useState<DailyClassStatusItem[]>([])
  const [summary, setSummary] = useState<{ totalClasses: number; doneCount: number; pendingCount: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrMsg(null)
    try {
      const q = new URLSearchParams({ date })
      if (period === 'MORNING' || period === 'AFTERNOON') q.set('period', period)
      const res = await fetchApi(`/api/v2/attendance/daily-status?${q.toString()}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Erreur de chargement')
      setClasses(Array.isArray(json.data?.classes) ? json.data.classes : [])
      setSummary(json.data?.summary ?? null)
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [date, period])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-3.5 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-[var(--text)]">Suivi des appels du jour ({date})</div>
          {summary && (
            <div className="text-xs text-[var(--text3)] font-semibold">
              {summary.doneCount}/{summary.totalClasses} classes appelées · {summary.pendingCount} en attente
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="h-8 px-3 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-bold text-[var(--text2)] inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="p-6 flex justify-center"><Loader2 size={20} className="animate-spin text-[var(--text3)]" /></div>
      ) : errMsg ? (
        <div className="p-4 text-xs font-bold text-[var(--red)]">{errMsg}</div>
      ) : classes.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--text3)]">Aucune classe active trouvée.</div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {classes.map((c) => (
            <div key={c.classId} className="p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[var(--text)]">
                  {c.className} {c.level ? <span className="text-[var(--text3)] font-semibold">· {c.level}</span> : null}
                </div>
                <div className="text-[11px] text-[var(--text3)] mt-0.5">
                  {c.studentCount} élèves · P:{c.presentCount} · A:{c.absentCount} · R:{c.lateCount}
                  {c.recordedBy ? ` · Par ${c.recordedBy.firstName} ${c.recordedBy.lastName}` : ''}
                </div>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1"
                style={{
                  background: c.isDone ? 'var(--green-light)' : 'var(--amber-light)',
                  color: c.isDone ? 'var(--green)' : 'var(--amber)',
                }}
              >
                {c.isDone ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
                {c.isDone ? 'Appel fait' : 'Non fait'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AttendanceRepeatedAbsencesPanel() {
  const [days, setDays] = useState(30)
  const [threshold, setThreshold] = useState<number | null>(null)
  const [students, setStudents] = useState<RepeatedAbsenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrMsg(null)
    try {
      const res = await fetchApi(`/api/v2/attendance/repeated-absences?days=${days}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Erreur de chargement')
      setThreshold(json.data?.threshold ?? 3)
      setStudents(Array.isArray(json.data?.students) ? json.data.students : [])
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-3.5 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-[var(--text)]">Absences répétées</div>
          <div className="text-xs text-[var(--text3)] font-semibold">
            Seuil : {threshold ?? '—'} absences non justifiées sur les {days} derniers jours
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 px-2 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-bold text-[var(--text2)]"
          >
            <option value={14}>14 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="h-8 px-3 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-bold text-[var(--text2)] inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} /> Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 flex justify-center"><Loader2 size={20} className="animate-spin text-[var(--text3)]" /></div>
      ) : errMsg ? (
        <div className="p-4 text-xs font-bold text-[var(--red)]">{errMsg}</div>
      ) : students.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--text3)]">Aucun élève ne dépasse le seuil sur cette période.</div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {students.map((st) => (
            <div key={st.studentId} className="p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[var(--text)]">{st.firstName} {st.lastName}</div>
                <div className="text-[11px] text-[var(--text3)] mt-0.5">
                  {st.className} · Justifiées : {st.justifiedCount}
                  {st.lastAbsenceDate ? ` · Dernière : ${new Date(st.lastAbsenceDate).toLocaleDateString('fr-FR')}` : ''}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 bg-[var(--red-light)] text-[var(--red)]">
                <AlertTriangle size={12} /> {st.unjustifiedCount} non justifiée(s)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

