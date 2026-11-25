'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Calendar } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import { btnPrim, sSub, sTitle, type AcademicYear } from './academicYear/academicYearUi'
import CurrentYearPanel from './academicYear/CurrentYearPanel'
import AcademicYearHistoryPanel from './academicYear/AcademicYearHistoryPanel'
import AcademicCalendarModal from './academicYear/AcademicCalendarModal'
import CreateYearModal from './academicYear/CreateYearModal'
import FeePlanReconductionModal from './academicYear/FeePlanReconductionModal'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface CreateDraft {
  name: string
  startDate: string
  endDate: string
  previousCurrentYearId: string | null
}

interface ReconductionTarget {
  targetYearId: string
  targetYearName: string
  sourceYearId: string | null
}

export default function SectionAcademicYear({ onToast }: Props) {
  const t = useT('admin')
  const [years, setYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openPeriods, setOpenPeriods] = useState<Set<string>>(new Set())
  const [closingId, setClosingId] = useState<string | null>(null)
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null)
  const [settingSequenceId, setSettingSequenceId] = useState<string | null>(null)
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null)
  const [calTarget, setCalTarget] = useState<AcademicYear | null>(null)
  const [reconductionTarget, setReconductionTarget] = useState<ReconductionTarget | null>(null)

  const fetchYears = useCallback(async () => {
    const cached = await getCachedData<AcademicYear[]>('admin:academic-years')
    const fallback = !cached?.data ? await getCachedData<AcademicYear[]>('staff:academic-years') : null
    const initialList = cached?.data || fallback?.data
    if (initialList && Array.isArray(initialList) && initialList.length > 0) {
      setYears(initialList)
      const current = initialList.find(y => y.isCurrent)
      if (current) setOpenPeriods(new Set(current.periods.map(p => p.id)))
      setLoading(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false)
      return
    }

    try {
      if (!initialList || initialList.length === 0) setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/academic-years', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.errServer'))
      const list: AcademicYear[] = data.data || []
      setYears(list)
      const current = list.find(y => y.isCurrent)
      if (current) setOpenPeriods(new Set(current.periods.map(p => p.id)))
      await putCachedData('admin:academic-years', list)
      await putCachedData('staff:academic-years', list)
    } catch (err) {
      if (!initialList || initialList.length === 0) {
        setError(err instanceof Error ? err.message : t('academic_year.toast.errLoad'))
      }
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { fetchYears() }, [fetchYears])

  // Rafraîchissement temps réel quand l'assistant IA change la période académique courante.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'academicPeriod') fetchYears()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchYears])

  const togglePeriod = (id: string) => {
    setOpenPeriods(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleClose = async (yearId: string) => {
    if (!(await confirmAction({ message: t('academic_year.toast.confirmClose'), danger: true }))) return
    setClosingId(yearId)
    try {
      const checkRes = await fetchApi(`/api/v2/academic-years/${yearId}/pre-close-check`, { method: 'POST', credentials: 'include' })
      const checkData = await checkRes.json()
      if (!checkRes.ok) throw new Error(checkData.message || t('academic_year.toast.checkFailed'))
      const closeRes = await fetchApi(`/api/v2/academic-years/${yearId}/close`, { method: 'POST', credentials: 'include' })
      const closeData = await closeRes.json()
      if (!closeRes.ok) throw new Error(closeData.message || t('academic_year.toast.closeFailed'))
      onToast(t('academic_year.toast.yearClosed'), 'success')
      fetchYears()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academic_year.toast.errClose'), 'error')
    } finally {
      setClosingId(null)
    }
  }

  const handleSetCurrent = async (periodId: string) => {
    setSettingCurrentId(periodId)
    try {
      const res = await fetchApi(`/api/v2/academic-years/periods/${periodId}/set-current`, {
        method: 'PATCH', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.err'))
      onToast(t('academic_year.toast.periodUpdated'), 'success')
      fetchYears()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academic_year.toast.err'), 'error')
    } finally {
      setSettingCurrentId(null)
    }
  }

  const handleSetSequenceCurrent = async (sequenceId: string) => {
    setSettingSequenceId(sequenceId)
    try {
      const res = await fetchApi(`/api/v2/academic-years/sequences/${sequenceId}/set-current`, {
        method: 'PATCH', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.err'))
      onToast(t('academic_year.toast.sequenceUpdated'), 'success')
      fetchYears()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academic_year.toast.err'), 'error')
    } finally {
      setSettingSequenceId(null)
    }
  }

  const openIntelligentCreate = () => {
    const current = years.find(y => y.isCurrent)
    let name = ''
    let startDate = ''
    let endDate = ''

    if (current) {
      const match = current.name.match(/(\d{4})[^\d]*(\d{4})/)
      if (match) {
        const y1 = parseInt(match[1], 10) + 1
        const y2 = parseInt(match[2], 10) + 1
        name = `${y1}-${y2}`
      } else {
        name = `${current.name} (N+1)`
      }
      if (current.startDate) {
        const s = new Date(current.startDate)
        s.setFullYear(s.getFullYear() + 1)
        startDate = s.toISOString().slice(0, 10)
      }
      if (current.endDate) {
        const e = new Date(current.endDate)
        e.setFullYear(e.getFullYear() + 1)
        endDate = e.toISOString().slice(0, 10)
      }
    }

    setCreateDraft({ name, startDate, endDate, previousCurrentYearId: current?.id ?? null })
  }

  const currentYear = years.find(y => y.isCurrent)
  const historyYears = years.filter(y => !y.isCurrent)

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 26 }}>
        <div>
          <div className="text-[15px] md:text-[17px]" style={sTitle}>{t('academic_year.title')} — Transition &amp; Rentrée</div>
          <div className="text-[11px] md:text-[12px]" style={sSub}>{t('academic_year.subtitle')}</div>
        </div>
        <button className="hidden md:inline-block" style={btnPrim} onClick={openIntelligentCreate}>🚀 Proposer &amp; Ouvrir l&apos;Année N+1</button>
        <button
          className="md:hidden inline-flex items-center rounded-full px-3.5 py-2 text-[12px] min-h-[38px] border-0 flex-shrink-0 shadow-sm"
          style={{ background: 'linear-gradient(135deg,var(--amber),var(--amber-dark, #d97706))', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={openIntelligentCreate}
        >
          🚀 Proposer N+1
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <AlertTriangle size={18} strokeWidth={2} />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchYears} style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            {t('academic_year.retry')}
          </button>
        </div>
      )}

      {!loading && !error && years.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Calendar size={52} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('academic_year.noYear')}</div>
          <div style={{ fontSize: 16, color: 'var(--text3)', marginBottom: 22 }}>{t('academic_year.noYearHint')}</div>
          <button style={btnPrim} onClick={() => setCreateDraft({ name: '', startDate: '', endDate: '', previousCurrentYearId: null })}>
            {t('academic_year.createYear')}
          </button>
        </div>
      )}

      {!loading && !error && currentYear && (
        <CurrentYearPanel
          currentYear={currentYear}
          openPeriods={openPeriods}
          settingCurrentId={settingCurrentId}
          settingSequenceId={settingSequenceId}
          onTogglePeriod={togglePeriod}
          onSetCurrent={handleSetCurrent}
          onSetSequenceCurrent={handleSetSequenceCurrent}
          onOpenCalendar={setCalTarget}
        />
      )}

      {!loading && !error && (
        <AcademicYearHistoryPanel
          historyYears={historyYears}
          currentYear={currentYear}
          closingId={closingId}
          onOpenCalendar={setCalTarget}
          onCloseYear={handleClose}
          onToast={onToast}
        />
      )}

      {calTarget && (
        <AcademicCalendarModal
          key={calTarget.id}
          year={calTarget}
          onClose={() => setCalTarget(null)}
          onSaved={fetchYears}
          onToast={onToast}
        />
      )}

      {createDraft && (
        <CreateYearModal
          initialName={createDraft.name}
          initialStartDate={createDraft.startDate}
          initialEndDate={createDraft.endDate}
          previousCurrentYearId={createDraft.previousCurrentYearId}
          onClose={() => setCreateDraft(null)}
          onCreated={(targetYearId, targetYearName, sourceYearId) => {
            setCreateDraft(null)
            fetchYears()
            if (targetYearId) setReconductionTarget({ targetYearId, targetYearName, sourceYearId })
          }}
          onToast={onToast}
        />
      )}

      {reconductionTarget && (
        <FeePlanReconductionModal
          key={reconductionTarget.targetYearId}
          targetYearId={reconductionTarget.targetYearId}
          targetYearName={reconductionTarget.targetYearName}
          sourceYearId={reconductionTarget.sourceYearId}
          onClose={() => setReconductionTarget(null)}
          onToast={onToast}
        />
      )}
    </div>
  )
}
