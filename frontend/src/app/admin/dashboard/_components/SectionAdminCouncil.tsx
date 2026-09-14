'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardList, Loader2, Lock, Upload, AlertTriangle, GraduationCap, BookOpen,
  Vote, FileText, X, Trophy, CheckCircle2, HeartPulse,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { fetchApi } from '@/lib/fetchApi'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'

import type { AdminSection } from '../_types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: AdminSection) => void
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

export default function SectionAdminCouncil({ onToast, onNav }: Props) {
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

  // Rafraîchissement temps réel quand l'assistant IA ouvre/modifie un conseil de classe.
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

  // Derive unique periods from all sessions (not filtered)
  const periodsMap = new Map<string, { id: string; name: string }>()
  sessions.forEach(s => {
    if (!periodsMap.has(s.academicPeriod.id)) periodsMap.set(s.academicPeriod.id, s.academicPeriod)
  })
  const periods = Array.from(periodsMap.values())

  const filteredSessions = selectedPeriodId === 'all'
    ? sessions
    : sessions.filter(s => s.academicPeriod.id === selectedPeriodId)

  // KPIs computed on filteredSessions
  const totalSessions  = filteredSessions.length
  const openCount      = filteredSessions.filter(s => s.status === 'OPEN').length
  const lockedCount    = filteredSessions.filter(s => s.status === 'LOCKED').length
  const publishedCount = filteredSessions.reduce((sum, s) => sum + (s.publishedCount ?? 0), 0)

  return (
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div className="text-[22px] md:text-[28px]" style={sTitle}>Conseil de classe</div>
          <div className="text-[13px] md:text-[17px]" style={sSub}>
            {totalSessions} session{totalSessions !== 1 ? 's' : ''} · {openCount} ouvert{openCount !== 1 ? 's' : ''} · {lockedCount} verrouillé{lockedCount !== 1 ? 's' : ''}
          </div>
        </div>
        {periods.length > 0 && (
          <select
            value={selectedPeriodId}
            onChange={e => { setSelectedPeriodId(e.target.value); setSelected(null) }}
            className="rounded-[12px] md:rounded-[10px] px-[12px] py-[9px] md:px-[14px] md:py-[8px] text-[13px] md:text-[15px] font-semibold md:font-semibold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none"
            style={{ background: 'var(--bg2)', fontFamily: 'inherit', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
            <option value="all">Tous les trimestres</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <DelegationSupervisionBanner actorTitle="Censeur / Principal / Directeur" domainLabel="Conseils de Classe & Délibérations" onNav={onNav} />

      {/* RACI Solemn Presidency Governance Notice */}
      <div className="mb-4 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-[var(--text)] flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 flex-shrink-0">
            <GraduationCap size={16} />
          </div>
          <div>
            <p className="font-bold text-xs">Instance Solennelle de Délibération Direction / Censeur</p>
            <p className="text-[11.5px] text-[var(--text2)]">Le Conseil de classe est présidé par le Censeur ou le Directeur. La clôture officielle actée ici enregistre les délibérations (admissions, redoublements, exclusions) et débloque l'impression des bulletins.</p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      {!loading && !error && sessions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[10px] md:gap-[14px]" style={{ marginBottom: 24 }}>
          {([
            { icon: ClipboardList, value: totalSessions,  label: 'Sessions au total' },
            { icon: Loader2, value: openCount,       label: 'En cours' },
            { icon: Lock, value: lockedCount,     label: 'Verrouillés' },
            { icon: Upload, value: publishedCount,  label: 'Bulletins publiés' },
          ] as { icon: typeof ClipboardList; value: number; label: string }[]).map(({ icon: Icon, value, label }) => (
            <div key={label} className="p-3 md:px-[18px] md:py-4 rounded-[14px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
              <div className="[&>svg]:w-4 [&>svg]:h-4 md:[&>svg]:w-[22px] md:[&>svg]:h-[22px]" style={{ marginBottom: 6 }}><Icon /></div>
              <div className="text-[20px] md:text-[28px] font-black" style={{ color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{value}</div>
              <div className="text-[11px] md:text-[13px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="var(--red)" /><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchSessions} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && filteredSessions.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><GraduationCap size={52} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Aucun conseil de classe</div>
          <div style={{ fontSize: 16, color: 'var(--text3)' }}>
            {selectedPeriodId !== 'all' ? 'Aucune session pour ce trimestre.' : 'Les sessions seront créées par le personnel.'}
          </div>
        </div>
      )}

      {!loading && !error && filteredSessions.length > 0 && (
        <div className="grid grid-cols-1 sm:[grid-template-columns:var(--council-grid)]" style={{ '--council-grid': selected ? '340px 1fr' : 'repeat(3,1fr)', gap: 18, alignItems: 'start' } as React.CSSProperties}>
          {/* Liste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredSessions.map(s => (
              <div key={s.id} onClick={() => openSession(s.id)}
                className="rounded-[16px] md:rounded-[14px] p-[14px] md:px-[18px] md:py-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none"
                style={{ background: selected?.id === s.id ? 'var(--green-light)' : 'white', border: `1.5px solid ${selected?.id === s.id ? 'var(--green)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }) }}
                onMouseLeave={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border)', boxShadow: 'none' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  <div className="text-[15px] md:text-[20px] md:[font-family:var(--font-spectral),Spectral,serif]" style={{ fontWeight: 700, color: 'var(--text)' }}>{s.class.name}</div>
                  <span className="text-[11px] md:text-[13px]" style={{ padding: '3px 10px', borderRadius: 20, fontWeight: 800, background: s.status === 'LOCKED' ? 'var(--green-light)' : 'var(--blue-light)', color: s.status === 'LOCKED' ? 'var(--green)' : 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {s.status === 'LOCKED' ? <><Lock size={12} /> Verrouillé</> : <><BookOpen size={12} /> Ouvert</>}
                  </span>
                </div>
                <div className="text-[12.5px] md:text-[14px]" style={{ color: 'var(--text3)', fontWeight: 600 }}>{s.academicPeriod.name}</div>
                <div className="text-[12px] md:text-[13px]" style={{ color: 'var(--text3)', marginTop: 4 }}>{s._count.decisions} décision{s._count.decisions !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>

          {/* Détail */}
          {selected && (
            <div className="rounded-[16px] md:rounded-[16px]" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              {loadingDetail ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                  <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                </div>
              ) : (
                <>
                  <div className="p-[14px] md:px-[22px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <span className="text-[14.5px] md:text-[17px]" style={{ fontWeight: 800, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Vote size={16} /> {selected.class.name} · {selected.academicPeriod.name}
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
                    <div className="text-[12.5px] md:text-[14px] px-[14px] py-[9px] md:px-[22px] md:py-[10px]" style={{ background: 'var(--orange-light)', borderBottom: '1px solid var(--orange-light)', fontWeight: 700, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={14} /> En attente du verrouillage par le Censeur
                    </div>
                  )}

                  {selected.status === 'LOCKED' && (
                    <div className="text-[12.5px] md:text-[14px] px-[14px] py-[9px] md:px-[22px] md:py-[10px]" style={{ background: 'var(--green-light)', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Lock size={14} /> Ce conseil est verrouillé.
                    </div>
                  )}

                  {selected.decisions.length === 0 ? (
                    <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--text3)' }}>Aucun élève dans cette session.</div>
                  ) : (
                    <>
                      {selected.decisions.some(d => d.alertLevel) && (
                        <div className="text-[12.5px] md:text-[14px] px-[14px] py-[9px] md:px-[22px] md:py-[10px]" style={{ background: 'var(--red-light)', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <HeartPulse size={14} /> {selected.decisions.filter(d => d.alertLevel).length} élève(s) à risque dans cette classe — voir l'indicateur ci-dessous
                        </div>
                      )}
                      {/* ── Cartes empilées — mobile ── */}
                      <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
                        {selected.decisions.map(d => {
                          const dc = DEC_COLOR[d.decision] ?? DEC_COLOR.PASS!
                          return (
                            <div key={d.studentId} className="rounded-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>
                                  {d.student.firstName} {d.student.lastName}
                                  {d.alertLevel && (
                                    <span title={`Indice de santé scolaire : ${d.healthScore}/100`}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: d.alertLevel === 'critical' ? 'var(--red-light)' : 'var(--amber-light)', color: d.alertLevel === 'critical' ? 'var(--red)' : 'var(--amber)' }}>
                                      <HeartPulse size={11} /> {d.healthScore}
                                    </span>
                                  )}
                                </span>
                                <span style={{ padding: '3px 10px', borderRadius: 22, fontSize: 12.5, fontWeight: 800, background: dc?.bg, color: dc?.color, flexShrink: 0 }}>
                                  {DEC_LABEL[d.decision] ?? d.decision}
                                </span>
                              </div>
                              {d.observations && (
                                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>{d.observations}</div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* ── Tableau — desktop ── */}
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
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: d.alertLevel === 'critical' ? 'var(--red-light)' : 'var(--amber-light)', color: d.alertLevel === 'critical' ? 'var(--red)' : 'var(--amber)' }}>
                                        <HeartPulse size={11} /> {d.healthScore}
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td style={tdSt}>
                                  <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: dc?.bg, color: dc?.color }}>
                                    {DEC_LABEL[d.decision] ?? d.decision}
                                  </span>
                                </td>
                                <td style={tdSt}><span style={{ fontSize: 15, color: 'var(--text3)' }}>{d.observations || '—'}</span></td>
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
const detailBtnSecCls = 'px-[10px] py-[6px] md:px-[14px] md:py-[8px] text-[12px] md:text-[15px] rounded-[8px] md:rounded-[10px]'
const detailBtnSecSmCls = 'px-[10px] py-[6px] md:px-[14px] md:py-[8px] text-[12px] md:text-[14px] rounded-[8px] md:rounded-[10px]'
const btnSec: React.CSSProperties = { background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 16px', fontSize: 16, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
