'use client'
import { useState, useEffect } from 'react'
import { RefreshCw, WifiOff, Target, Check, X, CheckCircle2, Save, ClipboardList } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null

const ATT_SHORT: Record<string, 'P' | 'A' | 'R' | 'E'> = {
  PRESENT: 'P', ABSENT: 'A', LATE: 'R', EXCUSED: 'E',
}

const ATT_STYLE: Record<string, { selBg: string; selBorder: string; selColor: string; label: string; Icon?: typeof Check }> = {
  P: { selBg: 'var(--green-light)', selBorder: 'var(--green)', selColor: 'var(--green)', label: '', Icon: Check },
  A: { selBg: 'var(--red-light)', selBorder: 'var(--red)', selColor: 'var(--red)', label: '', Icon: X },
  R: { selBg: 'var(--amber-light)', selBorder: 'var(--amber)', selColor: 'var(--amber)', label: '~' },
  E: { selBg: 'var(--blue-light)', selBorder: 'var(--blue)', selColor: 'var(--blue)', label: 'E' },
}

const ATT_TITLE_KEY: Record<string, string> = {
  P: 'attendance.stats_present',
  A: 'attendance.stats_absent',
  R: 'attendance.stats_late',
  E: 'attendance.stats_excused',
}

export default function SectionTeacherAttendance({ onToast, user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const attTitle = (code: string) => t(ATT_TITLE_KEY[code] || code)
  const [classes, setClasses] = useState<any[]>([])
  const defaultPeriod = (): 'MORNING' | 'AFTERNOON' => {
    const hour = new Date().getHours()
    const minutes = new Date().getMinutes()
    return (hour > 12 || (hour === 12 && minutes >= 30)) ? 'AFTERNOON' : 'MORNING'
  }

  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<'MORNING' | 'AFTERNOON'>(defaultPeriod())
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<any[]>([])
  const [statuses, setStatuses] = useState<Record<string, AttStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rosterLabel, setRosterLabel] = useState<string | null>(null)

  const { isOnline, addToQueue } = useSyncQueue()

  useEffect(() => {
    // Vérifier si un cours du jour a été cliqué depuis le tableau de bord (action rapide)
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
        fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
      ]).then(async ([clsRes, subRes]) => {
        if (clsRes.success) {
          setClasses(clsRes.data)
          await putCachedData('teacher:classes', clsRes.data)
        }
        if (subRes.success) {
          setSubjects(subRes.data)
          await putCachedData('teacher:subjects', subRes.data)
        }
      }).catch(() => {}).finally(() => setLoading(false))
    } else {
      Promise.all([
        getCachedData<any[]>('teacher:classes'),
        getCachedData<any[]>('teacher:subjects'),
      ]).then(([clsCache, subCache]) => {
        if (clsCache) setClasses(clsCache.data)
        if (subCache) setSubjects(subCache.data)
      }).catch(() => {}).finally(() => setLoading(false))
    }
  }, [])

  // Rafraîchissement temps réel quand l'assistant IA marque une présence.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'attendance' && selectedClass) loadAttendance()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [selectedClass])  // eslint-disable-line react-hooks/exhaustive-deps

  const loadAttendance = async () => {
    if (!selectedClass) { onToast(t('attendance.toast_select_class'), 'warning'); return }
    setLoading(true)
    setError(null)
    setRosterLabel(null)
    try {
      if (!isOnline) {
        const cached = await getCachedData<any[]>(`teacher:students:${selectedClass}`)
        if (cached) {
          setStudents(cached.data)
          setStatuses({})
          onToast(t('attendance.toast_offline_cache'), 'info')
        } else {
          setStudents([])
          onToast(t('attendance.toast_no_cache'), 'warning')
        }
        return
      }

      const res = await fetchApi(`/api/v2/attendance?classId=${selectedClass}&date=${selectedDate}`, { credentials: 'include' }).then(r => r.json())
      const mapped: Record<string, AttStatus> = {}
      let studentList: any[] = []
      if (res.records?.length) {
        res.records.forEach((r: any) => { mapped[r.studentId] = r.status as AttStatus })
          studentList = res.records.map((r: any) => ({ id: r.studentId, name: r.student?.name || t('grades_section.unknown_student'), ...r.student }))
      } else {
        const usersRes = await fetchApi(`/api/v2/users?role=STUDENT&classId=${selectedClass}`, { credentials: 'include' }).then(r => r.json())
        if (usersRes.success && usersRes.data.length) {
          studentList = usersRes.data.map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }))
        }
      }

      // Créneau électif (LV2 ou A-Level) : restreindre à la liste filtrée + en-tête
      let filteredRoster = false
      if (selectedSubject) {
        try {
          const roster = await fetchApi(`/api/v2/teacher/roster?classId=${selectedClass}&subjectId=${selectedSubject}`, { credentials: 'include' }).then(r => r.json())
          if (roster?.success && roster.data.filtered) {
            studentList = roster.data.students.map((s: any) => ({ id: s.id, name: s.name, className: s.className }))
            setRosterLabel(roster.data.label)
            filteredRoster = true
            // Restreindre les statuts pré-chargés aux seuls élèves du roster
            const allowed = new Set<string>(roster.data.students.map((s: any) => s.id))
            for (const k of Object.keys(mapped)) if (!allowed.has(k)) delete mapped[k]
          }
        } catch { /* réseau : on garde la liste complète */ }
      }

      setStudents(studentList)
      setStatuses(mapped)
      if (studentList.length === 0) onToast(t('attendance.toast_no_students'), 'info')
      // Ne pas écraser le cache classe complète avec une liste élective filtrée
      if (!filteredRoster) {
        await putCachedData(`teacher:students:${selectedClass}`, studentList)
      }
    } catch (err: any) {
      setError(err.message || tcommon('status.error'))
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id: string, s: AttStatus) =>
    setStatuses(p => ({ ...p, [id]: p[id] === s ? null : s }))

  const saveAttendance = async () => {
    if (!selectedClass || !students.length) { onToast(t('attendance.toast_nothing_save'), 'warning'); return }
    const presences = Object.entries(statuses)
      .filter(([, v]) => v !== null)
      .map(([studentId, statut]) => ({ studentId, statut }))
    const payload = {
      classId: selectedClass,
      subjectId: selectedSubject || undefined,
      date: selectedDate,
      period: selectedPeriod,
      presences,
    }

    if (!isOnline) {
      await addToQueue({ type: 'ATTENDANCE', endpoint: '/api/v2/attendance', method: 'POST', payload })
      onToast(t('attendance.toast_offline_cache'), 'warning')
      return
    }

    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/attendance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())
      if (res.success) {
        onToast(t('attendance.toast_saved'), 'success')
      } else {
        onToast(res.message || t('attendance.toast_error'), 'error')
      }
    } catch (err: any) {
      onToast(err.message || t('attendance.toast_error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const counts = { P: 0, A: 0, R: 0, E: 0 }
  Object.entries(statuses).forEach(([, s]) => {
    if (s) counts[ATT_SHORT[s]]++
  })

  if (loading && !students.length) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button onClick={loadAttendance}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={13} strokeWidth={2} /> {tcommon('actions.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div style={sTitle}>{t('attendance.title')}</div>
          <div style={sSub}>{t('attendance.subtitle')} · {selectedDate} ({selectedPeriod === 'MORNING' ? 'Matin' : 'Après-midi'})</div>
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 8, padding: '9px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={15} strokeWidth={2} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)' }}>{t('attendance.offline_banner')}</span>
        </div>
      )}

      {/* Filtres responsives compacts */}
      <div className="p-2.5 sm:p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center">
        <select
          className="w-full sm:w-auto h-9"
          style={filterSt}
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
        >
          <option value="">Sélectionne une classe</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          className="w-full sm:w-auto h-9"
          style={filterSt}
          value={selectedSubject}
          onChange={e => setSelectedSubject(e.target.value)}
        >
          <option value="">Matière (optionnelle)</option>
          {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select
          className="w-full sm:w-auto h-9"
          style={filterSt}
          value={selectedPeriod}
          onChange={e => setSelectedPeriod(e.target.value as 'MORNING' | 'AFTERNOON')}
        >
          <option value="MORNING">Matin (07h-12h)</option>
          <option value="AFTERNOON">Après-midi (13h-18h)</option>
        </select>

        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full sm:w-auto h-9"
          style={{ ...filterSt, backgroundImage: 'none', paddingRight: 10, fontFamily: 'inherit' }}
        />

        <button
          className="w-full sm:w-auto h-9 px-4 shrink-0 inline-flex items-center justify-center font-bold"
          style={btnPrim}
          onClick={loadAttendance}
          disabled={loading}
        >
          Charger
        </button>
      </div>

      {rosterLabel && (
        <div style={{ background: 'var(--blue-light)', border: '1.5px solid var(--blue)', borderRadius: 8, padding: '9px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><Target size={15} strokeWidth={2} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--blue)' }}>{rosterLabel}</span>
        </div>
      )}

      {students.length > 0 && (
        <>
          {/* Stats rapides */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Présents', count: counts.P, bg: 'var(--green-light)', color: 'var(--green)' },
              { label: 'Absents',  count: counts.A, bg: 'var(--red-light)', color: 'var(--red)' },
              { label: 'Retards',  count: counts.R, bg: 'var(--amber-light)', color: 'var(--amber)' },
              { label: 'Excusés',  count: counts.E, bg: 'var(--blue-light)', color: 'var(--blue)' },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Action "Tous présents" */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              className="h-10 sm:h-9 px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              style={{ color: 'var(--green)', border: '1.5px solid rgba(142,42,58,0.3)', background: 'var(--green-light)', fontFamily: 'inherit' }}
              onClick={() => {
                const all: Record<string, AttStatus> = {}
                students.forEach(s => { all[s.id] = 'PRESENT' })
                setStatuses(all)
              }}
            >
              <Check size={14} strokeWidth={2.5} />
              <span>Tous présents</span>
            </button>
            <span className="text-xs text-[var(--text3)] font-semibold">
              {students.length} élèves
            </span>
          </div>

          {/* ── VUE MOBILE: Cartes tactiles pour chaque élève ── */}
          <div className="md:hidden space-y-2.5">
            {students.map((student, i) => {
              const shortStatus = ATT_SHORT[statuses[student.id] || ''] || null
              return (
                <div
                  key={student.id}
                  className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-md bg-[var(--bg2)] text-[11px] font-bold text-[var(--text3)] flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-[13px] font-bold text-[var(--text)] truncate">
                        {student.name}
                      </span>
                    </div>
                    {rosterLabel && student.className && (
                      <span className="text-[11px] font-semibold text-[var(--text3)] shrink-0">
                        {student.className}
                      </span>
                    )}
                  </div>

                  {/* 4 boutons tactiles larges */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['P', 'A', 'R', 'E'] as const).map(s => {
                      const sel = shortStatus === s
                      const st = ATT_STYLE[s]
                      const mapping: Record<string, AttStatus> = { P: 'PRESENT', A: 'ABSENT', R: 'LATE', E: 'EXCUSED' }
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggle(student.id, sel ? null : (mapping[s] as AttStatus))}
                          className="h-10 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer"
                          style={{
                            border: `1.5px solid ${sel ? st.selBorder : 'var(--border2)'}`,
                            background: sel ? st.selBg : 'var(--bg)',
                            color: sel ? st.selColor : 'var(--text3)',
                            boxShadow: sel ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                          }}
                        >
                          <span className="text-xs font-black">{s}</span>
                          <span className="text-[9.5px] font-semibold opacity-90 truncate">{attTitle(s).slice(0, 5)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Bouton d'enregistrement mobile */}
            <div className="pt-2 pb-1">
              <button
                className="w-full h-11 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))' }}
                onClick={saveAttendance}
                disabled={loading}
              >
                {loading ? <Save size={15} strokeWidth={2} /> : isOnline ? <CheckCircle2 size={15} strokeWidth={2} /> : <WifiOff size={15} strokeWidth={2} />}
                <span>{loading ? 'Sauvegarde...' : isOnline ? 'Enregistrer les présences' : 'Mettre en file d\'attente'}</span>
              </button>
            </div>
          </div>

          {/* ── VUE DESKTOP: Tableau classique intact ── */}
          <div className="hidden md:block" style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={thSt}>N°</th>
                    <th style={thSt}>Élève</th>
                    {(['P', 'A', 'R', 'E'] as const).map(s => (
                      <th key={s} style={{ ...thSt, textAlign: 'center' }}>{attTitle(s)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, i) => {
                    const shortStatus = ATT_SHORT[statuses[student.id] || ''] || null
                    return (
                      <tr key={student.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={{ ...tdSt, color: 'var(--text3)', width: 38 }}>{i + 1}</td>
                        <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                          {student.name}
                          {rosterLabel && student.className && <span style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11.5 }}> ({student.className})</span>}
                        </td>
                        {(['P', 'A', 'R', 'E'] as const).map(s => {
                          const sel = shortStatus === s
                          const st = ATT_STYLE[s]
                          return (
                            <td key={s} style={{ ...tdSt, textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  const mapping: Record<string, AttStatus> = { P: 'PRESENT', A: 'ABSENT', R: 'LATE', E: 'EXCUSED' }
                                  toggle(student.id, sel ? null : (mapping[s] as AttStatus))
                                }}
                                title={attTitle(s)}
                                style={{
                                  width: 28, height: 28, borderRadius: 6, fontSize: 13,
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800,
                                  border: `1.5px solid ${sel ? st.selBorder : 'var(--border2)'}`,
                                  background: sel ? st.selBg : 'var(--surface)',
                                  color: sel ? st.selColor : 'var(--text3)',
                                  transition: 'all 0.1s'
                                }}>
                                {st.Icon ? <st.Icon size={14} strokeWidth={2.5} /> : st.label}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={saveAttendance} disabled={loading}>
                {loading ? <Save size={14} strokeWidth={2} /> : isOnline ? <CheckCircle2 size={14} strokeWidth={2} /> : <WifiOff size={14} strokeWidth={2} />}
                {loading ? 'Sauvegarde...' : isOnline ? 'Enregistrer les présences' : 'Mettre en file d\'attente'}
              </button>
            </div>
          </div>
        </>
      )}

      {!loading && students.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid var(--border)', padding: 36, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><ClipboardList size={36} strokeWidth={2} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Sélectionne une classe et clique sur Charger</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Pour saisir les présences du jour</div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 24px 5px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238c6b45' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8.5px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
