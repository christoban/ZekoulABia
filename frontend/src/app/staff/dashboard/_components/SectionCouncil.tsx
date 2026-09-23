'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { CheckCircle2, RotateCcw, Scale, AlertTriangle, GraduationCap, X } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface CouncilSession {
  id: string
  status: 'OPEN' | 'LOCKED'
  createdAt: string
  validatedAt: string | null
  class: { id: string; name: string }
  academicPeriod: { id: string; name: string }
  _count: { decisions: number }
}

interface Decision {
  studentId: string
  decision: string
  observations: string | null
  student: { id: string; firstName: string; lastName: string }
}

interface SessionDetail {
  id: string
  status: string
  class: { id: string; name: string }
  academicPeriod: { id: string; name: string }
  presidedBy: { id: string; firstName: string; lastName: string } | null
  decisions: Decision[]
}

type DecisionValue = 'PASS' | 'REPEAT' | 'DELIBERATION'

const DEC_COLOR: Record<string, { color: string; bg: string }> = {
  PASS:         { color: 'var(--green)', bg: 'var(--green-light)' },
  REPEAT:       { color: 'var(--red)', bg: 'var(--red-light)' },
  DELIBERATION: { color: 'var(--amber)', bg: 'var(--amber-light)' },
}

const DEC_LABEL: Record<string, { icon: React.ReactNode; text: string }> = {
  PASS:         { icon: <CheckCircle2 size={14} strokeWidth={2} />, text: 'Admis(e)' },
  REPEAT:       { icon: <RotateCcw size={14} strokeWidth={2} />, text: 'Redoublant(e)' },
  DELIBERATION: { icon: <Scale size={14} strokeWidth={2} />, text: 'En délibération' },
}

export default function SectionCouncil({ onToast }: Props) {
  const t = useT('staff')
  const [sessions, setSessions]   = useState<CouncilSession[]>([])
  const [selected, setSelected]   = useState<SessionDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Record<string, { decision: DecisionValue; obs: string }>>({})
  const [saving, setSaving]       = useState(false)
  const [locking, setLocking]     = useState(false)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createClassId, setCreateClassId] = useState('')
  const [createPeriodId, setCreatePeriodId] = useState('')
  const [createError, setCreateError] = useState('')
  const [classList, setClassList] = useState<{ id: string; name: string }[]>([])
  const [periodList, setPeriodList] = useState<{ id: string; name: string }[]>([])
  const [fetchingFormData, setFetchingFormData] = useState(false)

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/class-councils', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const openSession = async (sessionId: string) => {
    setLoadingDetail(true)
    setSelected(null)
    try {
      const res = await fetchApi(`/api/v2/class-councils/${sessionId}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      const sess: SessionDetail = data.session
      setSelected(sess)
      const init: Record<string, { decision: DecisionValue; obs: string }> = {}
      for (const d of sess.decisions) {
        init[d.studentId] = { decision: d.decision as DecisionValue, obs: d.observations ?? '' }
      }
      setDecisions(init)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de chargement', 'error')
    } finally {
      setLoadingDetail(false)
    }
  }

  const saveDecisions = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const payload = Object.entries(decisions).map(([studentId, val]) => ({
        studentId,
        decision: val.decision,
        observations: val.obs || undefined,
      }))
      const res = await fetchApi(`/api/v2/class-councils/${selected.id}/decisions/bulk`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`${data.count} décision${data.count > 1 ? 's' : ''} sauvegardée${data.count > 1 ? 's' : ''}`, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de sauvegarde', 'error')
    } finally {
      setSaving(false)
    }
  }

  const lockSession = async () => {
    if (!selected) return
    if (!confirm(t('council.lockConfirm'))) return
    setLocking(true)
    try {
      const res = await fetchApi(`/api/v2/class-councils/${selected.id}/lock`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Conseil de classe verrouillé', 'success')
      setSelected(prev => prev ? { ...prev, status: 'LOCKED' } : null)
      fetchSessions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de verrouillage', 'error')
    } finally {
      setLocking(false)
    }
  }

  const handleCreateCouncil = async () => {
    if (!createClassId) { setCreateError(t('council.selectClassError')); return }
    if (!createPeriodId) { setCreateError(t('council.selectPeriodError')); return }
    setCreateLoading(true); setCreateError('')
    try {
      const res = await fetchApi('/api/v2/class-councils', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: createClassId, academicPeriodId: createPeriodId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Conseil de classe créé', 'success')
      setCreateOpen(false); fetchSessions()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setCreateLoading(false)
    }
  }

  const downloadReport = () => {
    if (!selected) return
    window.open(`/api/v2/class-councils/${selected.id}/report`, '_blank')
    onToast(t('council.reportDownloading'), 'info')
  }

  const openCount  = sessions.filter(s => s.status === 'OPEN').length
  const lockedCount = sessions.filter(s => s.status === 'LOCKED').length

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={sTitle}>{t('council.title')}</div>
          <div style={sSub}>{t('council.subtitle', { openCount, s: openCount > 1 ? 's' : '', lockedCount, locked: lockedCount > 1 ? 's' : '' })}</div>
        </div>
        <button style={btnPrim} onClick={() => {
          setCreateOpen(true)
          setFetchingFormData(true)
          Promise.all([
            fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
            fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()),
          ]).then(([cRes, yRes]) => {
            const classes = (cRes.data || []).map((c: any) => ({ id: c.id, name: c.name }))
            setClassList(classes)
            if (classes.length > 0) setCreateClassId(classes[0].id)
            const current = (yRes.data || []).find((y: any) => y.isCurrent) ?? (yRes.data || [])[0]
            const periods = current ? (current.periods || []).map((p: any) => ({ id: p.id, name: p.name })) : []
            setPeriodList(periods)
            if (periods.length > 0) setCreatePeriodId(periods[0].id)
          }).catch(() => onToast('Erreur chargement formulaire', 'error'))
          .finally(() => setFetchingFormData(false))
        }}>{t('council.newCouncil')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
          <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={15} strokeWidth={2} /></span><span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 12.5, flex: 1 }}>{error}</span>
          <button onClick={fetchSessions} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '36px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10, display: 'flex', justifyContent: 'center' }}><GraduationCap size={36} strokeWidth={2} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('council.noSessions')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('council.noSessionsDesc')}</div>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '280px 1fr' : 'repeat(3,1fr)', gap: 12, alignItems: 'start' }}>
          {/* Liste des sessions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map(s => (
              <div key={s.id}
                onClick={() => openSession(s.id)}
                style={{ background: selected?.id === s.id ? 'var(--green-light)' : 'white', borderRadius: 10, border: `1px solid ${selected?.id === s.id ? 'var(--green)' : 'var(--border)'}`, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }) }}
                onMouseLeave={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border)', boxShadow: 'none' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s.class.name}</div>
                  <span style={{ padding: '2px 8px', borderRadius: 14, fontSize: 11, fontWeight: 800, background: s.status === 'LOCKED' ? 'var(--green-light)' : 'var(--blue-light)', color: s.status === 'LOCKED' ? 'var(--green)' : 'var(--blue)' }}>
                    {s.status === 'LOCKED' ? t('council.lockedBadge') : t('council.openBadge')}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{s.academicPeriod.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t('council.decisionsCount', { count: s._count.decisions, s: s._count.decisions !== 1 ? 's' : '' })}</div>
              </div>
            ))}
          </div>

          {/* Détail session */}
          {selected && (
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {loadingDetail ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
                  <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                </div>
              ) : (
                <>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                      {t('council.deliberationHeader', { className: selected.class.name, periodName: selected.academicPeriod.name })}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {selected.status !== 'LOCKED' && (
                        <>
                          <button style={btnSec} onClick={saveDecisions} disabled={saving}>
                            {saving ? t('council.savingDecisions') : t('council.saveDecisions')}
                          </button>
                          <button style={btnPrim} onClick={lockSession} disabled={locking}>
                            {locking ? t('council.locking') : t('council.lock')}
                          </button>
                        </>
                      )}
                      <button style={btnSec} onClick={downloadReport}>{t('council.downloadReport')}</button>
                      <button style={{ ...btnSec, fontSize: 12, display: 'inline-flex', alignItems: 'center' }} onClick={() => setSelected(null)}><X size={13} /></button>
                    </div>
                  </div>

                  {selected.status === 'LOCKED' && (
                    <div style={{ background: 'var(--green-light)', borderBottom: '1px solid var(--border)', padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                      {t('council.lockedBanner')}
                    </div>
                  )}

                  {selected.decisions.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>
                      {t('council.noStudents')}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
                        <thead>
                          <tr>{[t('council.studentHeader'), t('council.decisionHeader'), t('council.observationHeader')].map(h => (
                            <th key={h} style={thSt}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {selected.decisions.map((d) => {
                            const cur = decisions[d.studentId] ?? { decision: d.decision as DecisionValue, obs: d.observations ?? '' }
                            const dc = DEC_COLOR[cur.decision] ?? DEC_COLOR.PASS
                            return (
                              <tr key={d.studentId}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                                <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                                  {d.student.firstName} {d.student.lastName}
                                </td>
                                <td style={tdSt}>
                                  {selected.status === 'LOCKED' ? (
                                    <span style={{ padding: '2.5px 8px', borderRadius: 14, fontSize: 11, fontWeight: 800, background: dc.bg, color: dc.color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                      {DEC_LABEL[cur.decision] ? <>{DEC_LABEL[cur.decision].icon}{DEC_LABEL[cur.decision].text}</> : cur.decision}
                                    </span>
                                  ) : (
                                    <select
                                      value={cur.decision}
                                      onChange={e => setDecisions(p => ({ ...p, [d.studentId]: { ...cur, decision: e.target.value as DecisionValue } }))}
                                      style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: 'var(--surface)', color: dc.color, minWidth: 150 }}>
                                      <option value="PASS">{t('council.decisionPass')}</option>
                                      <option value="REPEAT">{t('council.decisionRepeat')}</option>
                                      <option value="DELIBERATION">{t('council.decisionDeliberation')}</option>
                                    </select>
                                  )}
                                </td>
                                <td style={tdSt}>
                                  {selected.status === 'LOCKED' ? (
                                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{cur.obs || '—'}</span>
                                  ) : (
                                    <input type="text"
                                      value={cur.obs}
                                      onChange={e => setDecisions(p => ({ ...p, [d.studentId]: { ...cur, obs: e.target.value } }))}
                                      placeholder={t('council.observationPlaceholder')}
                                      style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
                                    />
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal créer un conseil */}
      {createOpen && (
        <div onClick={() => !createLoading && setCreateOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-4 py-5 md:px-6 md:py-6" style={{ background: 'var(--surface)', borderRadius: 14, width: 400, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>
              {t('council.newCouncilModalTitle')}
            </div>

            {fetchingFormData ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text2)', marginBottom: 5, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('council.classLabel')}</div>
                <select
                  value={createClassId}
                  onChange={e => setCreateClassId(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer', marginBottom: 14, boxSizing: 'border-box' }}>
                  <option value="">{t('council.classPlaceholder')}</option>
                  {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text2)', marginBottom: 5, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('council.periodLabel')}</div>
                <select
                  value={createPeriodId}
                  onChange={e => setCreatePeriodId(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer', marginBottom: 14, boxSizing: 'border-box' }}>
                  <option value="">{t('council.periodPlaceholder')}</option>
                  {periodList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                {createError && (
                  <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 7, padding: '8px 12px', fontSize: 12, fontWeight: 600, marginBottom: 14, lineHeight: 1.4 }}>
                    {createError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
                    onClick={() => setCreateOpen(false)} disabled={createLoading}>
                    {t('council.cancel')}
                  </button>
                  <button
                    style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12.5, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: createLoading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: createLoading ? 0.7 : 1 }}
                    onClick={handleCreateCouncil} disabled={createLoading}>
                    {createLoading ? t('council.creating') : t('council.createCouncil')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '5px 12px', borderRadius: 7, fontSize: 12, background: 'var(--surface)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8.5px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
