'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { X, AlertTriangle, CalendarDays, Calendar, Bot } from 'lucide-react'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'

import type { AdminSection } from '../_types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: AdminSection) => void
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
  { bg: 'rgba(236,72,153,0.09)', border: 'var(--red)', text: 'var(--red)' },
  { bg: 'rgba(142,42,58,0.09)', border: 'var(--primary)', text: 'var(--primary)' },
]
function subjectColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return SUBJECT_PALETTES[Math.abs(hash) % SUBJECT_PALETTES.length]
}

export default function SectionTimetable({ onToast, onNav }: Props) {
  const t = useT('admin')
  const [classes, setClasses]                 = useState<ClassItem[]>([])
  const [classId, setClassId]                 = useState('')
  const [timetable, setTimetable]             = useState<Timetable | null>(null)
  const [squelette, setSquelette]             = useState<PeriodeGrille[]>([])
  const [squeletteParJour, setSqueletteParJour] = useState<Record<string, PeriodeGrille[]>>({})
  const [joursActifs, setJoursActifs]         = useState<string[]>(['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
  const [loading, setLoading]                 = useState(false)
  const [loadingClasses, setLoadingClasses]   = useState(true)
  const [publishing, setPublishing]           = useState(false)
  const [publishingAll, setPublishingAll]     = useState(false)
  const [reopening, setReopening]             = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  // Auto-generation state

  // Groq adjustment state
  const [adjustInstruction, setAdjustInstruction] = useState('')
  const [adjusting, setAdjusting]             = useState(false)
  const [adjustResult, setAdjustResult]       = useState<{ applied: string[]; errors: string[]; message: string } | null>(null)

  // Vue mobile : un jour a la fois (onglets) au lieu de la grille complete, illisible en dessous de md.
  const [mobileDay, setMobileDay]             = useState('LUNDI')

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()),
    ]).then(([classData, configData]) => {
      setClasses(classData.data || [])
      if (configData.data) {
         setSquelette(configData.data.squelette || [])
         setSqueletteParJour(configData.data.squeletteParJour || {})

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

  // Rafraîchissement temps réel quand l'assistant IA publie/modifie un emploi du temps.
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

  const handlePublishAll = async () => {
    setPublishingAll(true)
    try {
      const res = await fetchApi('/api/v2/timetables/publish-all', {
        method: 'PUT', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.errPublish'))
      onToast(t('timetable.publishedAllSuccess', { count: data.data?.publies ?? 0 }), 'success')
      if (classId) fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.errPublish'), 'error')
    } finally {
      setPublishingAll(false)
    }
  }

  const handleReopen = async () => {
    if (!timetable || !window.confirm(t('timetable.reopenConfirm'))) return
    setReopening(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/reopen`, {
        method: 'PUT', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.reopenError'))
      onToast(t('timetable.reopenSuccess'), 'success')
      fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.reopenError'), 'error')
    } finally {
      setReopening(false)
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

  // filter sur undefined et non sur la véracité : `.filter(Boolean)` supprimerait le lundi (0).
  const joursNumeriques = joursActifs.map(j => DAY_MAP[j]).filter((d): d is number => d !== undefined)
  const hasGridConfig = squelette.length > 0
  const fallbackTimes = hasGridConfig ? [] : Array.from(new Set(slots.map(s => s.startTime))).sort()
  const displayDays = hasGridConfig ? joursActifs : ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
  const effectiveMobileDay = displayDays.includes(mobileDay) ? mobileDay : displayDays[0]

  const totalCours = hasGridConfig
    ? (Object.keys(squeletteParJour).length > 0
        ? joursActifs.reduce((total, jour) => total + (squeletteParJour[jour] ?? squelette).filter(periode => periode.type === 'COURS').length, 0)
        : squelette.filter(periode => periode.type === 'COURS').length * joursNumeriques.length)
    : slots.filter(s => s.kind === 'CLASS').length
  const remplis    = slots.filter(s => s.kind === 'CLASS' && s.subject).length
  const pct        = totalCours > 0 ? Math.round(remplis / totalCours * 100) : 0

  const [generating, setGenerating]           = useState(false)

  const handleProposeSchedule = async () => {
    if (!classId) return
    setGenerating(true)
    try {
      let targetId = timetable?.id
      if (!targetId) {
        const createRes = await fetchApi('/api/v2/timetables/manual', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classId }),
        })
        const createData = await createRes.json()
        targetId = createData.data?.id
      }
      if (!targetId) throw new Error(t('timetable.errGen'))

      const res = await fetchApi(`/api/v2/timetables/${targetId}/propose-schedule`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.errGen'))
      onToast('Génération automatique d\'emploi du temps réussie', 'success')
      fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.errGen'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box', paddingBottom: 140 }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="text-[15px] md:text-[17px] font-bold font-spectral" style={{ color: 'var(--text)' }}>
            {t('timetable.title')}
          </h1>
          <p className="text-[11px] md:text-[12px] font-medium mt-0.5" style={{ color: 'var(--text3)' }}>
            {timetable
              ? `${timetable.class.name} — ${t('timetable.slotsFilled', { filled: remplis, total: totalCours })} · ${timetable.status === 'PUBLISHED' ? t('timetable.statusPublished') : timetable.status === 'SUBMITTED' ? t('timetable.statusSubmitted') : timetable.generatedByAI ? t('timetable.statusAIDraft') : t('timetable.statusDraft')}`
              : t('timetable.selectOrGen')}
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-2.5 md:items-center">
          <select value={classId} onChange={e => handleClassChange(e.target.value)}
            className="w-full md:w-auto rounded-lg px-3.5 py-2 text-xs md:text-sm font-bold border border-[var(--border2)] bg-[var(--surface)]"
            disabled={loadingClasses}>
            <option value="">{loadingClasses ? t('timetable.loading') : t('timetable.selectClass')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="flex flex-wrap gap-2.5 md:items-center">
            {classId && (
              <button className="text-xs md:text-sm font-bold rounded-lg px-3.5 py-2"
                style={btnSec}
                onClick={handleProposeSchedule} disabled={generating || timetable?.status === 'SUBMITTED' || timetable?.status === 'PUBLISHED'}>
                {generating ? <><span style={spinInline} />{t('timetable.generating')}</> : <><Bot size={15} className="inline mr-1" />{t('timetable.autoGen')}</>}
              </button>
            )}
            <button className="text-xs md:text-sm font-bold rounded-lg px-3.5 py-2"
              style={btnSec}
              onClick={handlePublishAll}
              disabled={publishingAll || publishing || reopening}>
              {publishingAll ? <><span style={spinInline} />{t('timetable.publishingAll')}</> : t('timetable.publishAllBtn')}
            </button>
            {timetable?.status === 'SUBMITTED' && (
              <button className="text-xs md:text-sm font-bold rounded-lg px-3.5 py-2" style={btnPrim} onClick={handlePublish} disabled={publishing}>
                {publishing ? <><span style={spinInline} />{t('timetable.publishing')}</> : t('timetable.publishBtn')}
              </button>
            )}
            {timetable?.status === 'PUBLISHED' && (
              <button className="text-xs md:text-sm font-bold rounded-lg px-3.5 py-2" style={btnSec} onClick={handleReopen} disabled={reopening || publishing}>
                {reopening ? <><span style={spinInline} />{t('timetable.reopening')}</> : t('timetable.reopenBtn')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Supervision Banner */}
      <DelegationSupervisionBanner actorTitle="Censeur / Chef des Travaux" domainLabel="Emplois du Temps & Plannings" onNav={onNav} />

      {/* RACI Governance Notice */}
      <div className="mb-4 p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 text-xs text-[var(--text)] flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-600 flex-shrink-0">
            <CalendarDays size={16} />
          </div>
          <div>
            <p className="font-bold text-xs md:text-sm">Validation & Publication des Emplois du Temps</p>
            <p className="text-xs text-[var(--text2)]">L'élaboration technique des créneaux et plannings est assurée par le Censeur. L'Administrateur supervise la résolution des conflits et effectue la publication officielle.</p>
          </div>
        </div>
      </div>

      {/* Panel résultats génération */}

      {/* Chargement */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 70 }}>
          <div style={{ width: 34, height: 34, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Erreur */}
      {!loading && error && (
        <div className="flex-wrap gap-3 p-4 bg-[var(--red-light)] rounded-xl flex items-center">
          <AlertTriangle size={16} strokeWidth={2} color="var(--red)" />
          <span className="text-xs md:text-sm font-bold text-[var(--red)] flex-1">{error}</span>
          <button onClick={() => fetchTimetable()} className="w-full md:w-auto text-xs md:text-sm px-3.5 py-1.5" style={btnSec}>{t('timetable.retry')}</button>
        </div>
      )}

      {/* Pas de classe */}
      {!loading && !error && !classId && (
        <div className="px-6 py-10 text-center bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <div className="flex justify-center mb-2.5 text-[var(--text3)]"><CalendarDays size={38} strokeWidth={1.5} /></div>
          <div className="text-sm md:text-base font-bold text-[var(--text)] mb-1">{t('timetable.selectClassTitle')}</div>
          <div className="text-xs md:text-sm font-medium text-[var(--text3)]">{t('timetable.selectClassHint')}</div>
        </div>
      )}

      {/* Classe sélectionnée, pas d'EDT */}
      {!loading && !error && classId && !timetable && (
        <div className="px-6 py-10 text-center bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <div className="flex justify-center mb-2.5 text-[var(--text3)]"><Calendar size={38} strokeWidth={1.5} /></div>
          <div className="text-sm md:text-base font-bold text-[var(--text)] mb-1">{t('timetable.noTimetable')}</div>
          <div className="text-xs md:text-sm font-medium text-[var(--text3)]">{t('timetable.noTimetableHint')}</div>
        </div>
      )}

      {/* Grille lecture seule */}
      {!loading && !error && timetable && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          {/* Barre progression */}
          <div className="mb-0 px-4 py-3 flex items-center gap-3.5 flex-wrap md:flex-nowrap bg-[var(--bg)] border-b border-[var(--border)]">
            <span className="text-xs md:text-sm font-bold text-[var(--text2)] whitespace-nowrap">{t('timetable.slotsCount', { filled: remplis, total: totalCours })}</span>
            <div className="flex-1 bg-[var(--border)] rounded-full h-2 overflow-hidden min-w-[60px]">
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--amber)', transition: 'width 0.3s', borderRadius: 4 }} />
            </div>
            <span className="text-xs md:text-sm font-extrabold" style={{ color: pct === 100 ? 'var(--green)' : 'var(--amber)' }}>{pct}%</span>
            {timetable.generatedByAI && <span className="text-xs bg-[var(--purple-light)] color-[var(--purple)] font-bold rounded-full px-3 py-0.5 inline-flex items-center gap-1"><Bot size={12} strokeWidth={2} /> IA</span>}
             {timetable.status === 'PUBLISHED' && <span className="text-xs bg-[var(--green-light)] color-[var(--green)] font-bold rounded-full px-3 py-0.5">{t('timetable.statusPublished')}</span>}
             {timetable.status === 'SUBMITTED' && <span className="text-xs bg-[var(--blue-light)] color-[var(--blue)] font-bold rounded-full px-3 py-0.5">{t('timetable.statusSubmitted')}</span>}
             {timetable.status === 'DRAFT' && <span className="text-xs bg-[var(--amber-light)] color-[var(--amber)] font-bold rounded-full px-3 py-0.5">{t('timetable.statusDraft')}</span>}
          </div>

          {slots.length === 0 ? (
            <div className="text-xs md:text-sm px-4 py-10 text-center text-[var(--text3)]">
              {t('timetable.skeletonEmpty')}
            </div>
          ) : (
            <>
            {/* ── Vue jour-par-jour — mobile ── */}
            <div className="md:hidden">
              <div className="relative -mr-4 border-b border-[var(--border)]">
                <div className="flex gap-1.5 overflow-x-auto p-2 scrollbar-none">
                  {displayDays.map(j => {
                    const active = effectiveMobileDay === j
                    return (
                      <button key={j} onClick={() => setMobileDay(j)}
                        className="relative flex-shrink-0 rounded-full px-3.5 py-1.5 whitespace-nowrap border-0 cursor-pointer font-inherit">
                        {active && (
                          <motion.div layoutId="timetable-day-pill" className="absolute inset-0 rounded-full"
                            style={{ background: 'var(--sidebar)' }}
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                        )}
                        <span className="relative z-10 text-xs font-bold" style={{ color: active ? '#fff' : 'var(--text3)' }}>
                          {t(`timetable.days.${j}`)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="p-3 flex flex-col gap-2.5">
                {hasGridConfig ? squelette.map((periode, idx) => {
                  if (periode.type !== 'COURS') {
                    const isPetite = periode.type === 'PETITE_PAUSE'
                    return (
                      <div key={`m-pause-${idx}`} className="rounded-lg shadow-xs flex items-stretch overflow-hidden">
                        <div className="w-14 flex-shrink-0 p-2.5 bg-[var(--bg2)] text-[10.5px] font-bold text-[var(--text3)] text-center">
                          {periode.debut}<br /><span className="text-[9.5px]">{periode.fin}</span>
                        </div>
                        <div className="flex-1 p-2.5 bg-[var(--amber-light)] border-l-2 border-[var(--amber)] flex items-center">
                          <span className="text-xs font-bold text-[var(--amber)]">{isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')}</span>
                        </div>
                      </div>
                    )
                  }
                   const slot = slotMap.get(`${DAY_MAP[effectiveMobileDay]}-${periode.debut}`)
                   const courseActive = (squeletteParJour[effectiveMobileDay] ?? squelette).some(periodeJour => periodeJour.type === 'COURS' && periodeJour.debut === periode.debut && periodeJour.fin === periode.fin)
                   const col = slot?.subject ? subjectColor(slot.subject.id) : null

                  return (
                     <div key={`m-cours-${periode.debut}`} className="rounded-lg shadow-xs flex items-stretch overflow-hidden">
                       <div className="w-14 flex-shrink-0 p-2.5 bg-[var(--bg2)] text-[10.5px] font-bold text-[var(--text3)] text-center">
                         {periode.debut}<br /><span className="text-[9.5px]">{periode.fin}</span>
                       </div>
                       <div className="flex-1 p-2.5" style={{ background: slot?.kind === 'FREE' ? 'var(--blue-light)' : slot?.subject ? col!.bg : 'var(--surface)', borderLeft: slot?.kind === 'FREE' ? '3px solid var(--blue)' : slot?.subject ? `3px solid ${col!.border}` : 'none', opacity: courseActive ? 1 : 0.4 }}>
                          {!courseActive ? (
                            <div className="text-xs text-[var(--text3)]">—</div>
                          ) : slot?.kind === 'FREE' ? (

                           <div className="text-xs md:text-sm font-bold text-[var(--blue)]">{t('timetable.freeTime')}</div>
                         ) : slot?.subject ? (
                           <>
                             <div className="text-xs md:text-sm font-bold" style={{ color: col!.text }}>{slot.subject.name}</div>
                             <div className="text-[11.5px] text-[var(--text3)] mt-0.5">
                               {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: 'var(--amber)' }}>{t('timetable.noTeacher')}</span>}
                             </div>
                             {slot.room && <div className="text-[10.5px] text-[var(--text3)] mt-0.5">{t('timetable.roomLabel')} {slot.room}</div>}
                           </>
                         ) : (
                           <div className="text-xs text-[var(--text3)]">—</div>
                         )}
                      </div>
                    </div>
                  )
                }) : fallbackTimes.map(time => {
                  const d = DAY_MAP[effectiveMobileDay]
                  const slot = slotMap.get(`${d}-${time}`)
                  const col = slot?.subject ? subjectColor(slot.subject.id) : null
                  return (
                    <div key={`m-${time}`} className="rounded-lg shadow-xs flex items-stretch overflow-hidden">
                      <div className="w-14 flex-shrink-0 p-2.5 bg-[var(--bg2)] text-[10.5px] font-bold text-[var(--text3)] text-center">{time}</div>
                      <div className="flex-1 p-2.5" style={{ background: slot?.kind === 'FREE' ? 'var(--blue-light)' : slot?.subject ? col!.bg : 'var(--surface)', borderLeft: slot?.kind === 'FREE' ? '3px solid var(--blue)' : slot?.subject ? `3px solid ${col!.border}` : 'none' }}>
                         {slot?.kind === 'FREE' ? (
                           <div className="text-xs md:text-sm font-bold text-[var(--blue)]">{t('timetable.freeTime')}</div>
                         ) : slot?.subject ? (
                           <>
                             <div className="text-xs md:text-sm font-bold" style={{ color: col!.text }}>{slot.subject.name}</div>
                             <div className="text-[11.5px] text-[var(--text3)] mt-0.5">{slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '—'}</div>
                             {slot.room && <div className="text-[10.5px] text-[var(--text3)] mt-0.5">{t('timetable.roomLabel')} {slot.room}</div>}
                           </>
                         ) : <div className="text-xs text-[var(--text3)]">—</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Grille complete — desktop ── */}
            <div className="hidden md:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ ...thSt, width: 95 }}>{t('timetable.schedule')}</th>
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
                              style={{ textAlign: 'center', padding: '5px 12px', background: 'var(--amber-light)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: 11.5, fontWeight: 700, color: 'var(--amber)' }}>
                              {isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')} — {periode.debut} {t('timetable.to')} {periode.fin}
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={`cours-${periode.debut}`}>
                          <td style={{ padding: '7px 9px', background: 'var(--bg)', fontSize: 12, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            {periode.debut}<br /><span style={{ fontSize: 10.5 }}>{periode.fin}</span>
                          </td>
                          {joursActifs.map(jour => {
                             const slot = slotMap.get(`${DAY_MAP[jour]}-${periode.debut}`)
                             const courseActive = (squeletteParJour[jour] ?? squelette).some(periodeJour => periodeJour.type === 'COURS' && periodeJour.debut === periode.debut && periodeJour.fin === periode.fin)
                             const col = slot?.subject ? subjectColor(slot.subject.id) : null

                            return (
                               <td key={jour} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 105, height: 60, opacity: courseActive ? 1 : 0.4 }}>
                                  {!courseActive ? (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>—</div>
                                  ) : slot?.kind === 'FREE' ? (

                                   <div style={{ padding: '7px 9px', height: '100%', background: 'var(--blue-light)', borderLeft: '3px solid var(--blue)', boxSizing: 'border-box' }}>
                                     <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--blue)' }}>{t('timetable.freeTime')}</div>
                                   </div>
                                 ) : slot?.subject ? (
                                   <div style={{ padding: '7px 9px', height: '100%', background: col!.bg, borderLeft: `3px solid ${col!.border}`, boxSizing: 'border-box' }}>
                                     <div style={{ fontSize: 12.5, fontWeight: 800, color: col!.text, lineHeight: 1.2 }}>{slot.subject.name}</div>
                                     <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                                       {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: 'var(--amber)' }}>{t('timetable.noTeacher')}</span>}
                                     </div>
                                     {slot.room && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{t('timetable.roomLabel')} {slot.room}</div>}
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
                        <td style={{ padding: '7px 9px', background: 'var(--bg)', fontSize: 12, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {time}
                        </td>
                        {[1,2,3,4,5].map(d => {
                          const slot = slotMap.get(`${d}-${time}`)
                          const col = slot?.subject ? subjectColor(slot.subject.id) : null
                          return (
                            <td key={d} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 105, height: 60 }}>
                               {slot?.kind === 'FREE' ? (
                                 <div style={{ padding: '7px 9px', height: '100%', background: 'var(--bg2)', borderLeft: '3px solid var(--border)', boxSizing: 'border-box' }}>
                                   <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text3)' }}>{t('timetable.freeTime')}</div>
                                 </div>
                               ) : slot?.subject ? (
                                 <div style={{ padding: '7px 9px', height: '100%', background: col!.bg, borderLeft: `3px solid ${col!.border}`, boxSizing: 'border-box' }}>
                                   <div style={{ fontSize: 12.5, fontWeight: 800, color: col!.text }}>{slot.subject.name}</div>
                                   <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                                     {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '—'}
                                   </div>
                                   {slot.room && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{t('timetable.roomLabel')} {slot.room}</div>}
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

      {/* Ajustement IA — visible si EDT DRAFT sélectionné */}
      {timetable && timetable.status === 'DRAFT' && (
        <div className="rounded-xl p-4 md:p-5 mt-5 border border-[var(--border2)] bg-[var(--surface)]">
          <div className="text-sm md:text-base font-bold text-[var(--text)] mb-1">{t('timetable.adjustTitle')}</div>
          <div className="text-xs md:text-sm text-[var(--text3)] mb-3">
            {t('timetable.adjustHint')}
          </div>
          <div className="flex flex-col md:flex-row gap-3 items-start">
            <textarea
              value={adjustInstruction}
              onChange={e => setAdjustInstruction(e.target.value)}
              placeholder={t('timetable.adjustPlaceholder')}
              rows={2}
              className="w-full text-xs md:text-sm font-semibold p-3 border border-[var(--border2)] rounded-lg outline-none text-[var(--text)] resize-y flex-1"
              style={{ fontFamily: 'inherit' }}
            />
            <button
              className="w-full md:w-auto justify-center self-end opacity-100 disabled:opacity-60"
              style={btnAI}
              disabled={adjusting || !adjustInstruction.trim()}
              onClick={handleAdjust}
            >
              {adjusting ? <><span style={spinInline} />{t('timetable.processing')}</> : t('timetable.apply')}
            </button>
          </div>

          {adjustResult && (
            <div className="mt-3">
              {adjustResult.applied.length > 0 && (
                <div className="bg-[var(--green-light)] border border-[var(--green)] rounded-lg p-3 mb-2">
                  <div className="text-xs md:text-sm font-bold text-[var(--green)] mb-1">{t('timetable.changesApplied')}</div>
                  {adjustResult.applied.map((a, i) => <div key={i} className="text-xs md:text-sm text-[var(--green)]">• {a}</div>)}
                </div>
              )}
              {adjustResult.errors.length > 0 && (
                <div className="bg-[var(--red-light)] border border-[var(--red-light)] rounded-lg p-3">
                  <div className="text-xs md:text-sm font-bold text-[var(--red)] mb-1">{t('timetable.conflicts')}</div>
                  {adjustResult.errors.map((e, i) => <div key={i} className="text-xs md:text-sm text-[var(--red)]">• {e}</div>)}
                </div>
              )}
              {adjustResult.applied.length === 0 && adjustResult.errors.length === 0 && (
                <div className="text-xs md:text-sm text-[var(--text3)] italic">{adjustResult.message}</div>
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
const btnPrim:   React.CSSProperties = { padding: '9px 17px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnAI:     React.CSSProperties = { padding: '9px 17px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'linear-gradient(135deg,var(--purple),var(--purple))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnSec:    React.CSSProperties = { padding: '9px 15px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt:  React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 9, padding: '8.5px 13px', fontSize: 14, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt:      React.CSSProperties = { padding: '9px 8px', textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.4px' }
const spinInline: React.CSSProperties = { display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle' }
