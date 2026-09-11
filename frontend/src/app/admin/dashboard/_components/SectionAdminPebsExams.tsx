'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { BookOpen, AlertTriangle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface Session { id: string; name: string; level: string; status: string; examDate: string; targetClassId: string; selectionThreshold: number | null; availableSeats: number | null }
interface Candidate { id: string; studentProfileId: string; firstName: string; lastName: string; currentClassName: string; examScore: number | null; selectionResult: string }
interface Summary { session: Session; total: number; pending: number; selectionnes: number; nonSelectionnes: number; candidates: Candidate[] }
interface Anomalie { type: string; severity: string; message: string }
interface TransferPreview { needsConfirmation: boolean; toTransfer: { id: string; name: string; fromClass: string }[]; targetClassId: string }

const btnPri = { padding: '8px 11px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' as const }
const btnSec = { padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' as const }
const inputStyle = { padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }

export default function SectionAdminPebsExams({ onToast }: Props) {
  const t = useT('admin')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [anomalies, setAnomalies] = useState<Anomalie[]>([])
  const [transferPreview, setTransferPreview] = useState<TransferPreview | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scanFileRef = useRef<HTMLInputElement>(null)

  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formLevel, setFormLevel] = useState('')
  const [formYear, setFormYear] = useState('')
  const [formThreshold, setFormThreshold] = useState('')
  const [formSeats, setFormSeats] = useState('')
  const [formTargetClass, setFormTargetClass] = useState('')
  const [years, setYears] = useState<{ id: string; label: string; isCurrent: boolean }[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string; level: string | null }[]>([])
  const [creating, setCreating] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchApi('/api/v2/pebs-exams', { credentials: 'include' })
      const data = await res.json()
      setSessions(data.data ?? [])
    } catch { /* empty */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    const onChanged = (e: Event) => {
      const entity = (e as CustomEvent<{ entity?: string }>).detail?.entity
      if (entity === 'pebsExamSession') loadSessions()
      if (entity === 'pebsExamCandidate' && summary) openSummary(summary.session.id)
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [loadSessions, summary])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()).then(d => {
      const list = d.data ?? []; setYears(list)
      const cur = list.find((y: any) => y.isCurrent); if (cur) setFormYear(cur.id)
    }).catch(() => {})
    fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()).then(d => setClasses(d.data ?? [])).catch(() => {})
  }, [])

  const niveaux = [...new Set(classes.map(c => c.level).filter(Boolean))]
  const classesForLevel = classes.filter(c => c.level === formLevel)

  const handleCreate = async () => {
    if (!formName || !formDate || !formLevel || !formYear || !formTargetClass) {
      onToast(t('lv2_choice.fill_all'), 'error'); return
    }
    try {
      setCreating(true)
      const res = await fetchApi('/api/v2/pebs-exams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: formName, examDate: formDate, level: formLevel, academicYearId: formYear,
          selectionThreshold: formThreshold ? Number(formThreshold) : undefined,
          availableSeats: formSeats ? Number(formSeats) : undefined, targetClassId: formTargetClass }),
      })
      const data = await res.json()
      if (data.success) { onToast(t('pebs_exams.session_created'), 'success'); setFormName(''); setFormDate(''); setFormLevel(''); setFormThreshold(''); setFormSeats(''); setFormTargetClass(''); loadSessions() }
      else onToast(data.message || t('common.error'), 'error')
    } catch { onToast(t('common.error'), 'error') } finally { setCreating(false) }
  }

  const openSummary = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/summary`, { credentials: 'include' })
      const data = await res.json()
      setSummary(data.data ?? null); setAnomalies([]); setTransferPreview(null)
    } catch { onToast(t('common.error'), 'error') }
  }

  const handleCompute = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/compute-selection`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) { onToast(t('pebs_exams.selection_computed').replace('{selectionnes}', String(data.data.selectionnes)).replace('{nonSelectionnes}', String(data.data.nonSelectionnes)), 'success'); openSummary(sessionId) }
      else onToast(data.message || t('common.error'), 'error')
    } catch { onToast(t('common.error'), 'error') }
  }

  const handleApplyTransfer = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/apply-transfer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ confirmed: false }),
      })
      const data = await res.json()
      if (data.success && data.data.needsConfirmation) {
        setTransferPreview(data.data)
      } else if (data.success) {
        onToast(t('pebs_exams.transferred').replace('{count}', String(data.data.transferred)), 'success')
        openSummary(sessionId)
      } else onToast(data.message || t('common.error'), 'error')
    } catch { onToast(t('common.error'), 'error') }
  }

  const confirmTransfer = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/apply-transfer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ confirmed: true }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('pebs_exams.transferred_success').replace('{count}', String(data.data.transferred)), 'success')
        setTransferPreview(null)
        openSummary(sessionId)
      } else onToast(data.message || t('common.error'), 'error')
    } catch { onToast(t('common.error'), 'error') }
  }

  const handleAnomalies = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/detect-anomalies`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      setAnomalies(data.data?.anomalies ?? [])
      if ((data.data?.anomalies ?? []).length === 0) onToast(t('pebs_exams.no_anomaly'), 'success')
    } catch { onToast(t('common.error'), 'error') }
  }

  const handleScan = async (sessionId: string) => {
    const file = scanFileRef.current?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      try {
        const res = await fetchApi(`/api/v2/pebs-exams/${sessionId}/candidates/scan`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
        })
        const data = await res.json()
        if (data.success) {
          if ((data.data?.warnings ?? []).length) onToast(data.data.warnings.join('; '), 'info')
          else onToast(t('pebs_exams.candidates_extracted').replace('{count}', String((data.data?.candidats ?? []).length)), 'success')
        } else onToast(data.message || t('common.error'), 'error')
      } catch { onToast(t('common.error'), 'error') }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-4" style={{ height: '100%', overflowY: 'auto' }}>
      <h2 className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 13, display: 'flex', alignItems: 'center', gap: 10 }}><BookOpen size={15} /> {t('pebs_exams.title')}</h2>

      <div className="rounded-[10px] md:rounded-[8px] p-3 md:p-3.5 mb-[20px] md:mb-[20px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <h3 className="text-[13px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{t('pebs_exams.create_session')}</h3>
        <div className="grid grid-cols-2 sm:flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="col-span-2 sm:flex-[2] sm:min-w-[200px]">
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('pebs_exams.session_name')}</label>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder={t('pebs_exams.session_name_placeholder')} style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div>
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('lv2_choice.level')}</label>
            <select value={formLevel} onChange={e => { setFormLevel(e.target.value); setFormTargetClass('') }} className="w-full sm:w-auto" style={{ ...inputStyle, minWidth: 100 }}>
              <option value="">—</option>
              {niveaux.map(n => <option key={n} value={n!}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('pebs_exams.target_class')}</label>
            <select value={formTargetClass} onChange={e => setFormTargetClass(e.target.value)} className="w-full sm:w-auto" style={{ ...inputStyle, minWidth: 140 }}>
              <option value="">—</option>
              {classesForLevel.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('entrance_exams.exam_date')}</label>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full sm:w-auto" style={inputStyle} />
          </div>
          <div>
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('lv2_choice.academic_year')}</label>
            <select value={formYear} onChange={e => setFormYear(e.target.value)} className="w-full sm:w-auto" style={{ ...inputStyle, minWidth: 140 }}>
              <option value="">—</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('entrance_exams.threshold')}</label>
            <input type="number" value={formThreshold} onChange={e => setFormThreshold(e.target.value)} placeholder="/20" className="w-full sm:w-[80px]" style={inputStyle} />
          </div>
          <div>
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('entrance_exams.seats')}</label>
            <input type="number" value={formSeats} onChange={e => setFormSeats(e.target.value)} className="w-full sm:w-[80px]" style={inputStyle} />
          </div>
          <button onClick={handleCreate} disabled={creating} className="col-span-2 sm:col-span-1" style={{ ...btnPri, borderRadius: 8 }}>{creating ? '...' : t('lv2_choice.create')}</button>
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--text2)' }}>{t('common.loading')}</p> : sessions.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('pebs_exams.no_sessions')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 11 }}>
          {sessions.map(s => (
            <div key={s.id} className="rounded-[10px] md:rounded-[10px] p-[12px] md:px-3.5 md:py-[12px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: 'var(--surface)' }}>
              <div>
                <span className="text-[13px] md:text-[12px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{s.name}</span>
                <span className="text-[12px] md:text-[13px]" style={{ marginLeft: 12, color: 'var(--text2)' }}>{new Date(s.examDate).toLocaleDateString()} — {s.level}</span>
                <span style={{ marginLeft: 12, padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: s.status === 'APPLIED' ? 'rgba(22,163,74,0.12)' : s.status === 'RESULTS_PENDING' ? 'rgba(234,179,8,0.12)' : 'var(--bg2)', color: s.status === 'APPLIED' ? 'var(--green)' : s.status === 'RESULTS_PENDING' ? '#b45309' : 'var(--text2)' }}>
                  {t(`pebs_exams.session_status.${s.status}`)}
                </span>
              </div>
              <button onClick={() => openSummary(s.id)} style={btnSec}>{t('entrance_exams.view')}</button>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="rounded-[10px] md:rounded-[8px] p-3 md:p-3.5 shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="text-[13px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{summary.session.name}</h3>
            <button onClick={() => { setSummary(null); setTransferPreview(null) }} style={btnSec}>{t('common.close')}</button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { label: t('entrance_exams.total'), value: summary.total, bg: 'var(--blue-light)', color: 'var(--blue)' },
              { label: t('entrance_exams.pending'), value: summary.pending, bg: 'var(--bg2)', color: 'var(--text2)' },
              { label: t('pebs_exams.selectionnes'), value: summary.selectionnes, bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
              { label: t('pebs_exams.non_selectionnes'), value: summary.nonSelectionnes, bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
            ].map(c => (
              <span key={c.label} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: c.bg, color: c.color }}>{c.label} : {c.value}</span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <button data-help-id="pebs-compute-btn" onClick={() => handleCompute(summary.session.id)} style={{ ...btnPri, background: 'var(--blue)' }}>{t('pebs_exams.compute')}</button>
            {summary.session.status !== 'APPLIED' && summary.selectionnes > 0 && (
              <button data-help-id="pebs-apply-transfer-btn" onClick={() => handleApplyTransfer(summary.session.id)} style={{ ...btnPri, background: '#b45309' }}>{t('pebs_exams.apply_transfer')}</button>
            )}
            <button onClick={() => handleAnomalies(summary.session.id)} style={btnSec}>{t('entrance_exams.detect_anomalies')}</button>
            <div>
              <input ref={scanFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={() => handleScan(summary.session.id)} />
              <button onClick={() => scanFileRef.current?.click()} style={{ ...btnSec, color: 'var(--purple)' }}>{t('entrance_exams.scan')}</button>
            </div>
          </div>

          {anomalies.length > 0 && (
            <div style={{ marginBottom: 12, padding: 12, background: 'rgba(234,179,8,0.08)', borderRadius: 8, border: '1px solid rgba(234,179,8,0.2)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>{t('entrance_exams.anomalies_found')} ({anomalies.length})</p>
              {anomalies.map((a, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>• {a.message}</p>)}
            </div>
          )}

          {transferPreview && (
            <div style={{ marginBottom: 12, padding: 16, background: 'rgba(234,179,8,0.08)', borderRadius: 8, border: '2px solid rgba(234,179,8,0.3)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={15} /> {t('pebs_exams.confirm_transfer_title')}</p>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                {t('pebs_exams.confirm_transfer_desc').replace('{count}', String(transferPreview.toTransfer.length))}
              </p>
              <ul style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, paddingLeft: 20 }}>
                {transferPreview.toTransfer.map(c => (
                  <li key={c.id}>{c.name} — {t('pebs_exams.from')} {c.fromClass} {t('pebs_exams.to')} {classes.find(cl => cl.id === transferPreview.targetClassId)?.name ?? '?'}</li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => confirmTransfer(summary.session.id)} style={{ ...btnPri, background: '#b45309' }}>{t('pebs_exams.confirm_transfer')}</button>
                <button onClick={() => setTransferPreview(null)} style={btnSec}>{t('common.close')}</button>
              </div>
            </div>
          )}

          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            <div className="md:hidden flex flex-col" style={{ gap: 8 }}>
              {summary.candidates.map(c => (
                <div key={c.id} className="rounded-[8px] p-[12px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.lastName} {c.firstName}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)', flexShrink: 0 }}>{c.examScore ?? '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{c.currentClassName}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: c.selectionResult === 'SELECTIONNE' ? 'rgba(22,163,74,0.12)' : c.selectionResult === 'NON_SELECTIONNE' ? 'rgba(239,68,68,0.12)' : 'var(--bg2)', color: c.selectionResult === 'SELECTIONNE' ? 'var(--green)' : c.selectionResult === 'NON_SELECTIONNE' ? 'var(--red)' : 'var(--text2)' }}>
                      {t(`pebs_exams.candidate_status.${c.selectionResult}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_name')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('pebs_exams.col_current_class')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_score')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.candidates.map(c => (
                    <tr key={c.id}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)' }}>{c.lastName} {c.firstName}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center', color: 'var(--text2)' }}>{c.currentClassName}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>{c.examScore ?? '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: c.selectionResult === 'SELECTIONNE' ? 'rgba(22,163,74,0.12)' : c.selectionResult === 'NON_SELECTIONNE' ? 'rgba(239,68,68,0.12)' : 'var(--bg2)', color: c.selectionResult === 'SELECTIONNE' ? 'var(--green)' : c.selectionResult === 'NON_SELECTIONNE' ? 'var(--red)' : 'var(--text2)' }}>
                          {t(`pebs_exams.candidate_status.${c.selectionResult}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
