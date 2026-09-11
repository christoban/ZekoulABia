'use client'
import { useState, useEffect } from 'react'
import { PartyPopper, Search, AlertTriangle, CheckCircle2, Loader2, FileText, BarChart3, Package, Upload, Eye } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { fetchApi } from '@/lib/fetchApi'
import AnimatedBackground from '@/components/AnimatedBackground'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string }

interface CheckResult {
  canGenerateReportCard: boolean
  periodId: string
  conseilLocked: boolean
  reason: string | null
  stats: {
    total: number
    VALIDATED: number
    LOCKED: number
    SUBMITTED: number
    DRAFT: number
    REJECTED: number
  }
}

interface ReportCardItem {
  id: string
  generalAverage?: number | null
  rank?: number | null
  student?: { firstName: string; lastName: string }
}

export default function SectionBulletins({ onToast }: Props) {
  const t = useT('grades')
  const [classes, setClasses]     = useState<ClassItem[]>([])
  const [classId, setClassId]     = useState('')
  const [check, setCheck]         = useState<CheckResult | null>(null)
  const [reportCards, setReportCards] = useState<ReportCardItem[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingCheck, setLoadingCheck]     = useState(false)
  const [generating, setGenerating]         = useState(false)
  const [exporting, setExporting]           = useState(false)
  const [sending, setSending]               = useState(false)
  const [celebrate, setCelebrate]           = useState(false)

  useEffect(() => {
    if (!celebrate) return
    const timer = setTimeout(() => setCelebrate(false), 6000)
    return () => clearTimeout(timer)
  }, [celebrate])

  useEffect(() => {
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setClasses(d.data || []))
      .catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'reportCard' && classId) loadClass()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [classId])  // eslint-disable-line react-hooks/exhaustive-deps

  const loadClass = async () => {
    if (!classId) { onToast('Sélectionnez une classe', 'info'); return }
    setLoadingCheck(true)
    setCheck(null)
    setReportCards([])
    try {
      const [checkRes, rcRes] = await Promise.all([
        fetchApi(`/api/v2/report-cards/check/${classId}`, { credentials: 'include' }),
        fetchApi(`/api/v2/report-cards?classId=${classId}&limit=100`, { credentials: 'include' }),
      ])
      if (checkRes.ok) {
        const cd = await checkRes.json()
        setCheck(cd)
      }
      if (rcRes.ok) {
        const rd = await rcRes.json()
        setReportCards(rd.reportCards ?? rd.data ?? [])
      }
    } catch {
      onToast('Erreur de chargement', 'error')
    } finally {
      setLoadingCheck(false)
    }
  }

  const handleGenerate = async () => {
    if (!classId || !check?.canGenerateReportCard) return
    setGenerating(true)
    try {
      const res = await fetchApi('/api/v2/report-cards/generate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          academicPeriodId: check.periodId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Génération des bulletins lancée', 'success')
      setCelebrate(true)
      loadClass()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de génération', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleExportZip = async () => {
    if (!classId) return
    setExporting(true)
    try {
      const res = await fetchApi(`/api/v2/report-cards/export/${classId}`, { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error('Erreur export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `bulletins-${classId}.zip`; a.click()
      URL.revokeObjectURL(url)
      onToast('ZIP téléchargé', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur export', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleSendParents = async () => {
    if (!classId) return
    setSending(true)
    try {
      const res = await fetchApi('/api/v2/report-cards/send', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Bulletins envoyés aux parents', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur envoi', 'error')
    } finally {
      setSending(false)
    }
  }

  const className = classes.find(c => c.id === classId)?.name ?? ''
  const validatedCount = check ? (check.stats.VALIDATED + check.stats.LOCKED) : 0

  const checks = check ? [
    {
      warn: check.stats.total === 0,
      title: check.stats.total === 0
        ? 'Aucune note enregistrée'
        : `Notes : ${validatedCount}/${check.stats.total} validées`,
      sub: check.stats.total === 0
        ? 'Saisissez les notes avant de générer'
        : `${check.stats.SUBMITTED} en attente · ${check.stats.DRAFT} brouillons · ${check.stats.REJECTED} rejetées`,
    },
    {
      warn: !check.conseilLocked,
      title: check.conseilLocked ? 'Conseil de classe verrouillé' : 'Conseil de classe non verrouillé',
      sub: check.conseilLocked
        ? 'Le conseil de classe du Trimestre 1 est validé'
        : 'Le censeur doit verrouiller le conseil de classe avant la génération',
    },
    {
      warn: !check.canGenerateReportCard,
      title: check.canGenerateReportCard ? 'Prêt pour la génération' : (check.reason ?? 'Non prêt'),
      sub: check.canGenerateReportCard
        ? 'Toutes les conditions sont remplies'
        : 'Réglez les points ci-dessus avant de générer',
    },
  ] : []

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {celebrate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'edu-celebIn 0.3s ease both' }}>
          <style>{`@keyframes edu-celebIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
          <AnimatedBackground variant="celebration" style={{ zIndex: 0 }} />
          <div className="px-[24px] py-[24px] md:px-[32px] md:py-[32px] max-w-[92vw] md:max-w-[460px]" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: 'white' }}>
              <PartyPopper size={16} className="md:hidden" /><PartyPopper size={16} className="hidden md:block" />
            </div>
            <div className="text-[18px] md:text-[18px] mb-[8px] md:mb-[10px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'white' }}>
              {t('bulletins.celebrate.title')}
            </div>
            <div className="text-[12px] md:text-[13px] mb-[22px] md:mb-[24px]" style={{ color: 'rgba(247,243,238,0.75)', lineHeight: 1.6 }}>
              {t('bulletins.celebrate.subtitle')}
            </div>
            <button onClick={() => setCelebrate(false)}
              className="w-full md:w-auto text-[12px] md:text-[13px] px-[24px] md:px-[28px] py-[11px] md:py-[11px]"
              style={{ background: 'var(--green)', color: 'white', fontWeight: 800, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              {t('bulletins.celebrate.cta')}
            </button>
          </div>
        </div>
      )}

      <div className="mb-[14px] md:mb-[18px]">
        <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('bulletins.title')}</div>
        <div className="text-[12px] md:text-[13px]" style={sSub}>Génération et distribution</div>
      </div>

      <div className="rounded-[8px] md:rounded-[10px] px-[12px] py-[10px] md:px-3.5 md:py-2.5 mb-[14px] md:mb-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={classId} onChange={e => setClassId(e.target.value)} className={selectStCls} style={selectSt} disabled={loadingClasses}>
          <option value="">{loadingClasses ? 'Chargement…' : 'Sélectionner une classe'}</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="text-[12.5px] md:text-[13px] px-[14px] py-[8px] md:px-3.5 md:py-[10px] rounded-[9px] md:rounded-[8px]" style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={loadClass} disabled={loadingClasses || loadingCheck || !classId}>
          {loadingCheck ? <><Loader2 size={15} className="animate-spin" /> Chargement…</> : 'Charger'}
        </button>
      </div>

      {loadingCheck && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 25 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loadingCheck && check && (
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 8 }}>

          <div className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)', overflow: 'hidden' }}>
            <div className="px-3.5 pt-3 pb-2 md:px-4 md:py-3 md:border-b md:border-[var(--border)]">
              <span className="text-[12px] md:text-[13px] font-extrabold" style={{ color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 8 }}><Search size={15} /> Pré-vérification — {className}</span>
            </div>
            <div className="p-3 md:p-3.5 gap-[10px] md:gap-[12px]" style={{ display: 'flex', flexDirection: 'column' }}>
              {checks.map((c, i) => (
                <div key={i} className="gap-[10px] md:gap-[12px] p-[12px] md:px-[14px] md:py-[12px] rounded-[10px] md:rounded-[8px]" style={{ display: 'flex', alignItems: 'flex-start', background: c.warn ? 'var(--amber-light)' : 'var(--green-light)' }}>
                  {c.warn ? <AlertTriangle size={15} color="var(--amber)" /> : <CheckCircle2 size={15} color="var(--green)" />}
                  <div>
                    <div className="text-[13px] md:text-[13px]" style={{ fontWeight: 800, color: c.warn ? 'var(--amber)' : 'var(--green)' }}>{c.title}</div>
                    <div className="text-[11.5px] md:text-[12px]" style={{ color: c.warn ? 'var(--amber)' : 'var(--green)', marginTop: 3, lineHeight: 1.5 }}>{c.sub}</div>
                  </div>
                </div>
              ))}
              <button
                data-help-id="bulletins-generate-btn"
                className="w-full md:w-auto justify-center text-[13px] md:text-[13px] py-[12px] md:py-[10px] px-[16px] md:px-3.5 rounded-[8px] md:rounded-[8px]"
                style={{ ...btnPrim, fontWeight: 800, marginTop: 6, opacity: check.canGenerateReportCard ? 1 : 0.45, cursor: check.canGenerateReportCard ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                onClick={handleGenerate}
                disabled={!check.canGenerateReportCard || generating}>
                {generating ? <><Loader2 size={16} className="animate-spin" /> Génération en cours…</> : <><FileText size={16} /> Générer les bulletins →</>}
              </button>
            </div>
          </div>

          <div className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)', overflow: 'hidden' }}>
            <div className="px-3.5 pt-3 pb-2 md:px-4 md:py-3 md:border-b md:border-[var(--border)]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span className="text-[12px] md:text-[13px] font-extrabold" style={{ color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={15} /> Bulletins générés ({reportCards.length})
              </span>
              {reportCards.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="text-[11px] md:text-[12px] px-[10px] py-[6px] md:px-[12px] md:py-[7px] rounded-[8px] md:rounded-[8px] border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-[var(--bg2)] md:bg-[var(--surface)]" style={{ fontWeight: 800, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={handleExportZip} disabled={exporting}>
                    {exporting ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />} ZIP
                  </button>
                  <button className="text-[11px] md:text-[12px] px-[10px] py-[6px] md:px-[12px] md:py-[7px] rounded-[8px] md:rounded-[8px] border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-[var(--bg2)] md:bg-[var(--surface)]" style={{ fontWeight: 800, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={handleSendParents} disabled={sending}>
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Envoyer
                  </button>
                </div>
              )}
            </div>

            {reportCards.length === 0 ? (
              <div className="text-[13px] md:text-[13px] px-[16px] py-[32px] md:px-3.5 md:py-[32px]" style={{ textAlign: 'center', color: 'var(--text3)' }}>
                Aucun bulletin généré pour cette classe
              </div>
            ) : (
              <>
              <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
                {reportCards.slice(0, 15).map((b) => (
                  <div key={b.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>
                        {b.student ? `${b.student.firstName} ${b.student.lastName}` : 'Élève'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                        {b.generalAverage != null ? `${b.generalAverage.toFixed(2)}/20` : '—'} · {b.rank != null ? `${b.rank}e` : '—'}
                      </div>
                    </div>
                    <button className="text-[11.5px] px-[12px] py-[7px] rounded-[8px] border-0" style={{ background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
                      onClick={() => window.open(`/api/v2/report-cards/${b.id}/pdf`, '_blank')}>
                      <Eye size={14} /> PDF
                    </button>
                  </div>
                ))}
                {reportCards.length > 15 && (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontStyle: 'italic', fontSize: 13, padding: '6px' }}>
                    + {reportCards.length - 15} autres bulletins
                  </div>
                )}
              </div>

              <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr>{['Élève', 'Moy. gén.', 'Rang', 'PDF'].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {reportCards.slice(0, 15).map((b) => (
                      <tr key={b.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={tdSt}>
                          <strong style={{ color: 'var(--text)' }}>
                            {b.student ? `${b.student.firstName} ${b.student.lastName}` : 'Élève'}
                          </strong>
                        </td>
                        <td style={tdSt}>
                          <strong style={{ color: (b.generalAverage ?? 0) < 10 ? 'var(--red)' : 'var(--green)', fontSize: 12 }}>
                            {b.generalAverage != null ? b.generalAverage.toFixed(2) : '—'}
                          </strong>
                        </td>
                        <td style={tdSt}>{b.rank != null ? `${b.rank}e` : '—'}</td>
                        <td style={tdSt}>
                          <button style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            onClick={() => window.open(`/api/v2/report-cards/${b.id}/pdf`, '_blank')}>
                            <Eye size={14} /> PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                    {reportCards.length > 15 && (
                      <tr>
                        <td colSpan={4} style={{ ...tdSt, textAlign: 'center', color: 'var(--text3)', fontStyle: 'italic' }}>
                          + {reportCards.length - 15} autres bulletins
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {!loadingCheck && !check && (
        <div className="px-[24px] py-[44px] md:px-[32px] md:py-[48px]" style={{ background: 'var(--surface)', borderRadius: 8, border: '1.5px solid var(--border)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <FileText size={16} className="md:hidden" /><FileText size={16} className="hidden md:block" />
          </div>
          <div className="text-[13px] md:text-[12px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Sélectionnez une classe
          </div>
          <div className="text-[13px] md:text-[13px]" style={{ color: 'var(--text3)' }}>
            Choisissez une classe et cliquez sur « Charger » pour voir les bulletins.
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '7px 11px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const selectStCls = 'rounded-[10px] px-[10px] py-[7px] md:px-[12px] md:py-[8px] text-[13px] md:text-[13px] font-semibold md:font-bold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] flex-1 md:flex-none'
const selectSt: React.CSSProperties = { background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px' }
const tdSt: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
