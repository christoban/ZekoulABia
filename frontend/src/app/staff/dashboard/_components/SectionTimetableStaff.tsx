'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Calendar, CalendarDays, Loader2, Package, Trash2 } from 'lucide-react'
import { putCachedData, getCachedData } from '@/lib/offline/db'
import SectionTimetableStaffActions from './SectionTimetableStaffActions'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import TimetableProposalPreview from './TimetableProposalPreview'
import {
  DAY_MAP,
  type TimetableClassItem as ClassItem,
  type TimetableData as Timetable,
  type PeriodeGrille,
} from '@/features/timetable/timetableShared'
import {
  type Assignment,
  type GridConfig,
  btnPrim,
  btnSec,
  sSub,
  sTitle,
  selectSt,
  spinnerStyle,
} from './timetable/timetableStaffTypes'
import { TimetableEmptyState, TimetableSpinner } from './timetable/TimetablePrimitives'
import TimetableBulkResultsPanel from './timetable/TimetableBulkResultsPanel'
import TimetableGridTable from './timetable/TimetableGridTable'
import TimetableSlotModal from './timetable/TimetableSlotModal'
import { useBulkTimetableGeneration } from './timetable/useBulkTimetableGeneration'
import { useTimetableSlotModal } from './timetable/useTimetableSlotModal'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionTimetable({ onToast }: Props) {
  const t = useT('staff')
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classId, setClassId] = useState('')
  const [timetable, setTimetable] = useState<Timetable | null>(null)
  const [gridConfig, setGridConfig] = useState<GridConfig | null>(null)
  const [squelette, setSquelette] = useState<PeriodeGrille[]>([])
  const [squeletteParJour, setSqueletteParJour] = useState<Record<string, PeriodeGrille[]>>({})
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lv2SubjectIds, setLv2SubjectIds] = useState<Set<string>>(new Set())
  const [fromCache, setFromCache] = useState(false)
  const [cachedAt, setCachedAt] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true

    Promise.all([
      getCachedData<ClassItem[]>('staff:classes'),
      getCachedData<{ config: GridConfig; squelette: PeriodeGrille[]; squeletteParJour: Record<string, PeriodeGrille[]> }>('staff:timetable-grid-config'),
      getCachedData<string[]>('staff:subjects-lv2'),
    ]).then(([cachedClasses, cachedConfig, cachedLv2]) => {
      if (!mounted) return
      if (cachedClasses?.data && Array.isArray(cachedClasses.data)) setClasses(cachedClasses.data)
      if (cachedConfig?.data?.config) {
        setGridConfig(cachedConfig.data.config)
        setSquelette(cachedConfig.data.squelette ?? [])
        setSqueletteParJour(cachedConfig.data.squeletteParJour ?? {})
      }
      if (cachedLv2?.data && Array.isArray(cachedLv2.data)) setLv2SubjectIds(new Set(cachedLv2.data))
    }).catch(() => {})

    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ]).then(([classData, configData, subjectData]) => {
      if (!mounted) return
      if (classData) {
        const list = Array.isArray(classData?.data) ? classData.data : Array.isArray(classData) ? classData : []
        if (list.length > 0) {
          setClasses(list)
          void putCachedData('staff:classes', list)
        }
      }
      if (configData?.data) {
        setGridConfig(configData.data.config)
        setSquelette(configData.data.squelette)
        setSqueletteParJour(configData.data.squeletteParJour ?? {})
        void putCachedData('staff:timetable-grid-config', configData.data)
      }
      if (Array.isArray(subjectData?.data)) {
        const lv2Ids = subjectData.data.filter((s: { isLV2?: boolean; id: string }) => s.isLV2).map((s: { id: string }) => s.id)
        setLv2SubjectIds(new Set(lv2Ids))
        void putCachedData('staff:subjects-lv2', lv2Ids)
      }
    }).catch(() => {})
      .finally(() => { if (mounted) setLoadingClasses(false) })

    return () => { mounted = false }
  }, [])

  const fetchTimetable = useCallback(async (cid?: string) => {
    const id = cid ?? classId
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const [tmRes, assRes] = await Promise.all([
        fetchApi(`/api/v2/timetables?classId=${id}`, { credentials: 'include' }),
        fetchApi(`/api/v2/teaching-assignments?classId=${id}`, { credentials: 'include' }),
      ])
      const tmData = await tmRes.json()
      const assData = await assRes.json()
      if (!tmRes.ok) throw new Error(tmData.message || t('timetable.loading'))
      const list: Timetable[] = tmData.data || []
      const currentTimetable = list[0] ?? null
      const currentAssignments = assData.data || []
      setTimetable(currentTimetable)
      setAssignments(currentAssignments)
      setFromCache(false)
      setCachedAt(null)
      void putCachedData(`staff:timetable:${id}`, currentTimetable)
      void putCachedData(`staff:teaching-assignments:${id}`, currentAssignments)
    } catch {
      try {
        const [cachedTm, cachedAss] = await Promise.all([
          getCachedData<Timetable>(`staff:timetable:${id}`),
          getCachedData<Assignment[]>(`staff:teaching-assignments:${id}`),
        ])
        if (cachedTm?.data) {
          setTimetable(cachedTm.data)
          setAssignments(cachedAss?.data ?? [])
          setFromCache(true)
          setCachedAt(cachedTm.cachedAt)
        } else {
          setError(t('timetable.loadingError') || 'Impossible de charger l\'emploi du temps en mode hors-ligne.')
        }
      } catch {
        setError('Erreur de chargement')
      }
    } finally {
      setLoading(false)
    }
  }, [classId, t])

  const bulk = useBulkTimetableGeneration({ classes, loadingClasses, onToast, t })
  const slotModal = useTimetableSlotModal({
    timetable,
    setTimetable,
    assignments,
    lv2SubjectIds,
    fetchTimetable,
    onToast,
    t,
  })

  const handleClassChange = (newClassId: string) => {
    setClassId(newClassId)
    setTimetable(null)
    setError(null)
    bulk.setPreviewResult(null)
    bulk.setPreviewAssignments([])
    if (newClassId) fetchTimetable(newClassId)
  }

  const handleGenerate = async () => {
    if (!classId) return
    setGenerating(true)
    try {
      const res = await fetchApi('/api/v2/timetables/generate-skeleton', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.data?.timetableId) { fetchTimetable(); return }
        throw new Error(data.message || 'Erreur génération')
      }
      onToast(t('timetable.skeletonGenerated'), 'success')
      setTimetable(data.data)
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.generationError'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async () => {
    if (!timetable || timetable.status !== 'DRAFT') return
    setSubmitting(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/submit`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.submitError'))
      onToast(t('timetable.submitSuccess'), 'success')
      fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.submitError'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearAll = async () => {
    if (!timetable || timetable.status !== 'DRAFT') return
    if (!(await confirmAction(t('timetable.clearAllConfirm', { className: timetable.class.name })))) return
    setClearingAll(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/slots`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.clearAllError'))
      await fetchTimetable()
      onToast(t('timetable.allSlotsCleared'), 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.clearAllError'), 'error')
    } finally {
      setClearingAll(false)
    }
  }

  const slots = timetable?.slots ?? []
  const joursActifs = gridConfig?.joursActifs ?? ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
  // filter sur undefined et non sur la véracité : `.filter(Boolean)` supprimerait le lundi (0).
  const joursNumeriques = joursActifs.map(j => DAY_MAP[j]).filter((d): d is number => d !== undefined)
  const totalCours = gridConfig
    ? (Object.keys(squeletteParJour).length > 0
      ? joursActifs.reduce((total, jour) => total + (squeletteParJour[jour] ?? squelette).filter(periode => periode.type === 'COURS').length, 0)
      : squelette.filter(periode => periode.type === 'COURS').length * joursNumeriques.length)
    : slots.filter(s => s.kind === 'CLASS').length
  const remplis = slots.filter(s => s.kind === 'CLASS' && s.subject).length
  const pct = totalCours > 0 ? Math.round(remplis / totalCours * 100) : 0

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box', paddingBottom: 140 }}>
      <style>{`
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        .tt-cell-hover:hover { background: rgba(5,150,105,0.05) !important; cursor: pointer; }
        .tt-cell-filled:hover { opacity: 0.88; cursor: pointer; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={sTitle}>{t('timetable.title')}</div>
          <div style={sSub}>
            {timetable
              ? t('timetable.subtitleFilled', { className: timetable.class.name, filled: remplis, total: totalCours, pct, status: timetable.status === 'PUBLISHED' ? t('timetable.statusPublished') : timetable.status === 'SUBMITTED' ? t('timetable.statusSubmitted') : t('timetable.statusDraft') })
              : gridConfig ? t('timetable.selectClass') : t('timetable.gridNotConfigured')}
          </div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Package size={12} strokeWidth={2} /> Données du {new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — hors-ligne
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={classId} onChange={e => handleClassChange(e.target.value)} style={selectSt} disabled={loadingClasses}>
            <option value="">{loadingClasses ? t('timetable.loading') : t('timetable.selectClassOption')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {timetable && timetable.status === 'DRAFT' && (
            <>
              <button style={btnSec} onClick={handleClearAll} disabled={clearingAll || submitting}>
                <Trash2 size={14} /> {clearingAll ? t('timetable.clearingAll') : t('timetable.clearAll')}
              </button>
              <button style={btnPrim} onClick={handleSubmit} disabled={submitting || clearingAll}>
                {submitting ? <><TimetableSpinner /> {t('timetable.submitting')}</> : t('timetable.submitForValidation')}
              </button>
            </>
          )}
          {!classId && (
            <button style={btnSec} onClick={bulk.handleProposeAll} disabled={loadingClasses || classes.length === 0 || bulk.bulkPropose !== null}>
              {bulk.bulkPropose ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />} {bulk.bulkPropose ? t('timetable.bulkProposeRunning', { current: bulk.bulkPropose.current, total: bulk.bulkPropose.total }) : t('timetable.bulkProposeButton')}
            </button>
          )}
        </div>
      </div>

      <TimetableBulkResultsPanel
        classId={classId}
        bulkPropose={bulk.bulkPropose}
        bulkResults={bulk.bulkResults}
        selectedPartialIds={bulk.selectedPartialIds}
        setSelectedPartialIds={bulk.setSelectedPartialIds}
        applyingAll={bulk.applyingAll}
        previewLoading={bulk.previewLoading}
        onClearBulkResults={bulk.clearBulkResults}
        onOpenPreview={bulk.openPreview}
        onApplyAll={bulk.handleApplyAll}
        onApplySelectedPartials={bulk.handleApplySelectedPartials}
      />

      {bulk.previewResult?.proposal && (
        <TimetableProposalPreview
          className={bulk.previewResult.className}
          seances={bulk.previewResult.proposal.seances}
          seancesGroupes={bulk.previewResult.proposal.seancesGroupes}
          squelette={squelette}
          squeletteParJour={squeletteParJour}
          joursActifs={joursActifs}
          assignments={bulk.previewAssignments}
          status={bulk.previewResult.status}
          warnings={bulk.previewResult.warnings}
          degradeDetails={bulk.previewResult.degradeDetails}
          heuresNonPlacees={bulk.previewResult.heuresNonPlacees}
          loading={bulk.previewLoading}
          onClose={() => bulk.setPreviewResult(null)}
        />
      )}

      {classId && !loadingClasses && (
        <SectionTimetableStaffActions
          classId={classId}
          academicYearId={classes.find(c => c.id === classId)?.academicYearId}
          timetable={timetable}
          assignments={assignments}
          gridConfigured={!!gridConfig}
          onRefresh={() => fetchTimetable()}
          onToast={onToast}
        />
      )}

      {!gridConfig && !loadingClasses && (
        <div style={{ background: 'var(--orange-light)', border: '1px solid var(--orange-light)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12.5, color: 'var(--amber)' }} dangerouslySetInnerHTML={{ __html: t('timetable.gridNotConfiguredDesc') }} />
      )}

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><div style={spinnerStyle} /></div>}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={15} strokeWidth={2} /></span>
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, fontSize: 13 }}>{error}</span>
          <button onClick={() => fetchTimetable()} style={btnSec}>{t('timetable.retry')}</button>
        </div>
      )}

      {!loading && !error && !classId && (
        <TimetableEmptyState icon={<CalendarDays size={38} strokeWidth={1.8} />} title={t('timetable.emptyStateTitle')} sub={t('timetable.emptyStateSub')} />
      )}

      {!loading && !error && classId && !timetable && gridConfig && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 38, marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}><Calendar size={38} strokeWidth={1.8} /></div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('timetable.noTimetableTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }} dangerouslySetInnerHTML={{ __html: t('timetable.noTimetableDesc') }} />
          <button style={{ ...btnPrim, fontSize: 13.5, padding: '8px 18px' }} onClick={handleGenerate} disabled={generating}>
            {generating ? <><TimetableSpinner /> {t('timetable.generating')}</> : t('timetable.generateSkeleton')}
          </button>
        </div>
      )}

      {!loading && !error && timetable && squelette.length > 0 && (
        <TimetableGridTable
          slots={slots}
          squelette={squelette}
          squeletteParJour={squeletteParJour}
          joursActifs={joursActifs}
          remplis={remplis}
          totalCours={totalCours}
          pct={pct}
          onOpenModal={slotModal.openModal}
          onOpenEmptyModal={slotModal.openEmptyModal}
        />
      )}

      {slotModal.modalSlot && (
        <TimetableSlotModal
          modalSlot={slotModal.modalSlot}
          modalSubjectId={slotModal.modalSubjectId}
          modalTeacherId={slotModal.modalTeacherId}
          modalTeacherName={slotModal.modalTeacherName}
          modalIsLV2Slot={slotModal.modalIsLV2Slot}
          setModalIsLV2Slot={slotModal.setModalIsLV2Slot}
          assignments={assignments}
          lv2SubjectIds={lv2SubjectIds}
          saving={slotModal.saving}
          conflictMsg={slotModal.conflictMsg}
          onSubjectSelect={slotModal.handleSubjectSelect}
          onClose={() => slotModal.setModalSlot(null)}
          onSave={slotModal.handleSaveSlot}
          onClear={slotModal.handleClearSlot}
        />
      )}
    </div>
  )
}
