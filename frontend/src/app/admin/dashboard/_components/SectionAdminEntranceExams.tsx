'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ClipboardList, Check, X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface Session {
  id: string; name: string; status: string; examDate: string
  admissionThreshold: number | null; availableSeats: number | null
}

interface Candidate {
  id: string; firstName: string; lastName: string; examScore: number | null
  admissionStatus: string; cepResult: string | null; cepResultDate: string | null
  studentProfileId: string | null
}

interface Summary {
  session: Session; total: number; pending: number; admisProvisoire: number
  confirms: number; annules: number; cepPending: number; candidates: Candidate[]
}

interface Anomalie { type: string; severity: string; message: string; candidateIds: string[] }

interface ScannedCandidate { firstName: string; lastName: string; dateOfBirth?: string; examScore?: number; confidence: string }

const btnPri = { padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' as const }
const btnSec = { padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' as const }
const inputStyle = { padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }

export default function SectionAdminEntranceExams({ onToast }: Props) {
  const t = useT('admin')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [anomalies, setAnomalies] = useState<Anomalie[]>([])
  const [scannedPreview, setScannedPreview] = useState<ScannedCandidate[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const scanFileRef = useRef<HTMLInputElement>(null)

  // Form création
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formYear, setFormYear] = useState('')
  const [formThreshold, setFormThreshold] = useState('')
  const [formSeats, setFormSeats] = useState('')
  const [years, setYears] = useState<{ id: string; label: string; isCurrent: boolean }[]>([])
  const [creating, setCreating] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchApi('/api/v2/entrance-exams', { credentials: 'include' })
      const data = await res.json()
      setSessions(data.data ?? [])
    } catch { /* empty */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  // Rafraîchissement temps réel quand l'assistant IA agit sur les sessions/candidats de concours.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const entity = (e as CustomEvent<{ entity?: string }>).detail?.entity
      if (entity === 'entranceExamSession') loadSessions()
      if (entity === 'entranceExamCandidate' && summary) openSummary(summary.session.id)
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [loadSessions, summary])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()).then(d => {
      const list = d.data ?? []
      setYears(list)
      const cur = list.find((y: any) => y.isCurrent)
      if (cur) setFormYear(cur.id)
    }).catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!formName || !formDate || !formYear) { onToast(t('lv2_choice.fill_all'), 'error'); return }
    try {
      setCreating(true)
      const res = await fetchApi('/api/v2/entrance-exams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: formName, examDate: formDate, academicYearId: formYear,
          admissionThreshold: formThreshold ? Number(formThreshold) : undefined,
          availableSeats: formSeats ? Number(formSeats) : undefined }),
      })
      const data = await res.json()
      if (data.success) { onToast(t('entrance_exams.session_created'), 'success'); setFormName(''); setFormDate(''); setFormThreshold(''); setFormSeats(''); loadSessions() }
      else onToast(data.message || t('common.error'), 'error')
    } catch { onToast(t('common.error'), 'error') } finally { setCreating(false) }
  }

  const openSummary = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/summary`, { credentials: 'include' })
      const data = await res.json()
      setSummary(data.data ?? null)
      setAnomalies([])
      setScannedPreview([])
    } catch { onToast(t('common.error'), 'error') }
  }

  const handleImport = async (sessionId: string) => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/candidates/import`, {
        method: 'POST', credentials: 'include', body: fd,
      })
      const data = await res.json()
      if (data.success) { onToast(t('entrance_exams.candidates_imported').replace('{count}', String(data.data.added)), 'success'); openSummary(sessionId) }
      else onToast(data.message || t('common.error'), 'error')
    } catch { onToast(t('common.error'), 'error') }
  }

  const handleCompute = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/compute-admission`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (data.success) { onToast(t('entrance_exams.admission_computed').replace('{admis}', String(data.data.admis)).replace('{nonAdmis}', String(data.data.nonAdmis)), 'success'); openSummary(sessionId) }
      else onToast(data.message || t('common.error'), 'error')
    } catch { onToast(t('common.error'), 'error') }
  }

  const handleCep = async (candidateId: string, result: 'REUSSI' | 'ECHOUE') => {
    if (result === 'ECHOUE' && !confirm(t('entrance_exams.confirm_cep_fail'))) return
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/candidates/${candidateId}/cep-result`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ cepResult: result }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(result === 'REUSSI' ? (data.data.onboardingCreated ? t('entrance_exams.admission_confirmed_sent') : t('entrance_exams.admission_confirmed_not_sent')) : t('entrance_exams.admission_cancelled'), result === 'REUSSI' ? 'success' : 'info')
        if (summary) openSummary(summary.session.id)
      } else onToast(data.message || t('common.error'), 'error')
    } catch { onToast(t('common.error'), 'error') }
  }

  const handleAnomalies = async (sessionId: string) => {
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/detect-anomalies`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      setAnomalies(data.data?.anomalies ?? [])
      if ((data.data?.anomalies ?? []).length === 0) onToast(t('entrance_exams.no_anomaly'), 'success')
    } catch { onToast(t('common.error'), 'error') }
  }

  const handleScan = async (sessionId: string) => {
    const file = scanFileRef.current?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      try {
        const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/candidates/scan`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
        })
        const data = await res.json()
        if (data.success) {
          setScannedPreview(data.data?.candidats ?? [])
          if ((data.data?.warnings ?? []).length) onToast(data.data.warnings.join('; '), 'info')
          else onToast(t('entrance_exams.candidates_extracted').replace('{count}', String((data.data?.candidats ?? []).length)), 'success')
        } else onToast(data.message || t('common.error'), 'error')
      } catch { onToast(t('common.error'), 'error') }
    }
    reader.readAsDataURL(file)
  }

  const handleConfirmScan = async (sessionId: string) => {
    if (scannedPreview.length === 0) return
    const candidats = scannedPreview.map(c => ({
      firstName: c.firstName, lastName: c.lastName,
      dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : undefined,
      examScore: c.examScore,
    }))
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/candidates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ candidats }),
      })
      const data = await res.json()
      if (data.success) { onToast(t('entrance_exams.candidates_added').replace('{count}', String(data.data.added)), 'success'); setScannedPreview([]); openSummary(sessionId) }
      else onToast(data.message || t('common.error'), 'error')
    } catch { onToast(t('common.error'), 'error') }
  }

  return (
    <div className="px-4 py-5 md:px-8 md:py-6" style={{ height: '100%', overflowY: 'auto' }}>
      <h2 className="text-[15px] md:text-[17px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}><ClipboardList size={22} /> {t('entrance_exams.title')}</h2>

      {/* Création */}
      <div className="rounded-[16px] md:rounded-[12px] p-[16px] md:p-[20px] mb-[20px] md:mb-[24px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <h3 className="text-[14.5px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('entrance_exams.create_session')}</h3>
        <div className="grid grid-cols-2 sm:flex" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="col-span-2 sm:flex-[2] sm:min-w-[200px]">
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('entrance_exams.session_name')}</label>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder={t('entrance_exams.session_name_placeholder')} style={{ ...inputStyle, width: '100%' }} />
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
          <button onClick={handleCreate} disabled={creating} className="col-span-2 sm:col-span-1" style={{ ...btnPri, borderRadius: 11 }}>{creating ? '...' : t('lv2_choice.create')}</button>
        </div>
      </div>

      {/* Liste des sessions */}
      {loading ? <p style={{ color: 'var(--text2)' }}>{t('common.loading')}</p> : sessions.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('entrance_exams.no_sessions')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {sessions.map(s => (
            <div key={s.id} className="rounded-[14px] md:rounded-[10px] p-[12px] md:px-[18px] md:py-[12px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: 'var(--surface)' }}>
              <div>
                <span className="text-[13.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{s.name}</span>
                <span className="text-[12px] md:text-[13px]" style={{ marginLeft: 12, color: 'var(--text2)' }}>{new Date(s.examDate).toLocaleDateString()}</span>
                <span style={{ marginLeft: 12, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: s.status === 'DRAFT' ? 'var(--bg2)' : s.status === 'RESULTS_PENDING' ? 'rgba(234,179,8,0.12)' : 'var(--green-light)', color: s.status === 'DRAFT' ? 'var(--text2)' : s.status === 'RESULTS_PENDING' ? '#b45309' : 'var(--green)' }}>
                  {t(`entrance_exams.session_status.${s.status}`)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openSummary(s.id)} style={btnSec}>{t('entrance_exams.view')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panneau résumé */}
      {summary && (
        <div className="rounded-[16px] md:rounded-[12px] p-[16px] md:p-[20px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="text-[14.5px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{summary.session.name}</h3>
            <button onClick={() => setSummary(null)} style={btnSec}>{t('common.close')}</button>
          </div>

          {/* Compteurs */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { label: t('entrance_exams.total'), value: summary.total, bg: 'var(--blue-light)', color: 'var(--blue)' },
              { label: t('entrance_exams.pending'), value: summary.pending, bg: 'var(--bg2)', color: 'var(--text2)' },
              { label: t('entrance_exams.admis_provisoire'), value: summary.admisProvisoire, bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
              { label: t('entrance_exams.confirmed'), value: summary.confirms, bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
              { label: t('entrance_exams.cancelled'), value: summary.annules, bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
              { label: t('entrance_exams.cep_pending'), value: summary.cepPending, bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
            ].map(c => (
              <span key={c.label} style={{ padding: '4px 12px', borderRadius: 14, fontSize: 13, fontWeight: 700, background: c.bg, color: c.color }}>
                {c.label} : {c.value}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={() => handleImport(summary.session.id)} />
              <button onClick={() => fileRef.current?.click()} style={btnSec}>{t('entrance_exams.import')}</button>
            </div>
            <button onClick={() => handleCompute(summary.session.id)} style={{ ...btnPri, background: 'var(--blue)' }}>{t('entrance_exams.compute')}</button>
            <button onClick={() => handleAnomalies(summary.session.id)} style={{ ...btnSec, color: '#b45309' }}>{t('entrance_exams.detect_anomalies')}</button>
            <div>
              <input ref={scanFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={() => handleScan(summary.session.id)} />
              <button onClick={() => scanFileRef.current?.click()} style={{ ...btnSec, color: 'var(--purple)' }}>{t('entrance_exams.scan')}</button>
            </div>
          </div>

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(234,179,8,0.08)', borderRadius: 8, border: '1px solid rgba(234,179,8,0.2)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>{t('entrance_exams.anomalies_found')} ({anomalies.length})</p>
              {anomalies.map((a, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>• {a.message}</p>
              ))}
            </div>
          )}

          {/* Scan preview */}
          {scannedPreview.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(124,58,237,0.08)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>{t('entrance_exams.scan_preview')} ({scannedPreview.length})</p>
                <button onClick={() => handleConfirmScan(summary.session.id)} style={{ ...btnPri, background: 'var(--purple)', fontSize: 12, padding: '5px 14px' }}>{t('entrance_exams.confirm_scan')}</button>
              </div>
              {scannedPreview.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>
                  {c.lastName} {c.firstName} {c.examScore != null ? `— ${c.examScore}` : ''} <span style={{ opacity: 0.5 }}>({c.confidence})</span>
                </div>
              ))}
            </div>
          )}

          {/* Tableau candidats */}
          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            {/* ── Cartes empilées — mobile ── */}
            <div className="md:hidden flex flex-col" style={{ gap: 8 }}>
              {summary.candidates.map(c => (
                <div key={c.id} className="rounded-[12px] p-[12px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{c.lastName} {c.firstName}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)', flexShrink: 0 }}>{c.examScore ?? '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: c.admissionStatus === 'CONFIRME' ? 'rgba(22,163,74,0.12)' : c.admissionStatus === 'ADMIS_PROVISOIRE' ? 'rgba(234,179,8,0.12)' : c.admissionStatus === 'ANNULE' ? 'rgba(239,68,68,0.12)' : 'var(--bg2)', color: c.admissionStatus === 'CONFIRME' ? 'var(--green)' : c.admissionStatus === 'ADMIS_PROVISOIRE' ? '#b45309' : c.admissionStatus === 'ANNULE' ? 'var(--red)' : 'var(--text2)' }}>
                      {t(`entrance_exams.candidate_status.${c.admissionStatus}`)}
                    </span>
                    {c.admissionStatus === 'ADMIS_PROVISOIRE' && c.cepResult !== 'REUSSI' && c.cepResult !== 'ECHOUE' ? (
                      <>
                        <button onClick={() => handleCep(c.id, 'REUSSI')} style={{ ...btnPri, fontSize: 11, padding: '3px 10px', background: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={11} /> {t('entrance_exams.btn_cep_success')}</button>
                        <button onClick={() => handleCep(c.id, 'ECHOUE')} style={{ ...btnPri, fontSize: 11, padding: '3px 10px', background: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={11} /> {t('entrance_exams.btn_cep_fail')}</button>
                      </>
                    ) : c.cepResult ? (
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{t('entrance_exams.col_cep')} : {t(`entrance_exams.cep_status.${c.cepResult}`)}</span>
                    ) : null}
                  </div>
                  {c.studentProfileId && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{t('entrance_exams.profile_label')}: {c.studentProfileId.slice(0, 8)}...</div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Tableau — desktop ── */}
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_name')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_score')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_status')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_cep')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('entrance_exams.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.candidates.map(c => (
                    <tr key={c.id}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)' }}>{c.lastName} {c.firstName}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>{c.examScore ?? '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: c.admissionStatus === 'CONFIRME' ? 'rgba(22,163,74,0.12)' : c.admissionStatus === 'ADMIS_PROVISOIRE' ? 'rgba(234,179,8,0.12)' : c.admissionStatus === 'ANNULE' ? 'rgba(239,68,68,0.12)' : 'var(--bg2)', color: c.admissionStatus === 'CONFIRME' ? 'var(--green)' : c.admissionStatus === 'ADMIS_PROVISOIRE' ? '#b45309' : c.admissionStatus === 'ANNULE' ? 'var(--red)' : 'var(--text2)' }}>
                          {t(`entrance_exams.candidate_status.${c.admissionStatus}`)}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>
                        {c.admissionStatus === 'ADMIS_PROVISOIRE' && c.cepResult !== 'REUSSI' && c.cepResult !== 'ECHOUE' ? (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button onClick={() => handleCep(c.id, 'REUSSI')} style={{ ...btnPri, fontSize: 11, padding: '3px 10px', background: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={11} /> {t('entrance_exams.btn_cep_success')}</button>
                            <button onClick={() => handleCep(c.id, 'ECHOUE')} style={{ ...btnPri, fontSize: 11, padding: '3px 10px', background: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={11} /> {t('entrance_exams.btn_cep_fail')}</button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text2)' }}>{c.cepResult ? t(`entrance_exams.cep_status.${c.cepResult}`) : '—'}</span>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
                        {c.studentProfileId ? `${t('entrance_exams.profile_label')}: ${c.studentProfileId.slice(0, 8)}...` : '—'}
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
