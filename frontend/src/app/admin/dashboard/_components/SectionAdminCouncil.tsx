'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardList, Loader2, Lock, Upload, AlertTriangle, GraduationCap, BookOpen,
  Vote, FileText, X, Trophy, CheckCircle2, HeartPulse,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { fetchApi } from '@/lib/fetchApi'

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
  publishedCount?: number
}

interface Decision {
  studentId: string
  decision: string
  observations: string | null
  student: { id: string; firstName: string; lastName: string }
  healthScore?: number
  alertLevel?: 'critical' | 'warning' | null
}

interface SessionDetail {
  id: string
  status: string
  class: { id: string; name: string }
  academicPeriod: { id: string; name: string }
  presidedBy: { id: string; firstName: string; lastName: string } | null
  decisions: Decision[]
}

const DEC_COLOR: Record<string, { color: string; bg: string }> = {
  PASS:         { color: 'var(--green)', bg: 'var(--green-light)' },
  REPEAT:       { color: 'var(--red)', bg: 'var(--red-light)' },
  DELIBERATION: { color: 'var(--amber)', bg: 'var(--amber-light)' },
}

export default function SectionAdminCouncil({ onToast }: Props) {
  const t = useT('grades')
  const DEC_LABEL: Record<string, string> = {
    PASS: t('council.DEC_LABEL.PASS'), REPEAT: t('council.DEC_LABEL.REPEAT'), DELIBERATION: t('council.DEC_LABEL.DELIBERATION'),
  }
  const [sessions, setSessions]           = useState<CouncilSession[]>([])
  const [selected, setSelected]           = useState<SessionDetail | null>(null)
  const [loading, setLoading]             = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all')

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/class-councils', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'classCouncilSession') fetchSessions()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchSessions])

  const openSession = async (sessionId: string) => {
    setLoadingDetail(true); setSelected(null)
    try {
      const res = await fetchApi(`/api/v2/class-councils/${sessionId}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setSelected(data.session)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de chargement', 'error')
    } finally { setLoadingDetail(false) }
  }

  const periodsMap = new Map<string, { id: string; name: string }>()
  sessions.forEach(s => {
    if (!periodsMap.has(s.academicPeriod.id)) periodsMap.set(s.academicPeriod.id, s.academicPeriod)
  })
  const periods = Array.from(periodsMap.values())

  const filteredSessions = selectedPeriodId === 'all'
    ? sessions
    : sessions.filter(s => s.academicPeriod.id === selectedPeriodId)

  const totalSessions  = filteredSessions.length
  const openCount      = filteredSessions.filter(s => s.status === 'OPEN').length
  const lockedCount    = filteredSessions.filter(s => s.status === 'LOCKED').length
  const publishedCount = filteredSessions.reduce((sum, s) => sum + (s.publishedCount ?? 0), 0)

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 13 }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>Conseil de classe</div>
          <div className="text-[12px] md:text-[13px]" style={sSub}>
            {totalSessions} session{totalSessions !== 1 ? 's' : ''} · {openCount} ouvert{openCount !== 1 ? 's' : ''} · {lockedCount} verrouillé{lockedCount !== 1 ? 's' : ''}
          </div>
        </div>
        {periods.length > 0 && (
          <select
            value={selectedPeriodId}
            onChange={e => { setSelectedPeriodId(e.target.value); setSelected(null) }}
            className="rounded-[8px] md:rounded-[10px] px-[12px] py-[9px] md:px-[14px] md:py-[8px] text-[13px] md:text-[13px] font-semibold md:font-semibold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none"
            style={{ background: 'var(--bg2)', fontFamily: 'inherit', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
            <option value="all">Tous les trimestres</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {!loading && !error && sessions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[10px] md:gap-3" style={{ marginBottom: 11 }}>
          {([
            { icon: ClipboardList, value: totalSessions,  label: 'Sessions au total' },
            { icon: Loader2, value: openCount,       label: 'En cours' },
            { icon: Lock, value: lockedCount,     label: 'Verrouillés' },
            { icon: Upload, value: publishedCount,  label: 'Bulletins publiés' },
          ] as { icon: typeof ClipboardList; value: number; label: string }[]).map(({ icon: Icon, value, label }) => (
            <div key={label} className="p-3 md:px-3.5 md:py-3 rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
              <div style={{ marginBottom: 6 }}><Icon size={16} /></div>
              <div className="text-[13px] md:text-[18px] font-black" style={{ color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{value}</div>
              <div className="text-[11px] md:text-[12px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 25 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 8, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} color="var(--red)" /><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchSessions} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && filteredSessions.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1.5px solid var(--border)', padding: '25px 14px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><GraduationCap size={16} /></div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Aucun conseil de classe</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            {selectedPeriodId !== 'all' ? 'Aucune session pour ce trimestre.' : 'Les sessions seront créées par le personnel.'}
          </div>
        </div>
      )}

      {!loading && !error && filteredSessions.length > 0 && (
        <div className="grid grid-cols-1 sm:[grid-template-columns:var(--council-grid)]" style={{ '--council-grid': selected ? '340px 1fr' : 'repeat(3,1fr)', gap: 8, alignItems: 'start' } as React.CSSProperties}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredSessions.map(s => (
              <div key={s.id} onClick={() => openSession(s.id)}
                className="rounded-[10px] md:rounded-[10px] p-[14px] md:px-3.5 md:py-3 shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none"
                style={{ background: selected?.id === s.id ? 'var(--green-light)' : 'white', border: `1.5px solid ${selected?.id === s.id ? 'var(--green)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }) }}
                onMouseLeave={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border)', boxShadow: 'none' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  <div className="text-[13px] md:text-[12px] md:[font-family:var(--font-spectral),Spectral,serif]" style={{ fontWeight: 700, color: 'var(--text)' }}>{s.class.name}</div>
                  <span className="text-[11px] md:text-[12px]" style={{ padding: '3px 10px', borderRadius: 8, fontWeight: 800, background: s.status === 'LOCKED' ? 'var(--green-light)' : 'var(--blue-light)', color: s.status === 'LOCKED' ? 'var(--green)' : 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {s.status === 'LOCKED' ? <><Lock size={12} /> Verrouillé</> : <><BookOpen size={12} /> Ouvert</>}
                  </span>
                </div>
                <div className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text3)', fontWeight: 600 }}>{s.academicPeriod.name}</div>
                <div className="text-[12px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 4 }}>{s._count.decisions} décision{s._count.decisions !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>

          {selected && (
            <div className="rounded-[10px] md:rounded-[10px]" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              {loadingDetail ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 25 }}>
                  <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                </div>
              ) : (
                <>
                  <div className="p-[14px] md:px-4 md:py-3" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <span className="text-[12px] md:text-[12px]" style={{ fontWeight: 800, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Vote size={15} /> {selected.class.name} · {selected.academicPeriod.name}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {selected.status === 'LOCKED' && (
                        <>
                          <button className={detailBtnSecSmCls} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={() => window.open(`/api/v2/class-councils/${selected.id}/pv`, '_blank')}
                            title="Procès-Verbal officiel de la délibération">
                            <ClipboardList size={14} /> PV officiel
                          </button>
                          <button className={detailBtnSecSmCls} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={() => window.open(`/api/v2/classes/${selected.class.id}/tableau-honneur?periodId=${selected.academicPeriod.id}`, '_blank')}
                            title="Tableau d'honneur du trimestre">
                            <Trophy size={14} /> Tableau d'honneur
                          </button>
                          <button className={detailBtnSecSmCls} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={() => window.open(`/api/v2/classes/${selected.class.id}/tableau-honneur-annuel`, '_blank')}
                            title="Tableau d'honneur annuel (disponible uniquement si tous les conseils sont verrouillés)">
                            <Trophy size={14} /> Annuel
                          </button>
                        </>
                      )}
                      <button className={detailBtnSecCls} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => window.open(`/api/v2/class-councils/${selected.id}/report`, '_blank')}><FileText size={14} /> Rapport</button>
                      <button className={detailBtnSecSmCls} style={{ ...btnSec, display: 'inline-flex', alignItems: 'center' }} onClick={() => setSelected(null)}><X size={14} /></button>
                    </div>
                  </div>

                  {selected.status === 'OPEN' && (
                    <div className="text-[12.5px] md:text-[12px] px-[14px] py-[9px] md:px-4 md:py-[10px]" style={{ background: 'var(--orange-light)', borderBottom: '1px solid var(--orange-light)', fontWeight: 700, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={14} /> En attente du verrouillage par le Censeur
                    </div>
                  )}

                  {selected.status === 'LOCKED' && (
                    <div className="text-[12.5px] md:text-[12px] px-[14px] py-[9px] md:px-4 md:py-[10px]" style={{ background: 'var(--green-light)', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Lock size={14} /> Ce conseil est verrouillé.
                    </div>
                  )}

                  {selected.decisions.length === 0 ? (
                    <div style={{ padding: '18px 12px', textAlign: 'center', color: 'var(--text3)' }}>Aucun élève dans cette session.</div>
                  ) : (
                    <>
                      {selected.decisions.some(d => d.alertLevel) && (
                        <div className="text-[12.5px] md:text-[12px] px-[14px] py-[9px] md:px-4 md:py-[10px]" style={{ background: 'var(--red-light)', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <HeartPulse size={14} /> {selected.decisions.filter(d => d.alertLevel).length} élève(s) à risque dans cette classe — voir l'indicateur ci-dessous
                        </div>
                      )}
                      <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
                        {selected.decisions.map(d => {
                          const dc = DEC_COLOR[d.decision] ?? DEC_COLOR.PASS!
                          return (
                            <div key={d.studentId} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>
                                  {d.student.firstName} {d.student.lastName}
                                  {d.alertLevel && (
                                    <span title={`Indice de santé scolaire : ${d.healthScore}/100`}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 800, background: d.alertLevel === 'critical' ? 'var(--red-light)' : 'var(--amber-light)', color: d.alertLevel === 'critical' ? 'var(--red)' : 'var(--amber)' }}>
                                      <HeartPulse size={11} /> {d.healthScore}
                                    </span>
                                  )}
                                </span>
                                <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: dc?.bg, color: dc?.color, flexShrink: 0 }}>
                                  {DEC_LABEL[d.decision] ?? d.decision}
                                </span>
                              </div>
                              {d.observations && (
                                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{d.observations}</div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                        <thead>
                          <tr>{['Élève', 'Décision', 'Observation'].map(h => (
                            <th key={h} style={thSt}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {selected.decisions.map(d => {
                            const dc = DEC_COLOR[d.decision] ?? DEC_COLOR.PASS!
                            return (
                              <tr key={d.studentId}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                                <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    {d.student.firstName} {d.student.lastName}
                                    {d.alertLevel && (
                                      <span title={`Indice de santé scolaire : ${d.healthScore}/100`}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: d.alertLevel === 'critical' ? 'var(--red-light)' : 'var(--amber-light)', color: d.alertLevel === 'critical' ? 'var(--red)' : 'var(--amber)' }}>
                                        <HeartPulse size={11} /> {d.healthScore}
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td style={tdSt}>
                                  <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: dc?.bg, color: dc?.color }}>
                                    {DEC_LABEL[d.decision] ?? d.decision}
                                  </span>
                                </td>
                                <td style={tdSt}><span style={{ fontSize: 13, color: 'var(--text3)' }}>{d.observations || '—'}</span></td>
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
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const detailBtnSecCls = 'px-[10px] py-[6px] md:px-[12px] md:py-[7px] text-[12px] md:text-[12px] rounded-[8px] md:rounded-[8px]'
const detailBtnSecSmCls = 'px-[10px] py-[6px] md:px-[12px] md:py-[7px] text-[12px] md:text-[12px] rounded-[8px] md:rounded-[8px]'
const btnSec: React.CSSProperties = { background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }
const btnRetry: React.CSSProperties = { padding: '6px 11px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thSt: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
