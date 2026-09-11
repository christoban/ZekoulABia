'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import SectionStudentPayments from './SectionStudentPayments'
import { Wallet, RefreshCw, Settings } from 'lucide-react'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface PaymentOverview {
  anneeScolaire: string;
  totalEleves: number;
  minesec: { status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[];
  etablissement: { status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[];
}

const btnPri = { padding: '8px 11px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' as const }
const btnSec = { padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' as const }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  IMPAYE: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
  PAYE: { bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
  VERIFIE: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
  EN_ATTENTE: { bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
  LITIGE: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
}

export default function SectionSchoolPayments({ onToast }: Props) {
  const t = useT('admin')
  const [overview, setOverview] = useState<PaymentOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [anneeScolaire, setAnneeScolaire] = useState('')
  const [years, setYears] = useState<{ id: string; label: string; isCurrent: boolean }[]>([])
  const [generatingSchool, setGeneratingSchool] = useState(false)

  useEffect(() => {
    fetchApi('/api/v2/academic-years', { credentials: 'include' })
      .then(r => r.json()).then(d => {
        const list = d.data ?? []
        setYears(list)
        const cur = list.find((y: any) => y.isCurrent)
        if (cur) setAnneeScolaire(cur.label)
      }).catch(() => {})
  }, [])

  const loadOverview = useCallback(async () => {
    if (!anneeScolaire) return
    try {
      setLoading(true)
      const res = await fetchApi(`/api/v2/paiements-minesec/dashboard/school?anneeScolaire=${encodeURIComponent(anneeScolaire)}`, { credentials: 'include' })
      const data = await res.json()
      setOverview(data.data ?? null)
    } catch { onToast('Erreur chargement', 'error') } finally { setLoading(false) }
  }, [anneeScolaire, onToast])

  useEffect(() => { loadOverview() }, [loadOverview])

  const generateForSchool = async () => {
    if (!anneeScolaire) return
    setGeneratingSchool(true)
    try {
      const res = await fetchApi('/api/v2/paiements-minesec/generate-school', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ anneeScolaire }),
      })
      const data = await res.json()
      if (data.success) {
        const r = data.data
        onToast(t('matricules.generate_school_toast').replace('{eleves}', String(r.elevesTraites)).replace('{paiements}', String(r.paiementsGeneres)), 'success')
        loadOverview()
      } else onToast(data.message || t('matricules.error_generic'), 'error')
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setGeneratingSchool(false) }
  }

  const getStats = (stats: PaymentOverview['minesec']) => {
    const impayes = stats.find(s => s.status === 'IMPAYE')
    const payes = stats.find(s => s.status === 'PAYE')
    const verifies = stats.find(s => s.status === 'VERIFIE')
    const totalAttendu = stats.reduce((s, p) => s + (p._sum.montantAttendu ?? 0), 0)
    const totalPaye = stats.reduce((s, p) => s + (p._sum.montantPaye ?? 0), 0)
    return {
      totalEleves: impayes?._count._all ?? 0,
      totalAttendu,
      totalPaye,
      tauxRecouvrement: totalAttendu > 0 ? Math.round((totalPaye / totalAttendu) * 100) : 0,
      verifies: verifies?._count._all ?? 0,
      payes: payes?._count._all ?? 0,
      impayes: impayes?._count._all ?? 0,
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="mb-[16px] md:mb-[20px]">
        <h2 className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wallet size={15} strokeWidth={2} /> {t('page.section_titles.school-payments')}
        </h2>
        <div className="text-[12px] md:text-[13px]" style={{ color: 'var(--text3)', marginTop: 3 }}>{anneeScolaire || t('matricules.minesec_dashboard_title')}</div>
      </div>

      <div className="gap-[8px] md:gap-[12px] mb-[16px] md:mb-[20px]" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="text-[12.5px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)' }}>{t('lv2_choice.academic_year')}</label>
        <select value={anneeScolaire} onChange={e => setAnneeScolaire(e.target.value)}
          className="rounded-[10px] md:rounded-[6px] px-[10px] md:px-[12px] py-[6px] md:py-[7px] text-[12.5px] md:text-[12px] border-0 md:border md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] md:bg-[var(--bg)]"
          style={{ color: 'var(--text)' }}>
          <option value="">—</option>
          {years.map(y => <option key={y.id} value={y.label}>{y.label}</option>)}
        </select>
      </div>

      {loading ? <p className="text-[13.5px] md:text-[13px]" style={{ color: 'var(--text2)' }}>{t('common.loading')}</p> : !overview ? (
        <p className="text-[13.5px] md:text-[13px]" style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('matricules.no_imports')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] md:gap-3 mb-[16px] md:mb-[24px]">
            {(() => {
              const stats = getStats(overview.minesec)
              return [
                { label: t('matricules.minesec_total_attendu'), value: `${stats.totalAttendu.toLocaleString()} FCFA`, bg: 'var(--blue-light)', color: 'var(--blue)' },
                { label: t('matricules.minesec_total_paye'), value: `${stats.totalPaye.toLocaleString()} FCFA`, bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
                { label: t('matricules.minesec_total_restant'), value: `${(stats.totalAttendu - stats.totalPaye).toLocaleString()} FCFA`, bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
                { label: t('matricules.taux_recouvrement'), value: `${stats.tauxRecouvrement}%`, bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
              ].map((c, i) => (
                <div key={i} className="rounded-[10px] md:rounded-[8px] p-[12px] md:px-3.5 md:py-3" style={{ background: c.bg, color: c.color }}>
                  <div className="text-[11px]" style={{ fontWeight: 700, opacity: 0.85, marginBottom: 4 }}>{c.label}</div>
                  <div className="text-[13px] md:text-[18px]" style={{ fontWeight: 900 }}>{c.value}</div>
                </div>
              ))
            })()}
          </div>

          <div className="rounded-none md:rounded-[8px] p-0 md:p-3.5 mb-[16px] md:mb-[24px] border-0 md:border md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]">
            <h3 className="text-[12.5px] md:text-[13px]" style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 12, textTransform: 'uppercase' }}>{t('matricules.par_statut')}</h3>
            <div className="md:hidden flex flex-col" style={{ gap: 8 }}>
              {overview.minesec.map((s, i) => {
                const sc = STATUS_COLORS[s.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                return (
                  <div key={i} className="rounded-[10px] px-[14px] py-[13px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 10.5, fontWeight: 800, background: sc.bg, color: sc.color }}>{s.status}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 700 }}>{s._count._all} paiement(s)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                      <span>Attendu : {(s._sum.montantAttendu ?? 0).toLocaleString()} FCFA</span>
                      <span>Payé : {(s._sum.montantPaye ?? 0).toLocaleString()} FCFA</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>Statut</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>Nb paiements</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>Attendu</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>Payé</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.minesec.map((s, i) => {
                    const sc = STATUS_COLORS[s.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                    return (
                      <tr key={i}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--bg2)' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color }}>{s.status}</span>
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--bg2)', textAlign: 'center' }}>{s._count._all}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--bg2)', textAlign: 'right' }}>{(s._sum.montantAttendu ?? 0).toLocaleString()} FCFA</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--bg2)', textAlign: 'right' }}>{(s._sum.montantPaye ?? 0).toLocaleString()} FCFA</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={loadOverview}
              className="text-[12.5px] md:text-[12px] py-[10px] md:py-[8px] px-[10px] md:px-3.5 rounded-[10px] md:rounded-[8px]"
              style={{ ...btnSec, padding: undefined, fontSize: undefined, borderRadius: undefined, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><RefreshCw size={14} strokeWidth={2} /> {t('matricules.sync_btn')}</button>
            <button onClick={generateForSchool} disabled={generatingSchool}
              className="text-[12.5px] md:text-[12px] py-[10px] md:py-[8px] px-[10px] md:px-3.5 rounded-[10px] md:rounded-[8px]"
              style={{ ...btnPri, padding: undefined, fontSize: undefined, borderRadius: undefined, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {generatingSchool ? '...' : <><Settings size={14} strokeWidth={2} /> {t('matricules.generate_school_btn')}</>}
            </button>
          </div>

          <SectionStudentPayments onToast={onToast} />
        </>
      )}
    </div>
  )
}
