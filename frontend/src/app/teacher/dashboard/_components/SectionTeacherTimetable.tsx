'use client'
import { useState, useEffect } from 'react'
import { Calendar, RefreshCw } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

type SlotType = { subject: string; classe: string } | null
type GridRow = { start: string; end: string }

const EMPTY_CATCHUP = { open: false, classId: '', proposedDate: '', subjectId: '', proposedStartTime: '', proposedEndTime: '', reason: '', loading: false, error: '' }

export default function SectionTeacherTimetable({ onToast, user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const days = [t('timetable.day_monday'), t('timetable.day_tuesday'), t('timetable.day_wednesday'), t('timetable.day_thursday'), t('timetable.day_friday')]
  const [slots, setSlots] = useState<Record<string, SlotType>>({})
  const [grid, setGrid] = useState<GridRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catchup, setCatchup] = useState(EMPTY_CATCHUP)
  const [catchupClasses, setCatchupClasses] = useState<{ id: string; name: string }[]>([])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi('/api/v2/timetables', { credentials: 'include' }).then(r => r.json())
      if (res.success) {
        // Clé = "dayOfWeek-startTime" (0=Lundi … 4=Vendredi, heure exacte)
        const slotMap: Record<string, SlotType> = {}
        // Dériver la grille horaire depuis les données réelles (startTime uniques triés)
        const rowMap = new Map<string, string>() // startTime → endTime

        const userId = user?.id

        res.data.forEach((tt: any) => {
          (tt.slots || []).forEach((s: any) => {
            // Collecter toutes les plages horaires pour construire la grille
            if (s.startTime && s.endTime) rowMap.set(s.startTime, s.endTime)
            // Filtrer uniquement les créneaux de cet enseignant (User.id)
            if (!userId || s.teacher?.id !== userId) return
            const key = `${s.dayOfWeek}-${s.startTime}`
            slotMap[key] = {
              subject: s.subject?.name || '',
              classe: tt.class?.name || '',
            }
          })
        })

        const sortedGrid: GridRow[] = [...rowMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([start, end]) => ({ start, end }))

        setGrid(sortedGrid)
        setSlots(slotMap)
      } else {
        setError(t('timetable.error_loading'))
      }
    } catch (err: any) {
      setError(err.message || t('timetable.error_network'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [user])

  const openCatchupModal = async () => {
    setCatchup({ ...EMPTY_CATCHUP, open: true })
    try {
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      setCatchupClasses(data.data || [])
    } catch {}
  }

  const submitCatchup = async () => {
    if (!catchup.classId || !catchup.proposedDate) {
      setCatchup(f => ({ ...f, error: t('timetable.catchup_error_required') })); return
    }
    setCatchup(f => ({ ...f, loading: true, error: '' }))
    try {
      const body: Record<string, string> = { classId: catchup.classId, proposedDate: catchup.proposedDate }
      if (catchup.subjectId)          body.subjectId = catchup.subjectId
      if (catchup.proposedStartTime)  body.proposedStartTime = catchup.proposedStartTime
      if (catchup.proposedEndTime)    body.proposedEndTime = catchup.proposedEndTime
      if (catchup.reason.trim())      body.reason = catchup.reason.trim()
      const res = await fetchApi('/api/v2/timetables/catchup-requests', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        let errMsg = data.message || t('timetable.catchup_error_server')
        if (res.status === 409) errMsg = t('timetable.catchup_error_conflict')
        else if (res.status === 400) errMsg = t('timetable.catchup_error_required')
        setCatchup(f => ({ ...f, error: errMsg, loading: false })); return
      }
      onToast(t('timetable.catchup_success'), 'success')
      setCatchup(EMPTY_CATCHUP)
    } catch (err) {
      setCatchup(f => ({ ...f, error: err instanceof Error ? err.message : t('timetable.catchup_error_server'), loading: false }))
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button onClick={fetchData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={13} strokeWidth={2} />{t('timetable.retry')}
          </button>
        </div>
      </div>
    )
  }

  const getWeekRange = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1)
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return t('timetable.week_range').replace('{start}', fmt(monday)).replace('{end}', fmt(friday))
  }

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={sTitle}>{t('timetable.title')}</div>
          <div style={sSub}>{getWeekRange()}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--green-light)', border: '1.5px solid var(--green)' }} />
            {t('timetable.my_courses')}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--bg2)', border: '1.5px solid var(--border2)' }} />
            {t('timetable.free')}
          </span>
          <button onClick={openCatchupModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.35)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Calendar size={13} strokeWidth={2} />{t('timetable.catchup_request')}
          </button>
        </div>
      </div>

      {/* ── Modal demande de rattrapage ── */}
      {catchup.open && (
        <div onClick={() => setCatchup(EMPTY_CATCHUP)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-4 py-5 md:px-6 md:py-6" style={{ background: 'var(--surface)', borderRadius: 14, width: 440, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('timetable.catchup_title')}</div>
            <div style={catchSLb}>{t('timetable.catchup_class_label')}</div>
            <select style={catchSIn} value={catchup.classId} onChange={e => setCatchup(f => ({ ...f, classId: e.target.value }))}>
              <option value="">{t('timetable.catchup_class_placeholder')}</option>
              {catchupClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={catchSLb}>{t('timetable.catchup_date_label')}</div>
            <input style={catchSIn} type="date" value={catchup.proposedDate} onChange={e => setCatchup(f => ({ ...f, proposedDate: e.target.value }))} />
            <div style={catchSLb}>{t('timetable.catchup_subject_label')}</div>
            <select style={catchSIn} value={catchup.subjectId} onChange={e => setCatchup(f => ({ ...f, subjectId: e.target.value }))}>
              <option value="">{t('timetable.catchup_subject_placeholder')}</option>
              {(user?.teacherProfile?.teacherSubjects || []).map(ts => (
                <option key={ts.subject.id} value={ts.subject.id}>{ts.subject.name}</option>
              ))}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={catchSLb}>{t('timetable.catchup_start_label')}</div>
                <input style={catchSIn} type="time" value={catchup.proposedStartTime} onChange={e => setCatchup(f => ({ ...f, proposedStartTime: e.target.value }))} />
              </div>
              <div>
                <div style={catchSLb}>{t('timetable.catchup_end_label')}</div>
                <input style={catchSIn} type="time" value={catchup.proposedEndTime} onChange={e => setCatchup(f => ({ ...f, proposedEndTime: e.target.value }))} />
              </div>
            </div>
            <div style={catchSLb}>{t('timetable.catchup_reason_label')}</div>
            <textarea style={{ ...catchSIn, minHeight: 60, resize: 'vertical' }} value={catchup.reason} onChange={e => setCatchup(f => ({ ...f, reason: e.target.value }))} placeholder={t('timetable.catchup_reason_placeholder')} />
            {catchup.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{catchup.error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button style={{ flex: 1, padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setCatchup(EMPTY_CATCHUP)}>{t('timetable.catchup_cancel')}</button>
              <button style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: catchup.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: catchup.loading ? 0.7 : 1 }} onClick={submitCatchup} disabled={catchup.loading}>
                <Calendar size={13} strokeWidth={2} />{catchup.loading ? t('timetable.catchup_submit_loading') : t('timetable.catchup_submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {grid.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          {t('timetable.empty')}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ ...thSt, width: 85 }}>{t('timetable.header_schedule')}</th>
                  {days.map(d => <th key={d} style={thSt}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {grid.map((row) => (
                  <tr key={row.start}>
                    <td style={{ padding: '6px 8px', background: 'var(--bg2)', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {row.start}<br /><span style={{ fontSize: 10, color: 'var(--text3)' }}>{row.end}</span>
                    </td>
                    {[0, 1, 2, 3, 4].map((day) => {
                      const slot = slots[`${day}-${row.start}`]
                      return (
                        <td key={day} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 120, height: 52 }}>
                          {slot ? (
                            <div
                              style={{
                                padding: '6px 8px', height: '100%', cursor: 'pointer',
                                background: 'linear-gradient(135deg,rgba(5,150,105,0.09),rgba(5,150,105,0.04))',
                                borderLeft: '2.5px solid var(--green)',
                              }}
                              onClick={() => onToast(`${slot.subject} — ${slot.classe}`, 'info')}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green2)', lineHeight: 1.2 }}>{slot.subject}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{slot.classe}</div>
                            </div>
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border2)', fontSize: 16 }}>·</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const thSt: React.CSSProperties = { padding: '8px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }
const catchSLb: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }
const catchSIn: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 12.5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10, outline: 'none' }