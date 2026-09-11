'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { X, AlertTriangle, CalendarDays, Calendar, Bot } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string }
interface TimetableSlot {
  id: string; dayOfWeek: number; startTime: string; endTime: string
  room: string | null; kind: string
  subject: { id: string; name: string } | null
  teacher: { id: string; firstName: string; lastName: string } | null
}
interface Timetable {
  id: string; classId: string; status: string; generatedByAI: boolean
  class: { id: string; name: string }
  slots: TimetableSlot[]
}
interface PeriodeGrille {
  ordre: number; debut: string; fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'; duree: number
}
interface GenResult {
  classId: string; className: string; timetableId: string; slotsCreated: number; isNew: boolean
}
interface UnplacedItem {
  classId: string; className: string; subjectId: string; subjectName: string
  teacherName: string; explication: string
}
interface GenResults {
  results: GenResult[]
  skipped: { classId: string; className: string; reason: string }[]
  unplaced: UnplacedItem[]
  stats: { classesTraitees: number; classesIgnorees: number; slotsTotal: number; coursNonPlaces: number }
}

const DAY_MAP: Record<string, number> = {
  LUNDI: 0, MARDI: 1, MERCREDI: 2, JEUDI: 3, VENDREDI: 4, SAMEDI: 5,
}

const SUBJECT_PALETTES = [
  { bg: 'rgba(5,150,105,0.10)', border: 'var(--green)', text: 'var(--green2)' },
  { bg: 'rgba(37,99,235,0.09)', border: 'var(--blue)', text: 'var(--blue)' },
  { bg: 'rgba(217,119,6,0.09)', border: 'var(--amber)', text: 'var(--amber)' },
  { bg: 'rgba(139,92,246,0.09)', border: 'var(--purple)', text: 'var(--purple)' },
  { bg: 'rgba(236,72,153,0.09)', border: '#db2777', text: '#be185d' },
  { bg: 'rgba(20,184,166,0.09)', border: 'var(--teal)', text: 'var(--teal)' },
]
function subjectColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return SUBJECT_PALETTES[Math.abs(hash) % SUBJECT_PALETTES.length]
}

export default function SectionTimetable({ onToast }: Props) {
  const t = useT('admin')
  const [classes, setClasses]                 = useState<ClassItem[]>([])
  const [classId, setClassId]                 = useState('')
  const [timetable, setTimetable]             = useState<Timetable | null>(null)
  const [squelette, setSquelette]             = useState<PeriodeGrille[]>([])
  const [joursActifs, setJoursActifs]         = useState<string[]>(['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
  const [loading, setLoading]                 = useState(false)
  const [loadingClasses, setLoadingClasses]   = useState(true)
  const [publishing, setPublishing]           = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  const [adjustInstruction, setAdjustInstruction] = useState('')
  const [adjusting, setAdjusting]             = useState(false)
  const [adjustResult, setAdjustResult]       = useState<{ applied: string[]; errors: string[]; message: string } | null>(null)

  const [mobileDay, setMobileDay]             = useState('LUNDI')

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()),
    ]).then(([classData, configData]) => {
      setClasses(classData.data || [])
      if (configData.data) {
        setSquelette(configData.data.squelette || [])
        setJoursActifs(configData.data.config?.joursActifs || ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
      }
    }).catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  const fetchTimetable = useCallback(async (cid?: string) => {
    const id = cid ?? classId
    if (!id) return
    setLoading(true); setError(null)
    try {
      const res = await fetchApi(`/api/v2/timetables?classId=${id}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.err'))
      const list: Timetable[] = data.data || []
      setTimetable(list[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('timetable.errLoad'))
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'timetable' && classId) fetchTimetable()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchTimetable, classId])

  const handleClassChange = (newId: string) => {
    setClassId(newId); setTimetable(null); setError(null); setAdjustResult(null); setAdjustInstruction('')
    if (newId) fetchTimetable(newId)
  }

  const handlePublish = async () => {
    if (!timetable) return
    setPublishing(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/publish`, {
        method: 'PUT', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.err'))
      onToast(t('timetable.published'), 'success')
      fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.errPublish'), 'error')
    } finally {
      setPublishing(false)
    }
  }

  const handleAdjust = async () => {
    if (!timetable || !adjustInstruction.trim()) return
    setAdjusting(true); setAdjustResult(null)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ instruction: adjustInstruction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.err'))
      setAdjustResult(data.data)
      if (data.data.applied?.length) {
        onToast(data.data.message, 'success')
        setAdjustInstruction('')
        fetchTimetable()
      } else {
        onToast(data.data.message, 'info')
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.errAI'), 'error')
    } finally {
      setAdjusting(false)
    }
  }

  const slots = timetable?.slots ?? []
  const slotMap = new Map<string, TimetableSlot>()
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.startTime}`, s)

  const joursNumeriques = joursActifs.map(j => DAY_MAP[j]).filter((d): d is number => d !== undefined)
  const hasGridConfig = squelette.length > 0
  const fallbackTimes = hasGridConfig ? [] : Array.from(new Set(slots.map(s => s.startTime))).sort()
  const displayDays = hasGridConfig ? joursActifs : ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
  const effectiveMobileDay = displayDays.includes(mobileDay) ? mobileDay : displayDays[0]

  const totalCours = slots.filter(s => s.kind === 'CLASS').length
  const remplis    = slots.filter(s => s.kind === 'CLASS' && s.subject).length
  const pct        = totalCours > 0 ? Math.round(remplis / totalCours * 100) : 0

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-3" style={{ marginBottom: 13 }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('timetable.title')}</div>
          <div className="text-[13px] md:text-[13px]" style={sSub}>
            {timetable
              ? `${timetable.class.name} — ${t('timetable.slotsFilled', { filled: remplis, total: totalCours })} · ${timetable.status === 'PUBLISHED' ? t('timetable.statusPublished') : timetable.generatedByAI ? t('timetable.statusAIDraft') : t('timetable.statusDraft')}`
              : t('timetable.selectOrGen')}
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 md:gap-[10px] md:items-center">
          <select value={classId} onChange={e => handleClassChange(e.target.value)}
            className="w-full md:w-auto rounded-[8px] md:rounded-[10px] px-[13px] py-[11px] md:px-[12px] md:py-[8px] text-[13px] md:text-[13px] font-bold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none"
            style={{ ...selectSt, border: undefined, borderRadius: undefined, padding: undefined, fontSize: undefined }} disabled={loadingClasses}>
            <option value="">{loadingClasses ? t('timetable.loading') : t('timetable.selectClass')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="flex flex-wrap gap-2 md:gap-[10px] md:items-center">
            {timetable && timetable.status !== 'PUBLISHED' && (
              <button className="text-[12.5px] md:text-[13px] font-semibold md:font-bold rounded-full md:rounded-[11px] px-[14px] py-[10px] md:px-3.5 md:py-[10px]" style={{ ...btnPrim, borderRadius: undefined, padding: undefined, fontSize: undefined, fontWeight: undefined }} onClick={handlePublish} disabled={publishing}>
                {publishing ? <><span style={spinInline} />{t('timetable.publishing')}</> : t('timetable.publishBtn')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="text-[12px] md:text-[13px] px-[12px] py-[9px] md:px-[14px] md:py-[10px]" style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 8, marginBottom: 12, color: 'var(--blue)' }}>
        <strong>{t('timetable.bannerRole')}</strong> {t('timetable.bannerText1')} <strong>{t('timetable.bannerCenseur')}</strong> {t('timetable.bannerText2')} <strong>{t('timetable.bannerAutoGen')}</strong> {t('timetable.bannerText3')} <strong>{t('timetable.bannerPublish')}</strong>.
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div className="flex-wrap gap-[10px] md:gap-[12px] px-[14px] py-2.5 md:px-[18px] md:py-[14px]" style={{ background: 'var(--red-light)', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
          <AlertTriangle size={16} strokeWidth={2} color="var(--red)" />
          <span className="text-[13px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={() => fetchTimetable()} className="w-full md:w-auto text-[13px] md:text-[13px] px-[12px] md:px-[14px] py-[7px] md:py-[9px]" style={{ ...btnSec, padding: undefined, fontSize: undefined }}>{t('timetable.retry')}</button>
        </div>
      )}

      {!loading && !error && !classId && (
        <div className="p-[20px] md:px-[24px] md:py-[40px]" style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><CalendarDays size={16} strokeWidth={1.5} className="md:hidden" /><CalendarDays size={16} strokeWidth={1.5} className="hidden md:block" /></div>
          <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('timetable.selectClassTitle')}</div>
          <div className="text-[13px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{t('timetable.selectClassHint')}</div>
        </div>
      )}

      {!loading && !error && classId && !timetable && (
        <div className="p-[20px] md:px-[24px] md:py-[40px]" style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Calendar size={16} strokeWidth={1.5} className="md:hidden" /><Calendar size={16} strokeWidth={1.5} className="hidden md:block" /></div>
          <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('timetable.noTimetable')}</div>
          <div className="text-[13px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{t('timetable.noTimetableHint')}</div>
        </div>
      )}

      {!loading && !error && timetable && (
        <div className="rounded-none md:rounded-[10px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]" style={{ overflow: 'hidden' }}>
          <div className="rounded-[8px] md:rounded-none mb-3 md:mb-0 shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none flex-wrap md:flex-nowrap bg-[var(--surface)] md:bg-[var(--bg)] md:border-b md:border-[var(--border)]" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{t('timetable.slotsCount', { filled: remplis, total: totalCours })}</span>
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden', minWidth: 60 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--amber)', transition: 'width 0.3s', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? 'var(--green)' : 'var(--amber)' }}>{pct}%</span>
            {timetable.generatedByAI && <span style={{ fontSize: 12, background: 'var(--purple-light)', color: 'var(--purple)', fontWeight: 700, borderRadius: 10, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Bot size={12} strokeWidth={2} /> IA</span>}
            {timetable.status === 'PUBLISHED' && <span style={{ fontSize: 12, background: 'var(--green-light)', color: 'var(--green)', fontWeight: 700, borderRadius: 10, padding: '3px 10px' }}>{t('timetable.statusPublished')}</span>}
            {timetable.status !== 'PUBLISHED' && <span style={{ fontSize: 12, background: 'var(--amber-light)', color: 'var(--amber)', fontWeight: 700, borderRadius: 10, padding: '3px 10px' }}>{t('timetable.statusDraft')}</span>}
          </div>

          {slots.length === 0 ? (
            <div className="text-[13px] md:text-[13px] px-[16px] py-[32px] md:px-3.5 md:py-[32px]" style={{ textAlign: 'center', color: 'var(--text3)' }}>
              {t('timetable.skeletonEmpty')}
            </div>
          ) : (
            <>
            <div className="md:hidden">
              <div className="relative -mr-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex gap-[6px] overflow-x-auto" style={{ padding: '2px 20px 4px', scrollbarWidth: 'none' }}>
                  {displayDays.map(j => {
                    const active = effectiveMobileDay === j
                    return (
                      <button key={j} onClick={() => setMobileDay(j)}
                        className="relative flex-shrink-0 rounded-full px-[14px] py-[9px] whitespace-nowrap border-0"
                        style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {active && (
                          <motion.div layoutId="timetable-day-pill" className="absolute inset-0 rounded-full"
                            style={{ background: 'var(--sidebar)' }}
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                        )}
                        <span className="relative z-10" style={{ fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? '#fff' : 'var(--text3)' }}>
                          {t(`timetable.days.${j}`)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="pointer-events-none absolute top-0 right-0 bottom-1 w-7 md:hidden" style={{ background: 'linear-gradient(90deg,transparent,var(--bg) 65%)' }} />
              </div>
              <div className="p-3" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hasGridConfig ? squelette.map((periode, idx) => {
                  if (periode.type !== 'COURS') {
                    const isPetite = periode.type === 'PETITE_PAUSE'
                    return (
                      <div key={`m-pause-${idx}`} className="rounded-[8px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
                        <div style={{ width: 56, flexShrink: 0, padding: '10px 8px', background: 'var(--bg2)', fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textAlign: 'center' }}>
                          {periode.debut}<br /><span style={{ fontSize: 9 }}>{periode.fin}</span>
                        </div>
                        <div style={{ flex: 1, padding: '10px 12px', background: 'var(--amber-light)', borderLeft: '3px solid var(--amber)', display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')}</span>
                        </div>
                      </div>
                    )
                  }
                  const slot = slotMap.get(`${DAY_MAP[effectiveMobileDay]}-${periode.debut}`)
                  const col = slot?.subject ? subjectColor(slot.subject.id) : null
                  return (
                    <div key={`m-cours-${periode.debut}`} className="rounded-[8px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
                      <div style={{ width: 56, flexShrink: 0, padding: '10px 8px', background: 'var(--bg2)', fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textAlign: 'center' }}>
                        {periode.debut}<br /><span style={{ fontSize: 9 }}>{periode.fin}</span>
                      </div>
                      <div style={{ flex: 1, padding: '10px 12px', background: slot?.subject ? col!.bg : 'var(--surface)', borderLeft: slot?.subject ? `3px solid ${col!.border}` : 'none' }}>
                        {slot?.subject ? (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 800, color: col!.text }}>{slot.subject.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                              {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: 'var(--amber)' }}>{t('timetable.noTeacher')}</span>}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 13, color: 'var(--text3)' }}>—</div>
                        )}
                      </div>
                    </div>
                  )
                }) : fallbackTimes.map(time => {
                  const d = DAY_MAP[effectiveMobileDay]
                  const slot = slotMap.get(`${d}-${time}`)
                  const col = slot?.subject ? subjectColor(slot.subject.id) : null
                  return (
                    <div key={`m-${time}`} className="rounded-[8px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
                      <div style={{ width: 56, flexShrink: 0, padding: '10px 8px', background: 'var(--bg2)', fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textAlign: 'center' }}>{time}</div>
                      <div style={{ flex: 1, padding: '10px 12px', background: slot?.subject ? col!.bg : 'var(--surface)', borderLeft: slot?.subject ? `3px solid ${col!.border}` : 'none' }}>
                        {slot?.subject ? (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 800, color: col!.text }}>{slot.subject.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '—'}</div>
                          </>
                        ) : <div style={{ fontSize: 13, color: 'var(--text3)' }}>—</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ ...thSt, width: 100 }}>{t('timetable.schedule')}</th>
                    {(hasGridConfig ? joursActifs : ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']).map(j => (
                      <th key={j} style={thSt}>{t(`timetable.days.${j}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasGridConfig ? (
                    squelette.map((periode, idx) => {
                      if (periode.type !== 'COURS') {
                        const isPetite = periode.type === 'PETITE_PAUSE'
                        return (
                          <tr key={`pause-${idx}`}>
                            <td colSpan={joursActifs.length + 1}
                              style={{ textAlign: 'center', padding: '5px 12px', background: 'var(--amber-light)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>
                              {isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')} — {periode.debut} {t('timetable.to')} {periode.fin}
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={`cours-${periode.debut}`}>
                          <td style={{ padding: '8px 10px', background: 'var(--bg)', fontSize: 13, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            {periode.debut}<br /><span style={{ fontSize: 11 }}>{periode.fin}</span>
                          </td>
                          {joursActifs.map(jour => {
                            const slot = slotMap.get(`${DAY_MAP[jour]}-${periode.debut}`)
                            const col = slot?.subject ? subjectColor(slot.subject.id) : null
                            return (
                              <td key={jour} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 110, height: 56 }}>
                                {slot?.subject ? (
                                  <div style={{ padding: '8px 10px', height: '100%', background: col!.bg, borderLeft: `3px solid ${col!.border}`, boxSizing: 'border-box' }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: col!.text, lineHeight: 1.2 }}>{slot.subject.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                                      {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: 'var(--amber)' }}>{t('timetable.noTeacher')}</span>}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ height: '100%', background: 'var(--bg)' }} />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  ) : (
                    fallbackTimes.map(time => (
                      <tr key={time}>
                        <td style={{ padding: '8px 10px', background: 'var(--bg)', fontSize: 13, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {time}
                        </td>
                        {[1,2,3,4,5].map(d => {
                          const slot = slotMap.get(`${d}-${time}`)
                          const col = slot?.subject ? subjectColor(slot.subject.id) : null
                          return (
                            <td key={d} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 110, height: 56 }}>
                              {slot?.subject ? (
                                <div style={{ padding: '8px 10px', height: '100%', background: col!.bg, borderLeft: `3px solid ${col!.border}`, boxSizing: 'border-box' }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: col!.text }}>{slot.subject.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                                    {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '—'}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ height: '100%' }} />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {timetable && timetable.status !== 'PUBLISHED' && (
        <div className="rounded-[10px] md:rounded-[10px] p-[14px] md:px-3.5 md:py-[14px]" style={{ marginTop: 16, background: 'var(--surface)', border: '1.5px solid var(--border2)' }}>
          <div className="text-[12px] md:text-[13px]" style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{t('timetable.adjustTitle')}</div>
          <div className="text-[12px] md:text-[13px]" style={{ color: 'var(--text3)', marginBottom: 12 }}>
            {t('timetable.adjustHint')}
          </div>
          <div className="flex-col md:flex-row" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <textarea
              value={adjustInstruction}
              onChange={e => setAdjustInstruction(e.target.value)}
              placeholder={t('timetable.adjustPlaceholder')}
              rows={2}
              className="w-full text-[13px] md:text-[12px]"
              style={{ flex: 1, padding: '10px 13px', border: '1.5px solid var(--border2)', borderRadius: 8, fontFamily: 'inherit', resize: 'vertical', outline: 'none', color: 'var(--text)' }}
            />
            <button
              className="w-full md:w-auto justify-center"
              style={{ ...btnAI, alignSelf: 'flex-end', opacity: adjusting || !adjustInstruction.trim() ? 0.6 : 1 }}
              disabled={adjusting || !adjustInstruction.trim()}
              onClick={handleAdjust}
            >
              {adjusting ? <><span style={spinInline} />{t('timetable.processing')}</> : t('timetable.apply')}
            </button>
          </div>

          {adjustResult && (
            <div style={{ marginTop: 12 }}>
              {adjustResult.applied.length > 0 && (
                <div style={{ background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', marginBottom: 4 }}>{t('timetable.changesApplied')}</div>
                  {adjustResult.applied.map((a, i) => <div key={i} style={{ fontSize: 13, color: 'var(--green)' }}>• {a}</div>)}
                </div>
              )}
              {adjustResult.errors.length > 0 && (
                <div style={{ background: 'var(--red-light)', border: '1px solid var(--red-light)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)', marginBottom: 4 }}>{t('timetable.conflicts')}</div>
                  {adjustResult.errors.map((e, i) => <div key={i} style={{ fontSize: 13, color: 'var(--red)' }}>• {e}</div>)}
                </div>
              )}
              {adjustResult.applied.length === 0 && adjustResult.errors.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>{adjustResult.message}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const sTitle:    React.CSSProperties = { fontFamily: 'var(--font-spectral,Spectral,serif)', fontWeight: 700, color: 'var(--text)' }
const sSub:      React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnPrim:   React.CSSProperties = { padding: '10px 14px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnAI:     React.CSSProperties = { padding: '10px 14px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--purple),var(--purple))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnSec:    React.CSSProperties = { padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt:  React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt:      React.CSSProperties = { padding: '10px 8px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }
const spinInline: React.CSSProperties = { display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle' }
