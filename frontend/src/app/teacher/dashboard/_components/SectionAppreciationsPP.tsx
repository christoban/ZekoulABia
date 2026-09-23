'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { PenLine, Save, Loader2, Lock, ScrollText, Sparkles, Send, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { useT } from '@/lib/i18n'

interface Props {
  user: UserInfo
  classeId: string
}

interface Period {
  id: string
  name: string
  isCurrent?: boolean
}

interface ReportCard {
  id: string
  studentId: string
  studentName: string
  generalAverage: number | null
  classMasterComment: string | null
  status: string
}

const QUICK_CHIPS_KEYS = [
  'chip_satisfactory',
  'chip_can_improve',
  'chip_progressing',
  'chip_encouraging',
  'chip_effort_needed',
]

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function SectionAppreciationsPP({ user: _user, classeId }: Props) {
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

  // État soumission bulletin
  const [myClassId, setMyClassId] = useState<string | null>(null)
  const [currentPeriodId, setCurrentPeriodId] = useState<string | null>(null)
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Load periods from current academic year
  useEffect(() => {
    fetchApi('/api/v2/academic-years?isCurrent=true', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const years = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        const current = years[0]
        if (current?.periods?.length) {
          setPeriods(current.periods)
          setSelectedPeriodId(current.periods[0].id)
          const currentPer = current.periods.find((p: Period) => p.isCurrent)
          if (currentPer) setCurrentPeriodId(currentPer.id)
        }
      })
      .catch(() => {})
  }, [])

  // Load PP's class
  useEffect(() => {
    fetchApi('/api/v2/users/my-class', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.classId) setMyClassId(d.data.classId)
      })
      .catch(() => {})
  }, [])

  // Load submission status for current period
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

  // Load report cards when period changes
  useEffect(() => {
    if (!selectedPeriodId) return
    setLoadingCards(true)
    setError(null)
    fetchApi(`/api/v2/report-cards?classId=${classeId}&periodId=${selectedPeriodId}&limit=100`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const cards: ReportCard[] = (d.reportCards ?? []).map((rc: any) => ({
          id: rc.id,
          studentId: rc.studentId,
          studentName: rc.student ? `${rc.student.lastName ?? ''} ${rc.student.firstName ?? ''}`.trim() : rc.studentId,
          generalAverage: rc.generalAverage ?? null,
          classMasterComment: rc.classMasterComment ?? null,
          status: rc.status ?? '',
        }))
        setReportCards(cards)
        const init: Record<string, string> = {}
        for (const rc of cards) init[rc.id] = rc.classMasterComment ?? ''
        setComments(init)
        setSaved({})
      })
      .catch(() => setError(t('pp.toast_error')))
      .finally(() => setLoadingCards(false))
  }, [selectedPeriodId, classeId])

  // Debounced auto-save per report card
  const debouncedComments = useDebounce(comments, 1500)
  const prevSavedRef = useRef<Record<string, string>>({})

  useEffect(() => {
    for (const [rcId, text] of Object.entries(debouncedComments)) {
      if (prevSavedRef.current[rcId] === text) continue
      prevSavedRef.current[rcId] = text

      const endpoint = `/api/v2/report-cards/${rcId}/comment`
      const payload = { classMasterComment: text }

      if (!isOnline) {
        // Hors ligne : mise en file, rejouée automatiquement au retour du réseau (useSyncQueue)
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
    if ((comments[rcId] ?? '').trim() && !confirm(t('pp.ai_confirm_overwrite'))) return

    setAiError(e => { const n = { ...e }; delete n[rcId]; return n })
    setGeneratingAI(g => ({ ...g, [rcId]: true }))
    try {
      const res = await fetchApi(`/api/v2/report-cards/${rcId}/generate-comment`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Erreur')
      setComments(c => ({ ...c, [rcId]: data.comment }))
    } catch {
      setAiError(e => ({ ...e, [rcId]: true }))
    } finally {
      setGeneratingAI(g => { const n = { ...g }; delete n[rcId]; return n })
    }
  }, [comments, t])

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
        // Le backend renvoie le détail des élèves manquants dans data.message
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
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <PenLine size={18} strokeWidth={2} />{t('pp.title')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>
            {t('pp.subtitle')}
          </div>
        </div>
        <button
          onClick={handleBulkSave}
          disabled={bulkSaving || reportCards.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
            background: bulkSaving ? 'var(--border)' : 'var(--sidebar)', color: bulkSaving ? 'var(--text3)' : 'white', transition: 'all 0.15s' }}>
          {bulkSaving ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Save size={13} strokeWidth={2} />}
          {bulkSaving ? t('pp.save_progress').replace('{progress}', String(bulkProgress)) : t('pp.save_all')}
        </button>
      </div>

      {/* Barre progression bulk */}
      {bulkSaving && (
        <div style={{ background: 'var(--border)', borderRadius: 4, height: 4, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--sidebar)', width: `${bulkProgress}%`, transition: 'width 0.3s' }} />
        </div>
      )}

      {/* Sélecteur période */}
      {periods.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {periods.map(p => (
            <button key={p.id} onClick={() => setSelectedPeriodId(p.id)}
              style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                background: selectedPeriodId === p.id ? 'var(--sidebar)' : 'var(--bg2)',
                color: selectedPeriodId === p.id ? 'white' : 'var(--text2)' }}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Zone de soumission bulletin */}
      {currentPeriodId && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
            {submissionStatus === null ? (
              <>
                <Send size={15} strokeWidth={2} style={{ color: 'var(--amber)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Prêt pour soumission</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Les bulletins de la classe peuvent être soumis au censeur.</div>
                </div>
              </>
            ) : submissionStatus === 'SUBMITTED' ? (
              <>
                <Clock size={15} strokeWidth={2} style={{ color: 'var(--amber)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>En attente de validation</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Le censeur doit valider avant publication.</div>
                </div>
              </>
            ) : submissionStatus === 'VALIDATED' ? (
              <>
                <CheckCircle2 size={15} strokeWidth={2} style={{ color: 'var(--green)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>Validé, en attente de publication</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>L'administrateur doit publier les bulletins.</div>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} strokeWidth={2} style={{ color: 'var(--blue)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>Bulletins publiés</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Les parents ont été notifiés.</div>
                </div>
              </>
            )}
          </div>
          {submissionStatus === null && (
            <button
              onClick={handleSubmit}
              disabled={submitting || !isOnline}
              style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: submitting || !isOnline ? 'not-allowed' : 'pointer', border: 'none', fontFamily: 'inherit',
                background: submitting ? 'var(--border)' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: !isOnline ? 0.5 : 1 }}>
              {submitting ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Send size={13} strokeWidth={2} />}
              {submitting ? 'Envoi…' : 'Soumettre au censeur'}
            </button>
          )}
        </div>
      )}
      {submitError && (
        <div style={{ padding: '10px 14px', background: 'var(--red-light)', borderRadius: 8, color: 'var(--red)', fontSize: 12, fontWeight: 600, marginBottom: 12, whiteSpace: 'pre-line' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={13} strokeWidth={2} /> </span>
          {submitError}
        </div>
      )}

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
          {reportCards.map(rc => {
            const locked = isLocked(rc)
            const text = comments[rc.id] ?? ''
            const charCount = text.length
            return (
              <div key={rc.id} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px' }}>
                {/* Élève info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                      {rc.studentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{rc.studentName}</div>
                      {rc.generalAverage !== null && (
                        <div style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>{t('pp.average_label').replace('{average}', rc.generalAverage.toFixed(2))}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {saving[rc.id] && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}><Loader2 size={11} strokeWidth={2} className="animate-spin" />{t('pp.saving')}</span>}
                    {saved[rc.id] && !saving[rc.id] && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--green)', fontWeight: 700 }}><Save size={11} strokeWidth={2} />{t('pp.saved')}</span>}
                    {locked && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text2)', fontWeight: 700, background: 'var(--bg2)', padding: '2px 8px', borderRadius: 12 }}>
                        <Lock size={11} strokeWidth={2} />{t('pp.locked')}
                      </span>
                    )}
                  </div>
                </div>

                {locked ? (
                  <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12, fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Lock size={12} strokeWidth={2} />{t('pp.council_locked')}</span>
                    {text && <div style={{ marginTop: 4, color: 'var(--text2)', fontStyle: 'italic' }}>&ldquo;{text}&rdquo;</div>}
                  </div>
                ) : (
                  <>
                    {/* Génération IA & Chips */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleGenerateAI(rc.id)}
                        disabled={!isOnline || !!generatingAI[rc.id]}
                        title={!isOnline ? t('pp.ai_offline_disabled') : undefined}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 12, fontSize: 11.5, fontWeight: 700,
                          cursor: !isOnline || generatingAI[rc.id] ? 'not-allowed' : 'pointer', border: '1px solid var(--purple)',
                          background: 'var(--purple-light)', color: 'var(--purple)', fontFamily: 'inherit',
                          opacity: !isOnline ? 0.5 : 1 }}>
                        {generatingAI[rc.id] ? <Loader2 size={11} strokeWidth={2} className="animate-spin" /> : <Sparkles size={11} strokeWidth={2} />}
                        {generatingAI[rc.id] ? t('pp.generating_ai') : t('pp.generate_ai')}
                      </button>
                      {aiError[rc.id] && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>{t('pp.ai_error')}</span>}

                      {QUICK_CHIPS_KEYS.map(key => {
                        const chip = t(`pp.${key}`)
                        return (
                          <button key={key} onClick={() => setComments(c => ({ ...c, [rc.id]: chip }))}
                            style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontFamily: 'inherit', transition: 'all 0.12s' }}
                            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'var(--sidebar)', color: 'white', borderColor: 'var(--sidebar)' })}
                            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'var(--surface)', color: 'var(--text2)', borderColor: 'var(--border2)' })}>
                            {chip}
                          </button>
                        )
                      })}
                    </div>

                    {/* Textarea */}
                    <div style={{ position: 'relative' }}>
                      <textarea
                        value={text}
                        onChange={e => setComments(c => ({ ...c, [rc.id]: e.target.value }))}
                        maxLength={300}
                        placeholder={t('pp.write_placeholder')}
                        rows={2}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border2)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500, color: 'var(--text)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'var(--sidebar)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                      />
                      <div style={{ position: 'absolute', bottom: 6, right: 10, fontSize: 10, color: charCount > 270 ? 'var(--red)' : 'var(--text3)', fontWeight: 600 }}>
                        {charCount}/300
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
