'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { PenLine, Save, Loader2, ScrollText } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { useT } from '@/lib/i18n'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import AppreciationSubmissionBanner from './appreciations/AppreciationSubmissionBanner'
import AppreciationStudentCard from './appreciations/AppreciationStudentCard'
import type { Period, ReportCard } from './appreciations/types'

interface Props {
  user: UserInfo
  classeId: string
  classeNom?: string
  classesList?: { id: string; name: string }[]
  onSelectClasse?: (id: string) => void
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function SectionAppreciationsPP({ user: _user, classeId, classeNom, classesList, onSelectClasse }: Props) {
  const t = useT('teacher')
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [reportCards, setReportCards] = useState<ReportCard[]>([])
  const [comments, setComments] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [loadingCards, setLoadingCards] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [generatingAI, setGeneratingAI] = useState<Record<string, boolean>>({})
  const [aiError, setAiError] = useState<Record<string, boolean>>({})
  const { isOnline, addToQueue } = useSyncQueue()

  const [myClassId, setMyClassId] = useState<string | null>(null)
  const [currentPeriodId, setCurrentPeriodId] = useState<string | null>(null)
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (navigator.onLine) {
      fetchApi('/api/v2/academic-years?isCurrent=true', { credentials: 'include' })
        .then(r => r.json())
        .then(async d => {
          const years = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
          const current = years[0]
          if (current?.periods?.length) {
            setPeriods(current.periods)
            setSelectedPeriodId(current.periods[0].id)
            const currentPer = current.periods.find((p: Period) => p.isCurrent)
            if (currentPer) setCurrentPeriodId(currentPer.id)
            await putCachedData('teacher:academic-periods', current.periods).catch(() => {})
          }
        })
        .catch(() => {})
    } else {
      getCachedData<Period[]>('teacher:academic-periods').then(cached => {
        if (cached?.data?.length) {
          setPeriods(cached.data)
          setSelectedPeriodId(cached.data[0].id)
          const currentPer = cached.data.find((p: Period) => p.isCurrent)
          if (currentPer) setCurrentPeriodId(currentPer.id)
        }
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    fetchApi('/api/v2/users/my-class', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.classId) setMyClassId(d.data.classId)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!currentPeriodId || !classeId) return
    fetchApi(`/api/v2/bulletin-validations?classId=${classeId}&academicPeriodId=${currentPeriodId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const sessions = d.data ?? []
        setSubmissionStatus(sessions.length > 0 ? sessions[0].status : null)
      })
      .catch(() => {})
  }, [currentPeriodId, classeId])

  useEffect(() => {
    if (!selectedPeriodId) return
    setLoadingCards(true)
    setError(null)
    const rcCacheKey = `teacher:pp-report-cards:${classeId}:${selectedPeriodId}`

    const applyCachedCards = (cards: ReportCard[]) => {
      setReportCards(cards)
      const init: Record<string, string> = {}
      for (const rc of cards) init[rc.id] = rc.classMasterComment ?? ''
      setComments(init)
    }

    if (navigator.onLine) {
      fetchApi(`/api/v2/report-cards?classId=${classeId}&periodId=${selectedPeriodId}&limit=100`, { credentials: 'include' })
        .then(r => r.json())
        .then(async d => {
          interface RawReportCardItem {
            id: string
            studentId: string
            student?: { firstName?: string | null; lastName?: string | null } | null
            generalAverage?: number | null
            classMasterComment?: string | null
            status?: string | null
          }
          const cards: ReportCard[] = ((d.reportCards ?? []) as RawReportCardItem[]).map((rc) => ({
            id: rc.id,
            studentId: rc.studentId,
            studentName: rc.student ? `${rc.student.lastName ?? ''} ${rc.student.firstName ?? ''}`.trim() : rc.studentId,
            generalAverage: rc.generalAverage ?? null,
            classMasterComment: rc.classMasterComment ?? null,
            status: rc.status ?? '',
          }))
          applyCachedCards(cards)
          setSaved({})
          await putCachedData(rcCacheKey, cards).catch(() => {})
        })
        .catch(async () => {
          const cached = await getCachedData<ReportCard[]>(rcCacheKey)
          if (cached?.data?.length) applyCachedCards(cached.data)
          else setError(t('pp.toast_error'))
        })
        .finally(() => setLoadingCards(false))
    } else {
      getCachedData<ReportCard[]>(rcCacheKey).then(cached => {
        if (cached?.data?.length) applyCachedCards(cached.data)
        else setError(t('pp.toast_error'))
      }).catch(() => setError(t('pp.toast_error')))
        .finally(() => setLoadingCards(false))
    }
  }, [selectedPeriodId, classeId, t])

  const debouncedComments = useDebounce(comments, 1500)
  const prevSavedRef = useRef<Record<string, string>>({})

  useEffect(() => {
    for (const [rcId, text] of Object.entries(debouncedComments)) {
      if (prevSavedRef.current[rcId] === text) continue
      prevSavedRef.current[rcId] = text

      const endpoint = `/api/v2/report-cards/${rcId}/comment`
      const payload = { classMasterComment: text }

      if (!isOnline) {
        addToQueue({ type: 'APPRECIATION_PP', endpoint, method: 'PATCH', payload })
        setSaved(s => ({ ...s, [rcId]: true }))
        setTimeout(() => setSaved(s => { const n = { ...s }; delete n[rcId]; return n }), 3000)
        continue
      }

      setSaving(s => ({ ...s, [rcId]: true }))
      fetchApi(endpoint, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(() => {
          setSaved(s => ({ ...s, [rcId]: true }))
          setTimeout(() => setSaved(s => { const n = { ...s }; delete n[rcId]; return n }), 3000)
        })
        .catch(() => {})
        .finally(() => setSaving(s => { const n = { ...s }; delete n[rcId]; return n }))
    }
  }, [debouncedComments, isOnline, addToQueue])

  const handleBulkSave = useCallback(async () => {
    const entries = Object.entries(comments)
    setBulkSaving(true)
    setBulkProgress(0)
    let done = 0
    for (const [rcId, text] of entries) {
      await fetchApi(`/api/v2/report-cards/${rcId}/comment`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classMasterComment: text }),
      }).catch(() => {})
      done++
      setBulkProgress(Math.round((done / entries.length) * 100))
    }
    setBulkSaving(false)
  }, [comments])

  const handleGenerateAI = useCallback(async (rcId: string) => {
    if ((comments[rcId] ?? '').trim() && !(await confirmAction(t('pp.ai_confirm_overwrite')))) return

    setAiError(e => { const n = { ...e }; delete n[rcId]; return n })
    setGeneratingAI(g => ({ ...g, [rcId]: true }))
    try {
      const res = await fetchApi(`/api/v2/report-cards/${rcId}/generate-comment`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (res.ok && data.success && data.comment) {
        setComments(c => ({ ...c, [rcId]: data.comment }))
        return
      }
      const rc = reportCards.find(item => item.id === rcId)
      if (!rc) throw new Error(data.message || 'Erreur')
      const fallbackRes = await fetchApi('/api/v2/ai/bulletin-comment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: rc.studentName,
          average: rc.generalAverage ?? 10,
          className: classeNom,
        }),
      })
      const fallbackData = await fallbackRes.json()
      if (!fallbackRes.ok || !fallbackData.comment) throw new Error(fallbackData.message || 'Erreur')
      setComments(c => ({ ...c, [rcId]: fallbackData.comment }))
    } catch {
      setAiError(e => ({ ...e, [rcId]: true }))
    } finally {
      setGeneratingAI(g => { const n = { ...g }; delete n[rcId]; return n })
    }
  }, [comments, t, reportCards, classeNom])

  const isLocked = (rc: ReportCard) => rc.status === 'LOCKED' || rc.status === 'SENT'

  const handleSubmit = useCallback(async () => {
    if (!myClassId || !currentPeriodId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetchApi('/api/v2/bulletin-validations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: myClassId, academicPeriodId: currentPeriodId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.message || 'Erreur lors de la soumission')
        return
      }
      setSubmissionStatus('SUBMITTED')
    } catch {
      setSubmitError('Erreur réseau lors de la soumission')
    } finally {
      setSubmitting(false)
    }
  }, [myClassId, currentPeriodId])

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      {classesList && classesList.length > 1 && (
        <div className="flex items-center gap-2 p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
          <span className="text-xs font-bold text-[var(--text3)] px-2 whitespace-nowrap">Mes classes PP :</span>
          {classesList.map(c => (
            <button
              key={c.id}
              onClick={() => onSelectClasse?.(c.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-extrabold cursor-pointer border transition-all ${
                c.id === classeId
                  ? 'bg-[var(--green)] text-white border-[var(--green)]'
                  : 'bg-[var(--bg)] text-[var(--text2)] border-[var(--border)] hover:text-[var(--text)]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <PenLine size={18} strokeWidth={2} />{t('pp.title')} {classeNom ? `· ${classeNom}` : ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>
            {t('pp.subtitle')}
          </div>
        </div>
        <button
          onClick={handleBulkSave}
          disabled={bulkSaving || reportCards.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
            background: bulkSaving ? 'var(--border)' : 'var(--sidebar)', color: bulkSaving ? 'var(--text3)' : 'white', transition: 'all 0.15s' }}>
          {bulkSaving ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Save size={13} strokeWidth={2} />}
          {bulkSaving ? t('pp.save_progress').replace('{progress}', String(bulkProgress)) : t('pp.save_all')}
        </button>
      </div>

      {bulkSaving && (
        <div style={{ background: 'var(--border)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--sidebar)', width: `${bulkProgress}%`, transition: 'width 0.3s' }} />
        </div>
      )}

      {periods.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {periods.map(p => (
            <button key={p.id} onClick={() => setSelectedPeriodId(p.id)}
              style={{ minHeight: 34, padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                background: selectedPeriodId === p.id ? 'var(--sidebar)' : 'var(--bg2)',
                color: selectedPeriodId === p.id ? 'white' : 'var(--text2)', flexShrink: 0 }}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <AppreciationSubmissionBanner
        currentPeriodId={currentPeriodId}
        submissionStatus={submissionStatus}
        submitting={submitting}
        submitError={submitError}
        isOnline={isOnline}
        onSubmit={handleSubmit}
      />

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>
          {t('pp.offline_hint')}
        </div>
      )}

      {error && <div style={{ padding: '10px 14px', background: 'var(--red-light)', borderRadius: 8, color: 'var(--red)', fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}

      {loadingCards ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('pp.loading_bulletins')}</div>
      ) : reportCards.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><ScrollText size={28} strokeWidth={2} /></div>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('pp.no_bulletins')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--border2)', marginTop: 4 }}>{t('pp.no_bulletins_hint')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reportCards.map(rc => (
            <AppreciationStudentCard
              key={rc.id}
              rc={rc}
              text={comments[rc.id] ?? ''}
              locked={isLocked(rc)}
              isSaving={Boolean(saving[rc.id])}
              isSaved={Boolean(saved[rc.id])}
              isGeneratingAI={Boolean(generatingAI[rc.id])}
              hasAiError={Boolean(aiError[rc.id])}
              isOnline={isOnline}
              onChangeText={(val) => setComments(c => ({ ...c, [rc.id]: val }))}
              onGenerateAI={() => handleGenerateAI(rc.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}
