'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { AlertTriangle, CheckCircle2, Check, X, Loader2, Gavel, Download, WifiOff } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface StudentResult { id: string; firstName: string; lastName: string }
interface DisciplineRecord {
  id: string; type: string; reason: string; status: string
  startDate: string | null; endDate: string | null; createdAt: string
  student: { id: string; firstName: string; lastName: string }
  decidedBy: { id: string; firstName: string; lastName: string }
}

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  WARNING_ORAL:         { bg: 'var(--amber-light)', color: 'var(--amber)' },
  WARNING_WRITTEN:      { bg: 'var(--amber-light)', color: 'var(--amber)' },
  TEMP_EXCLUSION:       { bg: 'var(--red-light)', color: 'var(--red)' },
  COUNCIL_DECISION:     { bg: 'var(--purple-light)', color: 'var(--purple)' },
  PERMANENT_EXCLUSION:  { bg: 'var(--red-light)', color: 'var(--red)' },
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: 'var(--red-light)', color: 'var(--red)' },
  LIFTED:   { bg: 'var(--green-light)', color: 'var(--green)' },
  APPEALED: { bg: 'var(--blue-light)', color: 'var(--blue)' },
}

interface FormState {
  open: boolean; loading: boolean; error: string
  studentSearch: string; studentResults: StudentResult[]; selectedStudent: StudentResult | null
  type: string; reason: string; startDate: string; endDate: string
}

const EMPTY_FORM: FormState = {
  open: false, loading: false, error: '',
  studentSearch: '', studentResults: [], selectedStudent: null,
  type: 'WARNING_ORAL', reason: '', startDate: '', endDate: '',
}

const SEVERE_TYPES = ['COUNCIL_DECISION', 'PERMANENT_EXCLUSION']

interface Composition {
  chefEtablissement: string; censeur: string; sg: string
  pp: string; representantParents: string; representantEleves: string
}

interface CouncilSession {
  id: string; motif: string; composition: Composition
  parentNotifiedAt: string; scheduledAt: string; heldAt: string | null
  decision: string | null; pv: string | null; status: 'CONVOQUE' | 'TENU' | 'ANNULE'
  student: { id: string; firstName: string; lastName: string }
  presidedBy: { id: string; firstName: string; lastName: string }
}

const EMPTY_COMPOSITION: Composition = {
  chefEtablissement: '', censeur: '', sg: '', pp: '', representantParents: '', representantEleves: '',
}

interface ConvokeFormState {
  open: boolean; loading: boolean; error: string
  studentSearch: string; studentResults: StudentResult[]; selectedStudent: StudentResult | null
  motif: string; scheduledAt: string; composition: Composition
}

const EMPTY_CONVOKE_FORM: ConvokeFormState = {
  open: false, loading: false, error: '',
  studentSearch: '', studentResults: [], selectedStudent: null,
  motif: '', scheduledAt: '', composition: EMPTY_COMPOSITION,
}

interface TenirFormState {
  open: boolean; loading: boolean; error: string
  sessionId: string; decision: string; pv: string; startDate: string; endDate: string
}

const EMPTY_TENIR_FORM: TenirFormState = {
  open: false, loading: false, error: '',
  sessionId: '', decision: 'COUNCIL_DECISION', pv: '', startDate: '', endDate: '',
}

export default function SectionDiscipline({ onToast }: Props) {
  const t = useT('discipline')
  const [records, setRecords]   = useState<DisciplineRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [form, setForm]         = useState<FormState>(EMPTY_FORM)
  const [liftingId, setLiftingId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [view, setView] = useState<'sanctions' | 'council'>('sanctions')
  const { isOnline, addToQueue } = useSyncQueue()

  const [councilSessions, setCouncilSessions] = useState<CouncilSession[]>([])
  const [councilLoading, setCouncilLoading] = useState(true)
  const [convokeForm, setConvokeForm] = useState<ConvokeFormState>(EMPTY_CONVOKE_FORM)
  const [tenirForm, setTenirForm] = useState<TenirFormState>(EMPTY_TENIR_FORM)

  const fetchCouncilSessions = useCallback(async () => {
    setCouncilLoading(true)
    try {
      const res = await fetchApi('/api/v2/discipline-council', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setCouncilSessions(data.data || [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('council.toasts.load_error'), 'error')
    } finally {
      setCouncilLoading(false)
    }
  }, [onToast, t])

  useEffect(() => { if (view === 'council') fetchCouncilSessions() }, [view, fetchCouncilSessions])

  const searchConvokeStudents = async (q: string) => {
    if (q.trim().length < 2) { setConvokeForm(f => ({ ...f, studentResults: [] })); return }
    try {
      const res = await fetchApi(`/api/v2/users?role=STUDENT&search=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' })
      const data = await res.json()
      setConvokeForm(f => ({ ...f, studentResults: data.data || [] }))
    } catch { setConvokeForm(f => ({ ...f, studentResults: [] })) }
  }

  const submitConvoke = async () => {
    const { selectedStudent, motif, scheduledAt, composition } = convokeForm
    if (!selectedStudent) { setConvokeForm(f => ({ ...f, error: t('validation.student_required') })); return }
    if (!motif.trim() || !scheduledAt) { setConvokeForm(f => ({ ...f, error: t('council.validation.motif_date_required') })); return }
    if (Object.values(composition).some(v => !v.trim())) { setConvokeForm(f => ({ ...f, error: t('council.validation.composition_required') })); return }
    setConvokeForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/discipline-council/convoquer', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudent.id, motif: motif.trim(), scheduledAt, composition }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('council.toasts.convoked', { student: `${selectedStudent.firstName} ${selectedStudent.lastName}` }), 'success')
      setConvokeForm(EMPTY_CONVOKE_FORM)
      fetchCouncilSessions()
    } catch (err) {
      setConvokeForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const submitTenir = async () => {
    const { sessionId, decision, pv, startDate, endDate } = tenirForm
    if (!pv.trim()) { setTenirForm(f => ({ ...f, error: t('council.validation.pv_required') })); return }
    setTenirForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/discipline-council/${sessionId}/tenir`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, pv: pv.trim(), startDate: startDate || undefined, endDate: endDate || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('council.toasts.held'), 'success')
      setTenirForm(EMPTY_TENIR_FORM)
      fetchCouncilSessions()
    } catch (err) {
      setTenirForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const downloadPV = async (sessionId: string) => {
    try {
      const r = await fetchApi(`/api/v2/discipline-council/${sessionId}/pv.pdf`, { credentials: 'include' })
      if (!r.ok) throw new Error(t('council.toasts.pv_error'))
      const blob = await r.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'pv-conseil-discipline.pdf'
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('council.toasts.pv_error'), 'error')
    }
  }

  const fetchRecords = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (typeFilter)   params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetchApi(`/api/v2/discipline?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setRecords(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // Rafraîchissement temps réel quand l'assistant IA enregistre/lève une sanction.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'disciplineRecord') fetchRecords()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchRecords])

  const searchStudents = async (q: string) => {
    if (q.trim().length < 2) { setForm(f => ({ ...f, studentResults: [] })); return }
    try {
      const res = await fetchApi(`/api/v2/users?role=STUDENT&search=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' })
      const data = await res.json()
      setForm(f => ({ ...f, studentResults: data.data || [] }))
    } catch { setForm(f => ({ ...f, studentResults: [] })) }
  }

  const submitSanction = async () => {
    const { selectedStudent, type, reason, startDate, endDate } = form
    if (!selectedStudent) { setForm(f => ({ ...f, error: t('validation.student_required') })); return }
    if (!type || !reason.trim()) { setForm(f => ({ ...f, error: t('validation.type_reason_required') })); return }
    if (SEVERE_TYPES.includes(type)) { setForm(f => ({ ...f, error: t('validation.severe_requires_council') })); return }

    const payload = { studentId: selectedStudent.id, type, reason: reason.trim(), startDate: startDate || undefined, endDate: endDate || undefined }
    const studentName = `${selectedStudent.firstName} ${selectedStudent.lastName}`

    if (!isOnline) {
      await addToQueue({ type: 'DISCIPLINE_SANCTION', endpoint: '/api/v2/discipline', method: 'POST', payload })
      onToast(t('toasts.sanction_queued', { student: studentName }), 'success')
      setForm(EMPTY_FORM)
      return
    }

    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/discipline', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('toasts.sanction_saved', { student: studentName }), 'success')
      setForm(EMPTY_FORM)
      fetchRecords()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const liftSanction = async (recordId: string, studentName: string) => {
    if (!confirm(t('toasts.confirm_lift', { student: studentName }))) return

    if (!isOnline) {
      await addToQueue({ type: 'DISCIPLINE_SANCTION_LIFT', endpoint: `/api/v2/discipline/${recordId}/lift`, method: 'PATCH', payload: {} })
      onToast(t('toasts.sanction_lift_queued'), 'success')
      return
    }

    setLiftingId(recordId)
    try {
      const res = await fetchApi(`/api/v2/discipline/${recordId}/lift`, { method: 'PATCH', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('toasts.sanction_lifted'), 'success')
      fetchRecords()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setLiftingId(null)
    }
  }

  const needsDates = form.type === 'TEMP_EXCLUSION' || form.type === 'PERMANENT_EXCLUSION'

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={sTitle}>{t('title')}</div>
          <div style={sSub}>{view === 'sanctions' ? (loading ? t('loading') : t('count_summary', { count: records.length, byStatus: statusFilter ? ` par statut ${statusFilter}` : '' })) : t('council.subtitle')}</div>
        </div>
        {view === 'sanctions' ? (
          <button style={btnPrim} onClick={() => setForm(f => ({ ...f, open: true }))}>{t('actions.new_sanction')}</button>
        ) : (
          <button style={btnPrim} onClick={() => setConvokeForm(f => ({ ...f, open: true }))}>
            <Gavel size={14} strokeWidth={2} style={{ marginRight: 5, verticalAlign: -2 }} />{t('council.actions.convoke')}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button style={view === 'sanctions' ? tabActiveSt : tabSt} onClick={() => setView('sanctions')}>{t('tabs.sanctions')}</button>
        <button style={view === 'council' ? tabActiveSt : tabSt} onClick={() => setView('council')}>{t('tabs.council')}</button>
      </div>

      {view === 'sanctions' && (<>
      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '8px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>{t('offline_hint')}</span>
        </div>
      )}
      {/* Filtres */}
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={filterSt}>
          <option value="">{t('filter_labels.all_types')}</option>
          {Object.keys(TYPE_STYLE).map(k => <option key={k} value={k}>{t(`sanction_types.${k}`)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterSt}>
          <option value="">{t('filter_labels.all_statuses')}</option>
          <option value="ACTIVE">{t('filter_labels.ACTIVE')}</option>
          <option value="LIFTED">{t('filter_labels.LIFTED')}</option>
          <option value="APPEALED">{t('filter_labels.APPEALED')}</option>
        </select>
        <button style={btnSec} onClick={fetchRecords}>{t('actions.filter')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={15} strokeWidth={2} /></span><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, fontSize: 13 }}>{error}</span>
          <button onClick={fetchRecords} style={btnRetry}>{t('actions.retry')}</button>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}><CheckCircle2 size={40} strokeWidth={1.8} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('empty_state.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('empty_state.description')}</div>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>{[
                  t('table_headers.student'),
                  t('table_headers.type'),
                  t('table_headers.reason'),
                  t('table_headers.date'),
                  t('table_headers.status'),
                  t('table_headers.decided_by'),
                  t('table_headers.actions'),
                ].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const tl = TYPE_STYLE[r.type] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                  const sb = STATUS_BADGE[r.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                  return (
                    <tr key={r.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                        {r.student.firstName} {r.student.lastName}
                      </td>
                      <td style={tdSt}>
                        <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800, background: tl.bg, color: tl.color }}>
                          {t(`sanction_types.${r.type}`)}
                        </span>
                      </td>
                      <td style={tdSt}>
                        <span style={{ fontSize: 12.5, color: 'var(--text2)', maxWidth: 180, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.reason}
                        </span>
                      </td>
                      <td style={tdSt}>{new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={tdSt}>
                        <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800, background: sb.bg, color: sb.color }}>
                          {t(`status_badges.${r.status}`)}
                        </span>
                      </td>
                      <td style={tdSt}>{r.decidedBy.firstName} {r.decidedBy.lastName}</td>
                      <td style={tdSt}>
                        {r.status === 'ACTIVE' && (
                          <button
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.25)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => liftSanction(r.id, `${r.student.firstName} ${r.student.lastName}`)}
                            disabled={liftingId === r.id}>
                            {liftingId === r.id ? <Loader2 size={12} className="animate-spin" /> : t('actions.lift')}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>)}

      {view === 'council' && (
        <div>
          {councilLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
            </div>
          ) : councilSessions.length === 0 ? (
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}><Gavel size={40} strokeWidth={1.8} /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('council.empty_state.title')}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('empty_state.description')}</div>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr>{[
                      t('table_headers.student'), t('council.table_headers.motif'), t('council.table_headers.scheduled'),
                      t('council.table_headers.status'), t('council.table_headers.decision'), t('table_headers.actions'),
                    ].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {councilSessions.map(s => {
                      const delayOk = new Date(s.scheduledAt).getTime() - Date.now() <= 0
                      return (
                        <tr key={s.id}>
                          <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{s.student.firstName} {s.student.lastName}</td>
                          <td style={{ ...tdSt, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.motif}</td>
                          <td style={tdSt}>{new Date(s.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td style={tdSt}>
                            <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800, ...(s.status === 'TENU' ? { background: 'var(--green-light)', color: 'var(--green)' } : { background: 'var(--amber-light)', color: 'var(--amber)' }) }}>
                              {t(`council.status.${s.status}`)}
                            </span>
                          </td>
                          <td style={tdSt}>{s.decision ? t(`sanction_types.${s.decision}`) : '—'}</td>
                          <td style={tdSt}>
                            {s.status === 'CONVOQUE' && (
                              <button
                                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800, background: delayOk ? 'var(--purple-light)' : 'var(--bg2)', color: delayOk ? 'var(--purple)' : 'var(--text3)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                                title={delayOk ? '' : t('council.hint_delay_not_elapsed')}
                                onClick={() => setTenirForm(f => ({ ...f, open: true, sessionId: s.id }))}>
                                {t('council.actions.hold')}
                              </button>
                            )}
                            {s.status === 'TENU' && (
                              <button style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800, background: 'var(--bg2)', color: 'var(--text2)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={() => downloadPV(s.id)}>
                                <Download size={12} /> {t('council.actions.download_pv')}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal création sanction */}
      {form.open && (
        <>
          <div onClick={() => setForm(EMPTY_FORM)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div className="px-5 py-5 md:px-7 md:py-6" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 16, width: 500, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{t('modal_title')}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {/* Recherche élève */}
              <div>
                <label style={labelSt}>{t('form_fields.student_label')}</label>
                {form.selectedStudent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 8, border: '1px solid rgba(5,150,105,0.3)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--green)', flex: 1, display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}><Check size={14} strokeWidth={2} /> {form.selectedStudent.firstName} {form.selectedStudent.lastName}</span>
                    <button onClick={() => setForm(f => ({ ...f, selectedStudent: null, studentSearch: '', studentResults: [] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 14, display: 'inline-flex' }}><X size={14} strokeWidth={2} /></button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      value={form.studentSearch}
                      onChange={e => { setForm(f => ({ ...f, studentSearch: e.target.value })); searchStudents(e.target.value) }}
                      placeholder={t('form_fields.student_placeholder')}
                      style={inputSt}
                    />
                    {form.studentResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
                        {form.studentResults.map(s => (
                          <div key={s.id}
                            onClick={() => setForm(f => ({ ...f, selectedStudent: s, studentSearch: '', studentResults: [] }))}
                            style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--bg)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                            {s.firstName} {s.lastName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Type */}
              <div>
                <label style={labelSt}>{t('form_fields.type_label')}</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputSt}>
                  {Object.keys(TYPE_STYLE).map(k => <option key={k} value={k}>{t(`sanction_types.${k}`)}</option>)}
                </select>
                {SEVERE_TYPES.includes(form.type) && (
                  <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--purple-light)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--purple)' }}>
                    {t('validation.severe_requires_council')}
                  </div>
                )}
              </div>

              {/* Motif */}
              <div>
                <label style={labelSt}>{t('form_fields.reason_label')}</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2} placeholder={t('form_fields.reason_placeholder')}
                  style={{ ...inputSt, resize: 'vertical' }} />
              </div>

              {/* Dates (exclusions) */}
              {needsDates && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelSt}>{t('form_fields.start_date_label')}</label>
                    <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={inputSt} />
                  </div>
                  <div>
                    <label style={labelSt}>{t('form_fields.end_date_label')}</label>
                    <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={inputSt} />
                  </div>
                </div>
              )}

              {form.error && (
                <div style={{ padding: '8px 12px', background: 'var(--red-light)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>
                  {form.error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button style={btnSec} onClick={() => setForm(EMPTY_FORM)}>{t('actions.cancel')}</button>
                <button style={btnPrim} onClick={submitSanction} disabled={form.loading}>
                  {form.loading ? t('actions.saving') : t('actions.save')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal convoquer conseil */}
      {convokeForm.open && (
        <>
          <div onClick={() => setConvokeForm(EMPTY_CONVOKE_FORM)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div className="px-5 py-5 md:px-7 md:py-6" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 16, width: 540, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('council.convoke_modal_title')}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>{t('council.convoke_modal_hint')}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div>
                <label style={labelSt}>{t('form_fields.student_label')}</label>
                {convokeForm.selectedStudent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 8, border: '1px solid rgba(5,150,105,0.3)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--green)', flex: 1, display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}><Check size={14} strokeWidth={2} /> {convokeForm.selectedStudent.firstName} {convokeForm.selectedStudent.lastName}</span>
                    <button onClick={() => setConvokeForm(f => ({ ...f, selectedStudent: null, studentSearch: '', studentResults: [] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', display: 'inline-flex' }}><X size={14} strokeWidth={2} /></button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input value={convokeForm.studentSearch}
                      onChange={e => { setConvokeForm(f => ({ ...f, studentSearch: e.target.value })); searchConvokeStudents(e.target.value) }}
                      placeholder={t('form_fields.student_placeholder')} style={inputSt} />
                    {convokeForm.studentResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
                        {convokeForm.studentResults.map(s => (
                          <div key={s.id} onClick={() => setConvokeForm(f => ({ ...f, selectedStudent: s, studentSearch: '', studentResults: [] }))}
                            style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--bg)' }}>
                            {s.firstName} {s.lastName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={labelSt}>{t('council.form_fields.motif_label')}</label>
                <textarea value={convokeForm.motif} onChange={e => setConvokeForm(f => ({ ...f, motif: e.target.value }))}
                  rows={2} style={{ ...inputSt, resize: 'vertical' }} />
              </div>

              <div>
                <label style={labelSt}>{t('council.form_fields.scheduled_label')}</label>
                <input type="datetime-local" value={convokeForm.scheduledAt} onChange={e => setConvokeForm(f => ({ ...f, scheduledAt: e.target.value }))} style={inputSt} />
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{t('council.form_fields.scheduled_hint')}</div>
              </div>

              <div>
                <label style={labelSt}>{t('council.form_fields.composition_label')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(Object.keys(EMPTY_COMPOSITION) as (keyof Composition)[]).map(role => (
                    <input key={role} value={convokeForm.composition[role]}
                      onChange={e => setConvokeForm(f => ({ ...f, composition: { ...f.composition, [role]: e.target.value } }))}
                      placeholder={t(`council.composition_roles.${role}`)} style={inputSt} />
                  ))}
                </div>
              </div>

              {convokeForm.error && (
                <div style={{ padding: '8px 12px', background: 'var(--red-light)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{convokeForm.error}</div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button style={btnSec} onClick={() => setConvokeForm(EMPTY_CONVOKE_FORM)}>{t('actions.cancel')}</button>
                <button style={btnPrim} onClick={submitConvoke} disabled={convokeForm.loading}>
                  {convokeForm.loading ? t('actions.saving') : t('council.actions.convoke')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal tenir conseil */}
      {tenirForm.open && (
        <>
          <div onClick={() => setTenirForm(EMPTY_TENIR_FORM)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div className="px-5 py-5 md:px-7 md:py-6" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 16, width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{t('council.tenir_modal_title')}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div>
                <label style={labelSt}>{t('council.form_fields.decision_label')}</label>
                <select value={tenirForm.decision} onChange={e => setTenirForm(f => ({ ...f, decision: e.target.value }))} style={inputSt}>
                  <option value="COUNCIL_DECISION">{t('sanction_types.COUNCIL_DECISION')}</option>
                  <option value="PERMANENT_EXCLUSION">{t('sanction_types.PERMANENT_EXCLUSION')}</option>
                </select>
              </div>

              <div>
                <label style={labelSt}>{t('council.form_fields.pv_label')}</label>
                <textarea value={tenirForm.pv} onChange={e => setTenirForm(f => ({ ...f, pv: e.target.value }))}
                  rows={4} placeholder={t('council.form_fields.pv_placeholder')} style={{ ...inputSt, resize: 'vertical' }} />
              </div>

              {tenirForm.error && (
                <div style={{ padding: '8px 12px', background: 'var(--red-light)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{tenirForm.error}</div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button style={btnSec} onClick={() => setTenirForm(EMPTY_TENIR_FORM)}>{t('actions.cancel')}</button>
                <button style={btnPrim} onClick={submitTenir} disabled={tenirForm.loading}>
                  {tenirForm.loading ? t('actions.saving') : t('council.actions.hold')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '7px 15px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '5px 12px', borderRadius: 6, background: 'var(--surface)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const tabSt: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
const tabActiveSt: React.CSSProperties = { ...tabSt, background: 'var(--green)', color: 'white', border: '1px solid var(--green)' }
const inputSt: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--text)', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box' }
const labelSt: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '9px 12px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

