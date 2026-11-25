'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { groupTimetableSlotsForDisplay } from '@/lib/timetableSlotGrouping'
import { AlertTriangle, CalendarDays, Calendar, Bot } from 'lucide-react'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import {
  DAY_MAP,
  type TimetableClassItem as ClassItem,
  type TimetableData as Timetable,
  type PeriodeGrille,
} from '@/features/timetable/timetableShared'
import TimetableMobileView from './timetable/TimetableMobileView'
import TimetableDesktopGrid from './timetable/TimetableDesktopGrid'
import { btnPrim, btnSec, spinInline } from './timetable/timetableStyles'
import type { AdminSection } from '../_types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: AdminSection) => void
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

  // Vue mobile : un jour a la fois (onglets) au lieu de la grille complete, illisible en dessous de md.
  const [mobileDay, setMobileDay]             = useState('LUNDI')

  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Essai Dexie d'abord
      const [cachedClasses, cachedGrid] = await Promise.all([
        getCachedData<ClassItem[]>('admin:classes'),
        getCachedData<{ squelette?: PeriodeGrille[]; squeletteParJour?: Record<string, PeriodeGrille[]>; config?: { joursActifs?: string[] } }>('admin:timetable-grid-config'),
      ])

      const fallbackClasses = !cachedClasses?.data ? await getCachedData<ClassItem[]>('staff:classes') : null
      const classList = cachedClasses?.data || fallbackClasses?.data
      if (classList && Array.isArray(classList) && classList.length > 0) {
        setClasses(classList)
      }

      if (cachedGrid?.data) {
        if (cachedGrid.data.squelette) setSquelette(cachedGrid.data.squelette)
        if (cachedGrid.data.squeletteParJour) setSqueletteParJour(cachedGrid.data.squeletteParJour)
        if (cachedGrid.data.config?.joursActifs) setJoursActifs(cachedGrid.data.config.joursActifs)
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setLoadingClasses(false)
        return
      }

      Promise.all([
        fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()),
      ]).then(async ([classData, configData]) => {
        if (classData?.data) {
          setClasses(classData.data)
          await putCachedData('admin:classes', classData.data).catch(() => {})
        }
        if (configData?.data) {
          setSquelette(configData.data.squelette || [])
          setSqueletteParJour(configData.data.squeletteParJour || {})
          setJoursActifs(configData.data.config?.joursActifs || ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
          await putCachedData('admin:timetable-grid-config', configData.data).catch(() => {})
        }
      }).catch(() => {})
        .finally(() => setLoadingClasses(false))
    }

    loadInitialData()
  }, [])

  const fetchTimetable = useCallback(async (cid?: string) => {
    const id = cid ?? classId
    if (!id) return

    const cacheKey = `admin:timetables:${id}`
    const cached = await getCachedData<Timetable>(cacheKey)
    const fallbackCached = !cached?.data ? await getCachedData<Timetable>(`staff:timetables:${id}`) : null
    const initialT = cached?.data ?? fallbackCached?.data

    if (initialT) {
      setTimetable(initialT)
      setLoading(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi(`/api/v2/timetables?classId=${id}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.err'))
      const list: Timetable[] = data.data || []
      const found = list[0] ?? null
      setTimetable(found)
      if (found) {
        await putCachedData(cacheKey, found)
      }
    } catch (err) {
      if (!initialT) {
        setError(err instanceof Error ? err.message : t('timetable.errLoad'))
      }
    } finally {
      setLoading(false)
    }
  }, [classId, t])

  // Rafraîchissement temps réel quand l'assistant IA publie/modifie un emploi du temps.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'timetable' && classId) fetchTimetable()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchTimetable, classId])

  const handleClassChange = (newId: string) => {
    setClassId(newId); setTimetable(null); setError(null)
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
    if (!timetable || !(await confirmAction(t('timetable.reopenConfirm')))) return
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

  const slots = timetable?.slots ?? []
  const slotMap = groupTimetableSlotsForDisplay(slots)

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
              <TimetableMobileView
                displayDays={displayDays}
                effectiveMobileDay={effectiveMobileDay}
                onSelectMobileDay={setMobileDay}
                hasGridConfig={hasGridConfig}
                squelette={squelette}
                squeletteParJour={squeletteParJour}
                fallbackTimes={fallbackTimes}
                slots={slots}
                slotMap={slotMap}
              />
              <TimetableDesktopGrid
                hasGridConfig={hasGridConfig}
                joursActifs={joursActifs}
                squelette={squelette}
                squeletteParJour={squeletteParJour}
                fallbackTimes={fallbackTimes}
                slots={slots}
                slotMap={slotMap}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
