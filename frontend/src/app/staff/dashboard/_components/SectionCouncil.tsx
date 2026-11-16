'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { CheckCircle2, RotateCcw, Scale, AlertTriangle, GraduationCap, X, ArrowLeft } from 'lucide-react'
import { DEC_COLOR, type CouncilSession, type CouncilSessionDetail, type DecisionValue } from '@/features/council/councilShared'
import CouncilCreateModal from '@/features/council/CouncilCreateModal'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

type SessionDetail = CouncilSessionDetail

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

  const fetchSessions = useCallback(async () => {
    // 1. Lire depuis le cache Dexie en premier
    const cached = await getCachedData<CouncilSession[]>('staff:class-councils')
    if (cached?.data && Array.isArray(cached.data)) {
      setSessions(cached.data)
      setLoading(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false)
      return
    }

    try {
      if (!cached?.data) setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/class-councils', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      const list = data.sessions || []
      setSessions(list)
      await putCachedData('staff:class-councils', list)
    } catch (err) {
      if (!cached?.data) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const openSession = async (sessionId: string) => {
    // 1. Lire détail depuis Dexie d'abord
    const cacheKey = `staff:class-councils:${sessionId}`
    const cached = await getCachedData<SessionDetail>(cacheKey)
    if (cached?.data) {
      setSelected(cached.data)
      const init: Record<string, { decision: DecisionValue; obs: string }> = {}
      for (const d of cached.data.decisions || []) {
        init[d.studentId] = { decision: d.decision as DecisionValue, obs: d.observations ?? '' }
      }
      setDecisions(init)
    } else {
      setSelected(null)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return
    }

    setLoadingDetail(true)
    try {
      const res = await fetchApi(`/api/v2/class-councils/${sessionId}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      const sess: SessionDetail = data.session
      setSelected(sess)
      const init: Record<string, { decision: DecisionValue; obs: string }> = {}
      for (const d of sess.decisions || []) {
        init[d.studentId] = { decision: d.decision as DecisionValue, obs: d.observations ?? '' }
      }
      setDecisions(init)
      await putCachedData(cacheKey, sess)
    } catch (err) {
      if (!cached) {
        onToast(err instanceof Error ? err.message : 'Erreur de chargement', 'error')
      }
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
    if (!(await confirmAction(t('council.lockConfirm')))) return
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

  const downloadReport = () => {
    if (!selected) return
    window.open(`/api/v2/class-councils/${selected.id}/report`, '_blank')
    onToast(t('council.reportDownloading'), 'info')
  }

  const openCount  = sessions.filter(s => s.status === 'OPEN').length
  const lockedCount = sessions.filter(s => s.status === 'LOCKED').length

  return (
    <div className="px-4 py-4 pb-24 md:px-7 md:py-6 md:pb-6" style={{ overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div style={sTitle}>{t('council.title')}</div>
          <div style={sSub}>{t('council.subtitle', { openCount, s: openCount > 1 ? 's' : '', lockedCount, locked: lockedCount > 1 ? 's' : '' })}</div>
        </div>
        <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('council.newCouncil')}</button>
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
        <div className={selected ? "flex flex-col md:grid md:grid-cols-[280px_1fr] gap-3 items-start" : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-start"}>
          {/* Liste des sessions */}
          <div className={selected ? "hidden md:flex flex-col gap-2 w-full md:w-[280px]" : "flex flex-col gap-2 col-span-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3"}>
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
            <div className="w-full" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {/* Bouton retour visible uniquement sur mobile */}
              <div className="flex md:hidden items-center px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    color: 'var(--green)', fontSize: 12.5, fontWeight: 700, padding: 0
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>{t('council.backToList') || '← Retour à la liste des conseils'}</span>
                </button>
              </div>

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
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                    <>
                      {/* Vue cartes tactile pour mobile (< md) */}
                      <div className="block md:hidden p-3 divide-y divide-[var(--border)]">
                        {selected.decisions.map((d) => {
                          const cur = decisions[d.studentId] ?? { decision: d.decision as DecisionValue, obs: d.observations ?? '' }
                          const dc = DEC_COLOR[cur.decision] ?? DEC_COLOR.PASS
                          return (
                            <div key={d.studentId} className="py-3 flex flex-col gap-2">
                              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
                                {d.student.firstName} {d.student.lastName}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {selected.status === 'LOCKED' ? (
                                  <span style={{ padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 800, background: dc.bg, color: dc.color, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    {DEC_LABEL[cur.decision] ? <>{DEC_LABEL[cur.decision].icon}{DEC_LABEL[cur.decision].text}</> : cur.decision}
                                  </span>
                                ) : (
                                  <select
                                    value={cur.decision}
                                    onChange={e => setDecisions(p => ({ ...p, [d.studentId]: { ...cur, decision: e.target.value as DecisionValue } }))}
                                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: 'var(--surface)', color: dc.color, minHeight: 40 }}>
                                    <option value="PASS">{t('council.decisionPass')}</option>
                                    <option value="REPEAT">{t('council.decisionRepeat')}</option>
                                    <option value="DELIBERATION">{t('council.decisionDeliberation')}</option>
                                  </select>
                                )}

                                {selected.status === 'LOCKED' ? (
                                  cur.obs ? <div style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg)', padding: '6px 10px', borderRadius: 6 }}>{cur.obs}</div> : null
                                ) : (
                                  <input type="text"
                                    value={cur.obs}
                                    onChange={e => setDecisions(p => ({ ...p, [d.studentId]: { ...cur, obs: e.target.value } }))}
                                    placeholder={t('council.observationPlaceholder')}
                                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', minHeight: 38 }}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Vue tableau pour grand écran (>= md) */}
                      <div className="hidden md:block" style={{ overflowX: 'auto' }}>
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
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <CouncilCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchSessions}
        onToast={onToast}
      />
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
