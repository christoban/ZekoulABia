'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Calendar, Star, ChevronRight, Loader2, Pencil, FolderOpen, X, Lock, Save, Check } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface AcademicSequence {
  id: string; name: string; type: string; orderIndex: number
  startDate: string | null; endDate: string | null; isCurrent: boolean
}
interface AcademicPeriod {
  id: string; name: string; type: string; orderIndex: number
  startDate: string; endDate: string; isCurrent: boolean
  sequences: AcademicSequence[]
}
interface AcademicYear {
  id: string; name: string
  startDate: string; endDate: string
  isCurrent: boolean; status: string
  periods: AcademicPeriod[]
}

type PStatus = 'done' | 'active' | 'pending'

interface CalSequence {
  id?: string; name: string; type: string; orderIndex: number; startDate: string; endDate: string
}
interface CalPeriode {
  id?: string; name: string; type: 'TRIMESTER' | 'SEMESTER'; orderIndex: number
  startDate: string; endDate: string; sequences: CalSequence[]
}

const STATUS_BADGE: Record<PStatus, { bg: string; color: string }> = {
  done:    { bg: 'var(--green-light)', color: 'var(--green)' },
  active:  { bg: 'var(--amber-light)', color: 'var(--amber)' },
  pending: { bg: 'var(--bg2)', color: 'var(--text2)' },
}

function getPStatus(isCurrent: boolean, startDate: string, endDate: string): PStatus {
  if (isCurrent) return 'active'
  const now = Date.now()
  if (new Date(endDate).getTime() < now) return 'done'
  return 'pending'
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const EMPTY_YEAR = { name: '', startDate: '', endDate: '', loading: false, error: '' }
const EMPTY_CAL = { open: false, yearId: '', yearName: '', periodes: [] as CalPeriode[], loading: false, error: '' }

interface FeePlanItem {
  id: string; name: string; amount: number; feeType: string
  level: string | null; isRefundable: boolean; dueDate: string | null
  description: string | null; sectionId: string | null
}
interface ReconductionRow extends FeePlanItem { include: boolean; editedAmount: string }
const EMPTY_RECONDUCTION = {
  open: false, targetYearId: '', targetYearName: '',
  rows: [] as ReconductionRow[], loading: false, submitting: false, error: '',
}

export default function SectionAcademicYear({ onToast }: Props) {
  const t = useT('admin')
  const [years, setYears]         = useState<AcademicYear[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [openPeriods, setOpenPeriods] = useState<Set<string>>(new Set())
  const [closingId, setClosingId] = useState<string | null>(null)
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null)
  const [settingSequenceId, setSettingSequenceId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm]             = useState(EMPTY_YEAR)
  const [calForm, setCalForm]       = useState(EMPTY_CAL)
  const [reconduction, setReconduction] = useState(EMPTY_RECONDUCTION)

  const fetchYears = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/academic-years', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.errServer'))
      const list: AcademicYear[] = data.data || []
      setYears(list)
      // Ouvrir automatiquement les périodes de l'année courante
      const current = list.find(y => y.isCurrent)
      if (current) {
        setOpenPeriods(new Set(current.periods.map(p => p.id)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('academic_year.toast.errLoad'))
    } finally {
      setLoading(false)
    }
  }, [])

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
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleClose = async (yearId: string) => {
    if (!confirm(t('academic_year.toast.confirmClose'))) return
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

  const submitCreate = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setForm(f => ({ ...f, error: t('academic_year.toast.requiredFields') })); return
    }
    setForm(f => ({ ...f, loading: true, error: '' }))
    // Capturée avant la création : sert de source par défaut pour la proposition de
    // reconduction des plans de frais juste après (année qui était courante jusqu'ici).
    const previousCurrentYearId = years.find(y => y.isCurrent)?.id ?? null
    try {
      const res = await fetchApi('/api/v2/academic-years', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), startDate: form.startDate, endDate: form.endDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.err'))
      onToast(t('academic_year.toast.yearCreated', { name: form.name }), 'success')
      const targetYearId: string = data.data?.anneeId
      const targetYearName: string = form.name.trim()
      setCreateOpen(false); setForm(EMPTY_YEAR); fetchYears()
      if (targetYearId) openReconductionReview(targetYearId, targetYearName, previousCurrentYearId)
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : t('academic_year.toast.err'), loading: false }))
    }
  }

  // ── Reconduction des plans de frais vers la nouvelle année ────────────────
  const openReconductionReview = async (targetYearId: string, targetYearName: string, sourceYearId: string | null) => {
    setReconduction({ ...EMPTY_RECONDUCTION, open: true, targetYearId, targetYearName, loading: true })
    try {
      // Priorité aux plans déjà rattachés à l'année précédente ; si aucun (premier usage de
      // la reconduction — aucun plan n'est encore rattaché à une année), on retombe sur
      // l'ensemble des plans "évergreens" actuels comme base de départ.
      let plans: FeePlanItem[] = []
      if (sourceYearId) {
        const res = await fetchApi(`/api/v2/finance/fee-plans?academicYearId=${sourceYearId}`, { credentials: 'include' })
        const data = await res.json()
        if (res.ok) plans = data.data ?? []
      }
      if (plans.length === 0) {
        const res = await fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' })
        const data = await res.json()
        if (res.ok) plans = data.data ?? []
      }
      const rows: ReconductionRow[] = plans.map(p => ({ ...p, include: true, editedAmount: String(p.amount) }))
      setReconduction(r => ({ ...r, loading: false, rows }))
    } catch {
      setReconduction(r => ({ ...r, loading: false, error: t('academic_year.toast.err') }))
    }
  }

  const closeReconduction = () => setReconduction(EMPTY_RECONDUCTION)

  const toggleReconductionRow = (id: string) => {
    setReconduction(r => ({ ...r, rows: r.rows.map(row => row.id === id ? { ...row, include: !row.include } : row) }))
  }

  const setReconductionAmount = (id: string, amount: string) => {
    setReconduction(r => ({ ...r, rows: r.rows.map(row => row.id === id ? { ...row, editedAmount: amount } : row) }))
  }

  const confirmReconduction = async () => {
    const included = reconduction.rows.filter(row => row.include)
    if (included.length === 0) { closeReconduction(); return }
    setReconduction(r => ({ ...r, submitting: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/finance/fee-plans/copy-from-previous-year', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAcademicYearId: reconduction.targetYearId,
          plans: included.map(row => ({
            name: row.name,
            amount: parseFloat(row.editedAmount),
            feeType: row.feeType,
            level: row.level ?? undefined,
            sectionId: row.sectionId ?? undefined,
            isRefundable: row.isRefundable,
            dueDate: row.dueDate ?? undefined,
            description: row.description ?? undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.err'))
      const { crees, erreurs } = data.data as { crees: number; erreurs: { name: string; message: string }[] }
      if (erreurs?.length > 0) {
        onToast(`${crees} plan(s) reconduit(s), ${erreurs.length} échec(s) : ${erreurs.map((e) => e.name).join(', ')}`, crees > 0 ? 'info' : 'error')
      } else {
        onToast(`${crees} plan(s) de frais reconduit(s) pour ${reconduction.targetYearName}`, 'success')
      }
      closeReconduction()
    } catch (err) {
      setReconduction(r => ({ ...r, submitting: false, error: err instanceof Error ? err.message : t('academic_year.toast.err') }))
    }
  }

  // ── Calendrier scolaire ─────────────────────────────────────────────────
  const openCalendar = (year: AcademicYear) => {
    setCalForm({
      open: true, yearId: year.id, yearName: year.name, loading: false, error: '',
      periodes: year.periods.map(p => ({
        id: p.id, name: p.name,
        type: p.type as 'TRIMESTER' | 'SEMESTER',
        orderIndex: p.orderIndex,
        startDate: toDateInput(p.startDate),
        endDate: toDateInput(p.endDate),
        sequences: p.sequences.map(s => ({
          id: s.id, name: s.name, type: s.type, orderIndex: s.orderIndex,
          startDate: toDateInput(s.startDate), endDate: toDateInput(s.endDate),
        })),
      })),
    })
  }

  const submitCalendar = async () => {
    for (const p of calForm.periodes) {
      if (!p.name.trim() || !p.startDate || !p.endDate) {
        setCalForm(f => ({ ...f, error: t('academic_year.toast.fillPeriods') })); return
      }
      if (p.startDate >= p.endDate) {
        setCalForm(f => ({ ...f, error: t('academic_year.toast.invalidDates', { name: p.name }) })); return
      }
      for (const s of p.sequences) {
        if (!s.name.trim() || !s.type.trim()) {
          setCalForm(f => ({ ...f, error: t('academic_year.toast.fillSequences') })); return
        }
      }
    }
    setCalForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const body = {
        periodes: calForm.periodes.map(p => ({
          ...(p.id ? { id: p.id } : {}),
          name: p.name.trim(), type: p.type, orderIndex: p.orderIndex,
          startDate: p.startDate, endDate: p.endDate,
          sequences: p.sequences.map(s => ({
            ...(s.id ? { id: s.id } : {}),
            name: s.name.trim(), type: s.type.trim(), orderIndex: s.orderIndex,
            ...(s.startDate ? { startDate: s.startDate } : {}),
            ...(s.endDate ? { endDate: s.endDate } : {}),
          })),
        })),
      }
      const res = await fetchApi(`/api/v2/academic-years/${calForm.yearId}/calendar`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        let errMsg = data.message || t('academic_year.toast.errServer')
        if (res.status === 422 && (errMsg.toLowerCase().includes('archiv')))
          errMsg = t('academic_year.toast.yearArchived')
        else if (res.status === 422)
          errMsg = t('academic_year.toast.invalidPeriodDates')
        setCalForm(f => ({ ...f, error: errMsg, loading: false })); return
      }
      onToast(t('academic_year.toast.calendarUpdated'), 'success')
      setCalForm(EMPTY_CAL); fetchYears()
    } catch (err) {
      setCalForm(f => ({ ...f, error: err instanceof Error ? err.message : t('academic_year.toast.err'), loading: false }))
    }
  }

  const updP = (pi: number, field: string, val: unknown) =>
    setCalForm(f => ({ ...f, periodes: f.periodes.map((p, i) => i === pi ? { ...p, [field]: val } : p) }))

  const updS = (pi: number, si: number, field: string, val: unknown) =>
    setCalForm(f => ({
      ...f,
      periodes: f.periodes.map((p, i) => i !== pi ? p : {
        ...p, sequences: p.sequences.map((s, j) => j !== si ? s : { ...s, [field]: val })
      })
    }))

  const addPeriode = () => setCalForm(f => ({
    ...f,
    periodes: [...f.periodes, { name: '', type: 'TRIMESTER' as const, orderIndex: f.periodes.length + 1, startDate: '', endDate: '', sequences: [] }]
  }))

  const remPeriode = (pi: number) =>
    setCalForm(f => ({ ...f, periodes: f.periodes.filter((_, i) => i !== pi) }))

  const addSeq = (pi: number) => setCalForm(f => ({
    ...f,
    periodes: f.periodes.map((p, i) => i !== pi ? p : {
      ...p, sequences: [...p.sequences, { name: '', type: '', orderIndex: p.sequences.length + 1, startDate: '', endDate: '' }]
    })
  }))

  const remSeq = (pi: number, si: number) => setCalForm(f => ({
    ...f,
    periodes: f.periodes.map((p, i) => i !== pi ? p : { ...p, sequences: p.sequences.filter((_, j) => j !== si) })
  }))

  const currentYear  = years.find(y => y.isCurrent)
  const historyYears = years.filter(y => !y.isCurrent)
  const currentPeriod = currentYear?.periods.find(p => p.isCurrent)
  const currentSeq    = currentPeriod?.sequences.find(s => s.isCurrent)

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('academic_year.title')}</div>
          <div className="text-[13px] md:text-[14px]" style={sSub}>{t('academic_year.subtitle')}</div>
        </div>
        <button className="hidden md:inline-block" style={btnPrim} onClick={() => setCreateOpen(true)}>{t('academic_year.newYear')}</button>
        <button
          className="md:hidden inline-flex items-center rounded-full px-[14px] py-[9px] text-[12px] border-0 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={() => setCreateOpen(true)}>+ {t('academic_year.newYear')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 52 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 8, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
          <AlertTriangle size={15} strokeWidth={2} />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchYears}
            style={{ padding: '7px 12px', borderRadius: 9, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            {t('academic_year.retry')}
          </button>
        </div>
      )}

      {!loading && !error && years.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', padding: '39px 20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Calendar size={16} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('academic_year.noYear')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>{t('academic_year.noYearHint')}</div>
          <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('academic_year.createYear')}</button>
        </div>
      )}

      {!loading && !error && currentYear && (
        <>
          {/* Bannière année courante */}
          <div className="rounded-[18px] md:rounded-[20px] p-[22px] md:px-[36px] md:py-[32px] mb-[16px] md:mb-[22px]" style={{
            background: 'linear-gradient(135deg,var(--sidebar) 0%,var(--sidebar2) 60%,var(--sidebar) 100%)',
            border: '1.5px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden',
          }}>
            <div className="hidden md:block" style={{ position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)', opacity: 0.04, color: 'white', pointerEvents: 'none' }}><Star size={16} fill="white" /></div>

            <div className="mb-[16px] md:mb-[20px]" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="text-[11px] md:text-[13px] mb-[6px] md:mb-[8px]" style={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  {t('academic_year.currentYearLabel')}
                </div>
                <div className="text-[20px] md:text-[30px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                  {currentYear.name}
                </div>
                <div className="text-[13px] md:text-[14px] mt-[6px] md:mt-[8px]" style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                  {fmtDate(currentYear.startDate)} → {fmtDate(currentYear.endDate)}
                </div>
              </div>
              {currentSeq && (
                <span className="text-[13px] md:text-[12px] px-[14px] md:px-[16px] py-[5px] md:py-[6px]" style={{ background: 'var(--amber-light)', color: 'var(--amber)', borderRadius: 10, fontWeight: 800, alignSelf: 'flex-start', marginTop: 8 }}>
                  {t('academic_year.seqInProgress', { name: currentSeq.name })}
                </span>
              )}
            </div>

            {currentPeriod && (
              <div className="gap-3.5 md:gap-[28px]" style={{ display: 'flex', flexWrap: 'wrap' }}>
                {[
                  { label: t('academic_year.currentPeriodLabel'), value: currentPeriod.name },
                  { label: t('academic_year.type'), value: currentPeriod.type === 'TRIMESTER' ? t('academic_year.trimesters') : t('academic_year.semesters') },
                  currentSeq ? { label: t('academic_year.sequenceLabel'), value: currentSeq.name } : null,
                ].filter(Boolean).map((m, i) => m && (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div className="text-[11px] md:text-[13px]" style={{ fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {m.label}
                    </div>
                    <div className="text-[12px] md:text-[14px]" style={{ fontWeight: 700, color: 'white' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calendrier scolaire */}
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', overflow: 'hidden', marginBottom: 14 }}>
            <div className="px-[16px] py-[13px] md:px-[22px] md:py-3" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span className="text-[14.5px] md:text-[14px]" style={{ fontWeight: 800, color: 'var(--text)' }}>
                {t('academic_year.calendarTitle', { name: currentYear.name })}
              </span>
              <button style={btnSecSm} onClick={() => openCalendar(currentYear)}>{t('academic_year.editCalendar')}</button>
            </div>

            {currentYear.periods.length === 0 ? (
              <div style={{ padding: '19px 15px', color: 'var(--text3)', textAlign: 'center' }}>
                {t('academic_year.noPeriod')}
              </div>
            ) : (
              currentYear.periods.map((period) => {
                const ps = getPStatus(period.isCurrent, period.startDate, period.endDate)
                const badge = STATUS_BADGE[ps]
                const open = openPeriods.has(period.id)
                return (
                  <div key={period.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div
                      onClick={() => togglePeriod(period.id)}
                      className="gap-[10px] md:gap-[14px] px-[16px] py-2.5 md:px-[22px] md:py-[18px]"
                      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer', userSelect: 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <span style={{ color: 'var(--text3)', transition: 'transform 0.2s', display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}><ChevronRight size={14} /></span>
                      <span className="text-[12px] md:text-[16px] md:[font-family:var(--font-spectral),Spectral,serif]" style={{ fontWeight: 700, color: 'var(--text)', flex: 1 }}>{period.name}</span>
                      <span className="text-[12px] md:text-[13px]" style={{ color: 'var(--text3)', fontWeight: 600 }}>
                        {fmtDate(period.startDate)} → {fmtDate(period.endDate)}
                      </span>
                      <span className="text-[11.5px] md:text-[12px] px-[10px] md:px-[12px] py-[3px] md:py-[4px]" style={{ background: badge.bg, color: badge.color, borderRadius: 10, fontWeight: 800 }}>
                        {t(`academic_year.status.${ps}`)}
                      </span>
                      {!period.isCurrent && (
                        <button
                          style={btnSecSm}
                          onClick={e => { e.stopPropagation(); handleSetCurrent(period.id) }}
                          disabled={settingCurrentId === period.id}>
                          {settingCurrentId === period.id ? <Loader2 size={14} className="animate-spin" /> : t('academic_year.setActive')}
                        </button>
                      )}
                    </div>

                    {open && period.sequences.length > 0 && (
                      <div className="px-[14px] pb-[14px] md:px-[22px] md:pb-[20px]" style={{ paddingTop: 0 }}>
                        <div className="border-l-[2px] md:border-l-[3px] ml-[6px] md:ml-[10px] pl-[16px] md:pl-[22px]" style={{ borderColor: 'var(--border)', display: 'flex', flexDirection: 'column' }}>
                          {period.sequences.map((seq, si) => {
                            const ss = getPStatus(seq.isCurrent, seq.startDate ?? period.startDate, seq.endDate ?? period.endDate)
                            const sb = STATUS_BADGE[ss]
                            return (
                              <div key={seq.id} className="gap-[8px] md:gap-[14px] py-[9px] md:py-[12px]" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', position: 'relative', borderBottom: si < period.sequences.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <div className="w-[10px] h-[10px] md:w-[13px] md:h-[13px] left-[-22px] md:left-[-30px]" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', borderRadius: '50%', background: ss === 'done' ? 'var(--green)' : ss === 'active' ? 'var(--amber)' : 'var(--border2)', border: '2px solid white', boxShadow: ss === 'active' ? '0 0 0 4px rgba(217,119,6,0.18)' : 'none' }} />
                                <span className="text-[13.5px] md:text-[14px] min-w-[90px] md:min-w-[120px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{seq.name}</span>
                                <span className="text-[12px] md:text-[13px]" style={{ color: 'var(--text3)', fontWeight: 600, flex: 1 }}>
                                  {seq.startDate ? `${fmtDate(seq.startDate)} → ${fmtDate(seq.endDate)}` : t('academic_year.noDates')}
                                </span>
                                <span className="text-[11px] md:text-[13px] px-[8px] md:px-[10px] py-[2px] md:py-[3px]" style={{ background: sb.bg, color: sb.color, borderRadius: 10, fontWeight: 800 }}>
                                  {t(`academic_year.status.${ss}`)}
                                </span>
                                {!seq.isCurrent && (
                                  <button
                                    className="text-[12px] md:text-[13px] px-[10px] md:px-[14px] py-[5px] md:py-[7px]"
                                    style={{ ...btnSecSm, fontSize: undefined, padding: undefined }}
                                    onClick={e => { e.stopPropagation(); handleSetSequenceCurrent(seq.id) }}
                                    disabled={settingSequenceId === seq.id}>
                                    {settingSequenceId === seq.id ? <Loader2 size={14} className="animate-spin" /> : t('academic_year.setActiveFem')}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Historique */}
      {!loading && !error && historyYears.length > 0 && (
        <div className="rounded-none md:rounded-[10px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]" style={{ overflow: 'hidden', marginBottom: 14 }}>
          <div className="px-0 pb-[10px] md:px-[22px] md:py-3 md:border-b md:border-[var(--border)]">
            <span className="text-[12.5px] md:text-[14px] uppercase md:normal-case" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('academic_year.historyTitle')}</span>
          </div>
          {/* ── Cartes empilées — mobile ── */}
          <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
            {historyYears.map((y) => (
              <div key={y.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div className="text-[13.5px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{y.name}</div>
                  <span className="text-[10.5px]" style={{ background: y.status === 'CLOSED' ? 'var(--bg2)' : 'var(--green-light)', color: y.status === 'CLOSED' ? 'var(--text2)' : 'var(--green)', padding: '3px 9px', borderRadius: 10, fontWeight: 800, flexShrink: 0 }}>
                    {y.status === 'CLOSED' ? t('academic_year.archived') : y.status}
                  </span>
                </div>
                <div className="text-[11.5px]" style={{ color: 'var(--text3)', marginTop: 4 }}>{fmtDate(y.startDate)} → {fmtDate(y.endDate)}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button className="text-[12px] px-[10px] py-[5px]" style={{ ...btnSecSm, fontSize: undefined, padding: undefined }} onClick={() => onToast(t('academic_year.archivesToast', { name: y.name }), 'info')}>{t('academic_year.view')}</button>
                  <button className="text-[12px] px-[10px] py-[5px]" style={{ ...btnSecSm, fontSize: undefined, padding: undefined }} onClick={() => openCalendar(y)}>{t('academic_year.calendar')}</button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Tableau — desktop ── */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>{[t('academic_year.thYear'), t('academic_year.thFrom'), t('academic_year.thTo'), t('academic_year.thStatus'), t('academic_year.thActions')].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {historyYears.map((y) => (
                  <tr key={y.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                    <td style={tdStyle}>
                      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{y.name}</div>
                    </td>
                    <td style={tdStyle}>{fmtDate(y.startDate)}</td>
                    <td style={tdStyle}>{fmtDate(y.endDate)}</td>
                    <td style={tdStyle}>
                      <span style={{ background: y.status === 'CLOSED' ? 'var(--bg2)' : 'var(--green-light)', color: y.status === 'CLOSED' ? 'var(--text2)' : 'var(--green)', padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800 }}>
                        {y.status === 'CLOSED' ? t('academic_year.archived') : y.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={btnSecSm} onClick={() => onToast(t('academic_year.archivesToast', { name: y.name }), 'info')}>{t('academic_year.view')}</button>
                        <button style={btnSecSm} onClick={() => openCalendar(y)}>{t('academic_year.calendar')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Danger zone — clôture de l'année courante */}
      {!loading && !error && currentYear && (
        <div className="rounded-[10px] md:rounded-[18px] border-[1.5px] md:border-2" style={{ background: 'var(--surface)', borderColor: 'rgba(220,38,38,0.2)', borderStyle: 'solid', overflow: 'hidden' }}>
          <div className="px-[14px] py-[13px] md:px-[26px] md:py-[20px] gap-[8px] md:gap-[12px]" style={{ background: 'var(--red-light)', borderBottom: '1px solid rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center' }}>
            <AlertTriangle size={16} className="md:hidden" color="var(--red)" />
            <AlertTriangle size={15} className="hidden md:block" color="var(--red)" />
            <div className="text-[13.5px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--red)' }}>{t('academic_year.dangerZone')}</div>
          </div>
          <div className="p-[14px] md:px-[26px] md:py-[22px]">
            <p className="text-[12.5px] md:text-[14px] mb-[14px] md:mb-[20px]" style={{ color: 'var(--text2)', lineHeight: 1.55 }}>
              {t('academic_year.dangerText')}
            </p>
            <button
              className="w-full md:w-auto text-[12.5px] md:text-[13px] py-[11px] md:py-[10px] px-[16px] md:px-3.5 rounded-[10px] md:rounded-[11px]"
              style={{ background: 'var(--red-light)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: closingId ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 800, opacity: closingId ? 0.6 : 1 }}
              onClick={() => handleClose(currentYear.id)}
              disabled={!!closingId}>
              {closingId ? t('academic_year.closingInProgress') : t('academic_year.closeYear', { name: currentYear.name })}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal calendrier scolaire ── */}
      {calForm.open && (
        <div onClick={() => setCalForm(EMPTY_CAL)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 10, width: 720, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('academic_year.calModalTitle')}</div>
            <div className="text-[13.5px] md:text-[13px]" style={{ color: 'var(--text3)', marginBottom: 15 }}>{calForm.yearName}</div>

            {calForm.periodes.map((p, pi) => (
              <div key={pi} style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: 18, marginBottom: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, color: 'var(--text)', fontSize: 13 }}>{t('academic_year.periodN', { n: pi + 1 })}</span>
                  <button onClick={() => remPeriode(pi)} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{t('academic_year.delete')}</button>
                </div>
                <div className="grid grid-cols-2 sm:[grid-template-columns:1fr_1fr_80px]" style={{ gap: 10 }}>
                  <div>
                    <div className={sLbCls} style={sLb}>{t('academic_year.nameReq')}</div>
                    <input className={sInCls} style={sIn} value={p.name} onChange={e => updP(pi, 'name', e.target.value)} placeholder={t('academic_year.trimesterPlaceholder')} />
                  </div>
                  <div>
                    <div className={sLbCls} style={sLb}>{t('academic_year.typeReq')}</div>
                    <select className={sInCls} style={sIn} value={p.type} onChange={e => updP(pi, 'type', e.target.value)}>
                      <option value="TRIMESTER">{t('academic_year.trimester')}</option>
                      <option value="SEMESTER">{t('academic_year.semester')}</option>
                    </select>
                  </div>
                  <div>
                    <div className={sLbCls} style={sLb}>{t('academic_year.order')}</div>
                    <input className={sInCls} style={sIn} type="number" min={1} value={p.orderIndex} onChange={e => updP(pi, 'orderIndex', parseInt(e.target.value) || 1)} />
                  </div>
                </div>
                <div className="grid grid-cols-2" style={{ gap: 10 }}>
                  <div>
                    <div className={sLbCls} style={sLb}>{t('academic_year.startDateReq')}</div>
                    <input className={sInCls} style={sIn} type="date" value={p.startDate} onChange={e => updP(pi, 'startDate', e.target.value)} />
                  </div>
                  <div>
                    <div className={sLbCls} style={sLb}>{t('academic_year.endDateReq')}</div>
                    <input className={sInCls} style={sIn} type="date" value={p.endDate} onChange={e => updP(pi, 'endDate', e.target.value)} />
                  </div>
                </div>

                <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--text2)', fontSize: 12, marginBottom: 10 }}>{t('academic_year.sequences')}</div>
                  {p.sequences.map((seq, si) => (
                    <div key={si} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 11px', marginBottom: 10, border: '1px solid var(--bg2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text2)', fontSize: 12 }}>{t('academic_year.sequenceN', { n: si + 1 })}</span>
                        <button onClick={() => remSeq(pi, si)} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center' }}><X size={12} /></button>
                      </div>
                      <div className="grid grid-cols-2 sm:[grid-template-columns:1fr_1fr_70px]" style={{ gap: 8 }}>
                        <div>
                          <div className={sLbCls} style={sLb}>{t('academic_year.nameReq')}</div>
                          <input className={sInCls} style={{ ...sIn, marginBottom: 0 }} value={seq.name} onChange={e => updS(pi, si, 'name', e.target.value)} placeholder={t('academic_year.assignmentPlaceholder')} />
                        </div>
                        <div>
                          <div className={sLbCls} style={sLb}>{t('academic_year.typeReq')}</div>
                          <input className={sInCls} style={{ ...sIn, marginBottom: 0 }} value={seq.type} onChange={e => updS(pi, si, 'type', e.target.value)} placeholder="DS1" />
                        </div>
                        <div>
                          <div className={sLbCls} style={sLb}>{t('academic_year.order')}</div>
                          <input className={sInCls} style={{ ...sIn, marginBottom: 0 }} type="number" min={1} value={seq.orderIndex} onChange={e => updS(pi, si, 'orderIndex', parseInt(e.target.value) || 1)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2" style={{ gap: 8, marginTop: 8 }}>
                        <div>
                          <div className={sLbCls} style={sLb}>{t('academic_year.startOptional')}</div>
                          <input className={sInCls} style={{ ...sIn, marginBottom: 0 }} type="date" value={seq.startDate} onChange={e => updS(pi, si, 'startDate', e.target.value)} />
                        </div>
                        <div>
                          <div className={sLbCls} style={sLb}>{t('academic_year.endOptional')}</div>
                          <input className={sInCls} style={{ ...sIn, marginBottom: 0 }} type="date" value={seq.endDate} onChange={e => updS(pi, si, 'endDate', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button style={btnSecSm} onClick={() => addSeq(pi)}>{t('academic_year.addSequence')}</button>
                </div>
              </div>
            ))}

            <button style={{ ...btnSecSm, width: '100%', marginBottom: 14 }} onClick={addPeriode}>{t('academic_year.addPeriod')}</button>

            {calForm.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 9, padding: '10px 11px', fontSize: 13, fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>{calForm.error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setCalForm(EMPTY_CAL)}>{t('academic_year.cancel')}</button>
              <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: calForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: calForm.loading ? 0.7 : 1 }} onClick={submitCalendar} disabled={calForm.loading}>
                {calForm.loading ? t('academic_year.saving') : t('academic_year.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal créer une année ── */}
      {createOpen && (
        <ModalOverlay onClose={() => { setCreateOpen(false); setForm(EMPTY_YEAR) }}>
          <div className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
            {t('academic_year.createYearTitle')}
          </div>
          <div className={sLbCls} style={sLb}>{t('academic_year.nameReq')}</div>
          <input
            className={sInCls} style={sIn}
            placeholder={t('academic_year.yearPlaceholder')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div className={sLbCls} style={sLb}>{t('academic_year.startDateFull')}</div>
              <input type="date"
                className={sInCls} style={sIn}
                value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <div className={sLbCls} style={sLb}>{t('academic_year.endDateFull')}</div>
              <input type="date"
                className={sInCls} style={sIn}
                value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          {form.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{form.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => { setCreateOpen(false); setForm(EMPTY_YEAR) }}>{t('academic_year.cancel')}</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: form.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: form.loading ? 0.7 : 1 }}
              onClick={submitCreate} disabled={form.loading}>
              {form.loading ? t('academic_year.creating') : t('academic_year.create')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal revue de reconduction des plans de frais ── */}
      {reconduction.open && (
        <div onClick={closeReconduction} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 10, width: 640, maxWidth: '94vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Reconduire les plans de frais ?
            </div>
            <div className="text-[13px] md:text-[12px]" style={{ color: 'var(--text3)', marginBottom: 13 }}>
              Vers <strong>{reconduction.targetYearName}</strong> — décochez les plans à ne pas reconduire, ajustez les montants si besoin. Rien n&apos;est créé tant que vous n&apos;avez pas confirmé.
            </div>

            {reconduction.loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 19 }}><Loader2 size={15} className="animate-spin" /></div>
            )}

            {!reconduction.loading && reconduction.rows.length === 0 && (
              <div style={{ padding: '14px', color: 'var(--text3)', fontSize: 12 }}>Aucun plan de frais existant à reconduire.</div>
            )}

            {!reconduction.loading && reconduction.rows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 13 }}>
                {reconduction.rows.map(row => (
                  <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: row.include ? 'var(--bg2)' : 'transparent', opacity: row.include ? 1 : 0.5 }}>
                    <input type="checkbox" checked={row.include} onChange={() => toggleReconductionRow(row.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{row.feeType}{row.level ? ` — ${row.level}` : ''}</div>
                    </div>
                    <input
                      type="number" value={row.editedAmount} disabled={!row.include}
                      onChange={e => setReconductionAmount(row.id, e.target.value)}
                      style={{ width: 110, padding: '7px 10px', borderRadius: 8, fontSize: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'right' }} />
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>FCFA</span>
                  </div>
                ))}
              </div>
            )}

            {reconduction.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{reconduction.error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
                onClick={closeReconduction}>Ignorer</button>
              <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: reconduction.submitting ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: reconduction.submitting ? 0.7 : 1 }}
                onClick={confirmReconduction} disabled={reconduction.submitting || reconduction.loading || reconduction.rows.length === 0}>
                {reconduction.submitting ? 'Reconduction…' : `Reconduire (${reconduction.rows.filter(r => r.include).length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 14px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '7px 11px', borderRadius: 9, fontSize: 13, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: 14, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

const sLbCls = 'text-[11.5px] md:text-[13px]'
const sLb: React.CSSProperties = { fontWeight: 700, color: 'var(--text3)', marginBottom: 4, display: 'block' }
const sInCls = 'rounded-[9px] px-[10px] py-[8px] mb-[8px] text-[12.5px] md:px-[12px] md:py-[9px] md:mb-[10px] md:text-[12px]'
const sIn: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }

function toDateInput(d: string | null): string {
  if (!d) return ''
  try { return new Date(d).toISOString().slice(0, 10) }
  catch { return '' }
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 10, width: 460, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}
