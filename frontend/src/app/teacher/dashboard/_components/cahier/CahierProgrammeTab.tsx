'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Inbox, RefreshCw, AlertCircle, BookOpenCheck, Loader2, CloudOff } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import ProgrammeModuleAccordion from './ProgrammeModuleAccordion'
import {
  SEL,
  LBL,
  type Classe,
  type ProgrammeProgressionView,
  type ProgressionChapitreItem,
  type Subject,
  type TranslateFn,
} from './types'

interface Props {
  isOnline: boolean
  classes: Classe[]
  subjects: Subject[]
  selectedClass: string
  selectedSubject: string
  onClassChange: (v: string) => void
  onSubjectChange: (v: string) => void
  onLogLesson: (chapitreId: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  t: TranslateFn
}

function recalculerVueLocale(vue: ProgrammeProgressionView): ProgrammeProgressionView {
  const actifParModule = new Map(vue.modules.map((m) => [m.moduleOrdre, m.actif]))
  const chapitres = vue.chapitres.map((ch) => {
    const moduleActif =
      ch.moduleOrdre === null || ch.moduleOrdre === undefined
        ? true
        : (actifParModule.get(ch.moduleOrdre) ?? true)
    const realise = ch.cocheDirecte || ch.nbSeancesCahier > 0
    const sourceRealisation: ProgressionChapitreItem['sourceRealisation'] =
      ch.cocheDirecte && ch.nbSeancesCahier > 0
        ? 'LES_DEUX'
        : ch.cocheDirecte
          ? 'COCHE'
          : ch.nbSeancesCahier > 0
            ? 'CAHIER'
            : null
    return { ...ch, moduleActif, realise, sourceRealisation }
  })

  const actifs = chapitres.filter((c) => c.moduleActif)
  const leconsTotal = actifs.length
  const leconsRealisees = actifs.filter((c) => c.realise).length
  const progressionPct = leconsTotal > 0 ? Math.round((leconsRealisees / leconsTotal) * 100) : null

  const modules = vue.modules.map((m) => {
    const list = chapitres.filter((c) => c.moduleOrdre === m.moduleOrdre)
    const done = list.filter((c) => c.realise).length
    return {
      ...m,
      leconsTotal: list.length,
      leconsRealisees: done,
      progressionPct: list.length > 0 ? Math.round((done / list.length) * 100) : null,
    }
  })

  return {
    ...vue,
    chapitres,
    modules,
    chapitresTotal: leconsTotal,
    chapitresRealises: leconsRealisees,
    leconsTotal,
    leconsRealisees,
    modulesDesactivesCount: modules.filter((m) => !m.actif).length,
    progressionPct,
  }
}

export default function CahierProgrammeTab({
  isOnline,
  classes,
  subjects,
  selectedClass,
  selectedSubject,
  onClassChange,
  onSubjectChange,
  onLogLesson,
  onToast,
  t,
}: Props) {
  const { addToQueue } = useSyncQueue()
  const [featureEnabled, setFeatureEnabled] = useState<boolean>(false)
  const [progression, setProgression] = useState<ProgrammeProgressionView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({})
  const [busyChapitreId, setBusyChapitreId] = useState<string | null>(null)
  const [busyModuleOrdre, setBusyModuleOrdre] = useState<number | null>(null)
  const [pendingLocalCount, setPendingLocalCount] = useState<number>(0)

  const cacheKey = selectedClass && selectedSubject
    ? `teacher:programme-progression:${selectedClass}:${selectedSubject}`
    : null

  useEffect(() => {
    getCachedData<{ enabled: boolean }>('pedagogie:materialisation:status')
      .then((c) => { if (c?.data?.enabled === true) setFeatureEnabled(true) })
      .catch(() => {})

    if (!isOnline) return
    fetchApi('/api/v2/pedagogie/materialisation/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const enabled = d.data?.enabled === true
          setFeatureEnabled(enabled)
          putCachedData('pedagogie:materialisation:status', { enabled }).catch(() => {})
        }
      })
      .catch(() => {})
  }, [isOnline])

  const loadProgression = useCallback(async () => {
    if (!selectedClass || !selectedSubject || !cacheKey) {
      setProgression(null)
      setError(null)
      return
    }

    // 1. Lecture instantanée depuis le cache Dexie (offline-first)
    let hasCached = false
    try {
      const cached = await getCachedData<ProgrammeProgressionView>(cacheKey)
      if (cached?.data) {
        hasCached = true
        setProgression(cached.data)
        setExpandedModules((prev) => {
          if (Object.keys(prev).length > 0 || !cached.data.modules?.length) return prev
          const first = cached.data.modules.find((m) => m.actif) ?? cached.data.modules[0]
          return first ? { [first.moduleOrdre]: true } : {}
        })
      }
    } catch { /* ignore */ }

    if (!isOnline) {
      if (!hasCached) setError(t('cahier_de_texte.prog_offline_hint'))
      return
    }

    setLoading(!hasCached)
    setError(null)
    try {
      const res = await fetchApi(
        `/api/v2/pedagogie/progression?classId=${selectedClass}&subjectId=${selectedSubject}`,
        { credentials: 'include' },
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        if (!hasCached) {
          setError(json.message ?? t('cahier_de_texte.prog_error'))
          setProgression(null)
        }
      } else {
        const data = json.data as ProgrammeProgressionView
        setProgression(data)
        putCachedData(cacheKey, data).catch(() => {})
        setExpandedModules((prev) => {
          if (Object.keys(prev).length > 0 || !data.modules || data.modules.length === 0) return prev
          const firstActive = data.modules.find((m) => m.actif) ?? data.modules[0]
          return firstActive ? { [firstActive.moduleOrdre]: true } : {}
        })
      }
    } catch {
      if (!hasCached) {
        setError(t('cahier_de_texte.prog_error'))
        setProgression(null)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedSubject, cacheKey, isOnline, t])

  useEffect(() => {
    setExpandedModules({})
    loadProgression()
  }, [loadProgression])

  useEffect(() => {
    const onSynced = () => {
      setPendingLocalCount(0)
      void loadProgression()
    }
    window.addEventListener('zekoulabia:pedagogie-synced', onSynced)
    return () => window.removeEventListener('zekoulabia:pedagogie-synced', onSynced)
  }, [loadProgression])

  const leconsParModule = useMemo(() => {
    const map = new Map<number, ProgressionChapitreItem[]>()
    for (const ch of progression?.chapitres ?? []) {
      if (ch.moduleOrdre === null || ch.moduleOrdre === undefined) continue
      const list = map.get(ch.moduleOrdre) ?? []
      list.push(ch)
      map.set(ch.moduleOrdre, list)
    }
    return map
  }, [progression])

  const chapitresSansModule = useMemo(
    () => (progression?.chapitres ?? []).filter((ch) => ch.moduleOrdre === null || ch.moduleOrdre === undefined),
    [progression],
  )

  const queueLeconOffline = async (chapitreId: string, fait: boolean) => {
    await addToQueue({
      type: 'CHAPITRE_AVANCEMENT_TOGGLE',
      endpoint: `/api/v2/pedagogie/chapitres/${chapitreId}/avancement`,
      method: 'PUT',
      payload: { classId: selectedClass, fait },
    })
    setPendingLocalCount((n) => n + 1)
    setProgression((prev) => {
      if (!prev) return prev
      const next = recalculerVueLocale({
        ...prev,
        chapitres: prev.chapitres.map((c) =>
          c.id === chapitreId ? { ...c, cocheDirecte: fait } : c,
        ),
      })
      if (cacheKey) putCachedData(cacheKey, next).catch(() => {})
      return next
    })
    onToast(t('cahier_de_texte.prog_saved_offline'), 'info')
  }

  const handleToggleLecon = async (chapitreId: string, fait: boolean) => {
    if (!selectedClass || !featureEnabled) return
    if (!isOnline) {
      await queueLeconOffline(chapitreId, fait)
      return
    }
    setBusyChapitreId(chapitreId)
    try {
      const res = await fetchApi(`/api/v2/pedagogie/chapitres/${chapitreId}/avancement`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass, fait }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        onToast(json.message ?? t('cahier_de_texte.prog_toggle_error'), 'error')
      } else {
        if (!fait && json.data?.sourceRealisation === 'CAHIER') {
          onToast(t('cahier_de_texte.prog_still_done_via_cahier'), 'info')
        }
        await loadProgression()
      }
    } catch {
      try {
        await queueLeconOffline(chapitreId, fait)
      } catch {
        onToast(t('cahier_de_texte.toast_network_error'), 'error')
      }
    } finally {
      setBusyChapitreId(null)
    }
  }

  const queueModuleOffline = async (programmeId: string, moduleOrdre: number, actif: boolean) => {
    await addToQueue({
      type: 'PROGRAMME_MODULE_TOGGLE',
      endpoint: `/api/v2/pedagogie/programmes/${programmeId}/modules/${moduleOrdre}/statut`,
      method: 'PUT',
      payload: { actif },
    })
    setPendingLocalCount((n) => n + 1)
    setProgression((prev) => {
      if (!prev) return prev
      const next = recalculerVueLocale({
        ...prev,
        modules: prev.modules.map((m) =>
          m.moduleOrdre === moduleOrdre ? { ...m, actif } : m,
        ),
      })
      if (cacheKey) putCachedData(cacheKey, next).catch(() => {})
      return next
    })
    onToast(t('cahier_de_texte.prog_module_saved_offline'), 'info')
  }

  const handleToggleModuleActif = async (moduleOrdre: number, actif: boolean) => {
    if (!progression?.programme?.id || !featureEnabled) return
    if (!isOnline) {
      await queueModuleOffline(progression.programme.id, moduleOrdre, actif)
      return
    }
    setBusyModuleOrdre(moduleOrdre)
    try {
      const res = await fetchApi(
        `/api/v2/pedagogie/programmes/${progression.programme.id}/modules/${moduleOrdre}/statut`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actif }),
        },
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        onToast(json.message ?? t('cahier_de_texte.prog_module_error'), 'error')
      } else {
        onToast(
          actif
            ? t('cahier_de_texte.prog_module_reactivated_toast')
            : t('cahier_de_texte.prog_module_deactivated_toast'),
          'success',
        )
        await loadProgression()
      }
    } catch {
      try {
        await queueModuleOffline(progression.programme.id, moduleOrdre, actif)
      } catch {
        onToast(t('cahier_de_texte.toast_network_error'), 'error')
      }
    } finally {
      setBusyModuleOrdre(null)
    }
  }

  const pct = progression?.progressionPct ?? 0

  return (
    <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '12px 14px' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label style={LBL}>{t('cahier_de_texte.class_label')}</label>
            <select value={selectedClass} onChange={(e) => onClassChange(e.target.value)} style={SEL}>
              <option value="">{t('cahier_de_texte.class_placeholder')}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>{t('cahier_de_texte.subject_label')}</label>
            <select
              value={selectedSubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              disabled={!selectedClass}
              style={{ ...SEL, opacity: !selectedClass ? 0.5 : 1 }}
            >
              <option value="">{t('cahier_de_texte.subject_placeholder')}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {pendingLocalCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 8, background: 'var(--amber-light)', border: '1px solid var(--amber)', color: 'var(--amber)', fontSize: 12, fontWeight: 700 }}>
          <CloudOff size={14} />
          {t('cahier_de_texte.prog_pending_sync').replace('{count}', String(pendingLocalCount))}
        </div>
      )}

      {!selectedClass || !selectedSubject ? (
        <div style={{ padding: 28, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12.5 }}>
          {t('cahier_de_texte.prog_select_hint')}
        </div>
      ) : loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          <Loader2 size={18} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />
          {t('cahier_de_texte.history_loading')}
        </div>
      ) : error ? (
        <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--red)', background: 'var(--red-light)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
            <AlertCircle size={15} /> {error}
          </span>
          <button type="button" onClick={loadProgression} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={12} /> {t('cahier_de_texte.prog_retry')}
          </button>
        </div>
      ) : !progression?.programme ? (
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--text3)' }}><Inbox size={28} strokeWidth={1.6} /></div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{t('cahier_de_texte.prog_empty_title')}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t('cahier_de_texte.prog_empty_hint')}</div>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{progression.programme.titre}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {progression.modulesDesactivesCount > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 999, background: 'var(--amber-light)', color: 'var(--amber)' }}>
                    {t('cahier_de_texte.prog_disabled_modules').replace('{count}', String(progression.modulesDesactivesCount))}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)' }}>
                  {progression.leconsRealisees}/{progression.leconsTotal} ({pct}%)
                </span>
              </div>
            </div>

            <div style={{ height: 10, borderRadius: 999, background: 'var(--bg2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--green)', transition: 'width 0.3s' }} />
            </div>

            {progression.hasHeuresPrevu && progression.totalHeuresPrevu !== null && progression.heuresRealisees !== null && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5, textAlign: 'right', fontWeight: 700 }}>
                {progression.heuresRealisees}h / {progression.totalHeuresPrevu}h
              </div>
            )}

            {!featureEnabled && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8, padding: '6px 10px', borderRadius: 7, background: 'var(--bg)' }}>
                {t('cahier_de_texte.prog_readonly_flag_off')}
              </div>
            )}
          </div>

          {progression.modules.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {progression.modules.map((mod) => (
                <ProgrammeModuleAccordion
                  key={mod.moduleOrdre}
                  module={mod}
                  lecons={leconsParModule.get(mod.moduleOrdre) ?? []}
                  expanded={Boolean(expandedModules[mod.moduleOrdre])}
                  canEdit={featureEnabled}
                  busyChapitreId={busyChapitreId}
                  busyModuleOrdre={busyModuleOrdre}
                  onToggleExpand={() =>
                    setExpandedModules((prev) => ({ ...prev, [mod.moduleOrdre]: !prev[mod.moduleOrdre] }))
                  }
                  onToggleModuleActif={handleToggleModuleActif}
                  onToggleLecon={handleToggleLecon}
                  onLogLesson={onLogLesson}
                  t={t}
                />
              ))}
            </div>
          )}

          {chapitresSansModule.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {chapitresSansModule.map((ch) => {
                const isBusy = busyChapitreId === ch.id
                const fromCahier = ch.sourceRealisation === 'CAHIER' || ch.sourceRealisation === 'LES_DEUX'
                return (
                  <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: ch.realise ? 'var(--green-light)' : 'var(--bg)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, cursor: featureEnabled ? 'pointer' : 'default' }}>
                      <input
                        type="checkbox"
                        checked={ch.cocheDirecte || ch.realise}
                        disabled={!featureEnabled || isBusy}
                        onChange={() => handleToggleLecon(ch.id, !ch.cocheDirecte)}
                        style={{ width: 17, height: 17, accentColor: 'var(--green)' }}
                      />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: ch.realise ? 'var(--green)' : 'var(--text)' }}>
                        Ch.{ch.ordre} — {ch.titre}
                      </span>
                    </label>
                    {fromCahier && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--blue-light)', color: 'var(--blue)' }}>
                        <BookOpenCheck size={11} /> {t('cahier_de_texte.prog_validated_via_cahier')}
                      </span>
                    )}
                    {ch.volumeHeuresPrevu !== null && ch.volumeHeuresPrevu !== undefined && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{ch.volumeHeuresPrevu}h</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
