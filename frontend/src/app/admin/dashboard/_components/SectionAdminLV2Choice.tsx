'use client'
import { useState, useEffect, useCallback } from 'react'
import { Globe } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ChoiceWindow {
  id: string; level: string; status: string; openDate: string; closeDate: string
  academicYearId: string
}

interface TrackingData {
  window: { id: string; level: string; status: string; openDate: string; closeDate: string }
  total: number; submitted: number; pending: number
  students: StudentRow[]
}

interface StudentRow {
  studentProfileId: string; userId: string; firstName: string; lastName: string
  className: string; hasSubmitted: boolean; submissionMethod?: string; chosenSubjectName?: string
}

interface Subject { id: string; name: string }
interface AcademicYear { id: string; label: string; isCurrent: boolean }
interface ClassItem { id: string; name: string; level: string | null }

const btnPri = { padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const btnSec = { padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }

export default function SectionAdminLV2Choice({ onToast }: Props) {
  const t = useT('admin')
  const [windows, setWindows] = useState<ChoiceWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [tracking, setTracking] = useState<TrackingData | null>(null)
  const [trackingLoading, setTrackingLoading] = useState(false)

  // Form création
  const [formLevel, setFormLevel] = useState('')
  const [formYearId, setFormYearId] = useState('')
  const [formOpen, setFormOpen] = useState('')
  const [formClose, setFormClose] = useState('')

  // Saisie manuelle
  const [manualStudent, setManualStudent] = useState('')
  const [manualSubject, setManualSubject] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [years, setYears] = useState<AcademicYear[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])

  const loadWindows = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchApi('/api/v2/lv2-choice-windows', { credentials: 'include' })
      const data = await res.json()
      setWindows(data.data ?? [])
    } catch { /* empty */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadWindows() }, [loadWindows])

  // Rafraîchissement temps réel quand l'assistant IA agit sur les fenêtres/affectations LV2.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const entity = (e as CustomEvent<{ entity?: string }>).detail?.entity
      if (entity === 'lv2ChoiceWindow') loadWindows()
      if (entity === 'studentProfile' && tracking) openTracking(tracking.window.id)
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [loadWindows, tracking])  // eslint-disable-line react-hooks/exhaustive-deps

  // Charger les données de référence
  useEffect(() => {
    fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()).then(d => setSubjects(d.data ?? [])).catch(() => {})
    fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()).then(d => {
      const list = d.data ?? []
      setYears(list)
      const current = list.find((y: AcademicYear) => y.isCurrent)
      if (current) setFormYearId(current.id)
    }).catch(() => {})
    fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()).then(d => setClasses(d.data ?? [])).catch(() => {})
  }, [])

  const niveaux = [...new Set(classes.map(c => c.level).filter(Boolean))]

  const handleCreate = async () => {
    if (!formLevel || !formYearId || !formOpen || !formClose) {
      onToast(t('lv2_choice.fill_all'), 'error')
      return
    }
    try {
      setCreating(true)
      const res = await fetchApi('/api/v2/lv2-choice-windows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ level: formLevel, academicYearId: formYearId, openDate: formOpen, closeDate: formClose }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('lv2_choice.window_created'), 'success')
        setFormLevel(''); setFormOpen(''); setFormClose('')
        loadWindows()
      } else {
        onToast(data.message || t('common.error'), 'error')
      }
    } catch { onToast(t('lv2_choice.update_error'), 'error') } finally { setCreating(false) }
  }

  const openTracking = async (windowId: string) => {
    try {
      setTrackingLoading(true)
      const res = await fetchApi(`/api/v2/lv2-choice-windows/${windowId}/tracking`, { credentials: 'include' })
      const data = await res.json()
      setTracking(data.data ?? null)
    } catch { onToast(t('lv2_choice.update_error'), 'error') } finally { setTrackingLoading(false) }
  }

  const handleManualSubmit = async () => {
    if (!tracking || !manualStudent || !manualSubject) {
      onToast(t('lv2_choice.fill_all'), 'error')
      return
    }
    try {
      const res = await fetchApi(`/api/v2/lv2-choice-windows/${tracking.window.id}/manual-submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ studentProfileId: manualStudent, chosenSubjectId: manualSubject }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('lv2_choice.submission_recorded'), 'success')
        setManualStudent(''); setManualSubject('')
        openTracking(tracking.window.id)
      } else {
        onToast(data.message || t('common.error'), 'error')
      }
    } catch { onToast(t('lv2_choice.update_error'), 'error') }
  }

  const handleApply = async (windowId: string) => {
    if (!confirm(t('lv2_choice.confirm_apply'))) return
    try {
      const res = await fetchApi(`/api/v2/lv2-choice-windows/${windowId}/apply`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('lv2_choice.applied').replace('{count}', String(data.data.applied)), 'success')
        setTracking(null)
        loadWindows()
      } else {
        onToast(data.message || t('common.error'), 'error')
      }
    } catch { onToast(t('lv2_choice.update_error'), 'error') }
  }

  // Élèves non-répondants pour la saisie manuelle
  const pendingStudents = tracking?.students.filter(s => !s.hasSubmitted) ?? []

  return (
    <div className="px-4 py-5 md:px-8 md:py-6" style={{ height: '100%', overflowY: 'auto' }}>
      <h2 className="text-[15px] md:text-[17px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Globe size={22} /> {t('lv2_choice.title')}
      </h2>

      {/* Formulaire de création */}
      <div className="rounded-[16px] md:rounded-[12px] p-[16px] md:p-[20px] mb-[20px] md:mb-[24px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <h3 className="text-[14.5px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('lv2_choice.open_window')}</h3>
        <div className="grid grid-cols-2 sm:flex" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('lv2_choice.level')}</label>
            <select value={formLevel} onChange={e => setFormLevel(e.target.value)} className="w-full sm:w-auto" style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, minWidth: 120 }}>
              <option value="">—</option>
              {niveaux.map(n => <option key={n} value={n!}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('lv2_choice.academic_year')}</label>
            <select value={formYearId} onChange={e => setFormYearId(e.target.value)} className="w-full sm:w-auto" style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, minWidth: 160 }}>
              <option value="">—</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('lv2_choice.open_date')}</label>
            <input type="datetime-local" value={formOpen} onChange={e => setFormOpen(e.target.value)} className="w-full sm:w-auto" style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }} />
          </div>
          <div>
            <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('lv2_choice.close_date')}</label>
            <input type="datetime-local" value={formClose} onChange={e => setFormClose(e.target.value)} className="w-full sm:w-auto" style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }} />
          </div>
          <button onClick={handleCreate} disabled={creating} className="col-span-2 sm:col-span-1" style={{ ...btnPri, borderRadius: 11 }}>{creating ? '...' : t('lv2_choice.create')}</button>
        </div>
      </div>

      {/* Liste des fenêtres */}
      {loading ? (
        <p style={{ color: 'var(--text2)' }}>{t('common.loading')}</p>
      ) : windows.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('lv2_choice.no_windows')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {windows.map(w => (
            <div key={w.id} className="rounded-[14px] md:rounded-[10px] p-[12px] md:px-[18px] md:py-[12px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: 'var(--surface)' }}>
              <div>
                <span className="text-[13.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('lv2_choice.level_label').replace('{level}', w.level)}</span>
                <span className="text-[12px] md:text-[13px]" style={{ marginLeft: 12, color: 'var(--text2)' }}>
                  {new Date(w.openDate).toLocaleDateString()} → {new Date(w.closeDate).toLocaleDateString()}
                </span>
                <span style={{ marginLeft: 12, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: w.status === 'OPEN' ? 'rgba(22,163,74,0.12)' : 'var(--bg2)', color: w.status === 'OPEN' ? 'var(--green)' : 'var(--text2)' }}>
                  {w.status === 'OPEN' ? t('lv2_choice.status_open') : t('lv2_choice.status_closed')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openTracking(w.id)} style={btnSec}>{t('lv2_choice.tracking')}</button>
                {w.status === 'OPEN' && <button data-help-id="lv2-apply-btn" onClick={() => handleApply(w.id)} style={{ ...btnPri, background: 'var(--blue)' }}>{t('lv2_choice.apply')}</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panneau de suivi */}
      {tracking && (
        <div className="rounded-[16px] md:rounded-[12px] p-[16px] md:p-[20px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="text-[14.5px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)' }}>
              {t('lv2_choice.tracking_title').replace('{level}', tracking.window.level)}
            </h3>
            <button onClick={() => setTracking(null)} style={btnSec}>{t('common.close')}</button>
          </div>

          {/* Compteurs */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <span className="text-[12px] md:text-[13px]" style={{ padding: '4px 12px', borderRadius: 14, fontWeight: 700, background: 'var(--blue-light)', color: 'var(--blue)' }}>
              {t('lv2_choice.total')} : {tracking.total}
            </span>
            <span className="text-[12px] md:text-[13px]" style={{ padding: '4px 12px', borderRadius: 14, fontWeight: 700, background: 'rgba(22,163,74,0.12)', color: 'var(--green)' }}>
              {t('lv2_choice.submitted')} : {tracking.submitted}
            </span>
            <span className="text-[12px] md:text-[13px]" style={{ padding: '4px 12px', borderRadius: 14, fontWeight: 700, background: 'rgba(234,179,8,0.12)', color: '#b45309' }}>
              {t('lv2_choice.pending')} : {tracking.pending}
            </span>
          </div>

          {trackingLoading ? (
            <p style={{ color: 'var(--text2)' }}>{t('common.loading')}</p>
          ) : (
            <>
              {/* Tableau des élèves — cartes mobile / grille desktop */}
              <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
                <div className="md:hidden flex flex-col" style={{ gap: 8 }}>
                  {tracking.students.map(s => (
                    <div key={s.studentProfileId} className="rounded-[12px] p-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span className="text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{s.lastName} {s.firstName}</span>
                        <span className="text-[11.5px]" style={{ color: 'var(--text2)', flexShrink: 0 }}>{s.className}</span>
                      </div>
                      <div className="text-[12px]" style={{ marginTop: 4 }}>
                        {s.hasSubmitted ? (
                          <span style={{ color: 'var(--green)', fontWeight: 600 }}>{s.chosenSubjectName} {s.submissionMethod === 'ADMIN_MANUAL' ? '(admin)' : ''}</span>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('lv2_choice.not_submitted')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:grid" style={{ gridTemplateColumns: '1fr 120px 140px', gap: 0, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text2)', padding: '6px 10px', borderBottom: '2px solid var(--border)' }}>{t('lv2_choice.col_student')}</div>
                  <div style={{ fontWeight: 700, color: 'var(--text2)', padding: '6px 10px', borderBottom: '2px solid var(--border)' }}>{t('lv2_choice.col_class')}</div>
                  <div style={{ fontWeight: 700, color: 'var(--text2)', padding: '6px 10px', borderBottom: '2px solid var(--border)' }}>{t('lv2_choice.col_status')}</div>
                  {tracking.students.map(s => (
                    <div key={s.studentProfileId} style={{ display: 'contents' }}>
                      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', color: 'var(--text)' }}>{s.lastName} {s.firstName}</div>
                      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)', color: 'var(--text2)' }}>{s.className}</div>
                      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--bg2)' }}>
                        {s.hasSubmitted ? (
                          <span style={{ color: 'var(--green)', fontWeight: 600 }}>{s.chosenSubjectName} {s.submissionMethod === 'ADMIN_MANUAL' ? '(admin)' : ''}</span>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('lv2_choice.not_submitted')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Saisie manuelle de secours */}
              {pendingStudents.length > 0 && (
                <div data-help-id="lv2-manual-entry" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
                    {t('lv2_choice.manual_help')} ({pendingStudents.length} {t('lv2_choice.students_pending')})
                  </p>
                  <div className="flex flex-col sm:flex-row" style={{ gap: 10, alignItems: 'stretch' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 2 }}>{t('lv2_choice.student')}</label>
                      <select value={manualStudent} onChange={e => setManualStudent(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
                        <option value="">—</option>
                        {pendingStudents.map(s => <option key={s.studentProfileId} value={s.studentProfileId}>{s.lastName} {s.firstName} ({s.className})</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 2 }}>{t('lv2_choice.subject')}</label>
                      <select value={manualSubject} onChange={e => setManualSubject(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
                        <option value="">—</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <button onClick={handleManualSubmit} className="sm:self-end" style={btnPri}>{t('lv2_choice.submit_manual')}</button>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>{t('lv2_choice.manual_warning')}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
