'use client'
import { useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { ArrowLeft } from 'lucide-react'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface StudentSearchResult { id: string; firstName: string; lastName: string; studentProfile: { class: { name: string } | null } | null }

interface PaiementItem {
  id: string; typeFrais: string; montantAttendu: number; montantPaye: number | null
  status: string; dateEcheance: string | null; operateur: string | null; recuVerifie: boolean
}
interface PaiementEtabItem {
  id: string; label: string; montantAttendu: number; montantPaye: number; status: string; recu: string | null
}
interface StudentDashboard {
  student: { id: string; nom: string; prenom: string; classe: string; matriculeNational: string | null }
  enrollment: { id: string; status: string; anneeScolaire: string }
  paiementsMinesec: PaiementItem[]
  paiementsEtablissement: PaiementEtabItem[]
  totaux: { totalAttendu: number; totalPaye: number; totalRestant: number; statutGlobal: 'A_JOUR' | 'PARTIELLEMENT_PAYE' | 'EN_RETARD' }
}
interface VerifResult {
  trouve: boolean; verified: boolean; matricule?: string; nomComplet?: string; classe?: string
  dateOfBirth?: string; gender?: 'M' | 'F'; etablissement?: string
  conflitMatriculeExistant?: string; message: string
}

const btnPri = { padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' as const }
const btnSec = { padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' as const }
const inputStyle = { padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, flex: 1 }

const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  A_JOUR: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green)' },
  PARTIELLEMENT_PAYE: { bg: 'rgba(234,179,8,0.12)', color: '#b45309' },
  EN_RETARD: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red)' },
}

export default function SectionStudentPayments({ onToast }: Props) {
  const t = useT('admin')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<StudentSearchResult | null>(null)
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifResult, setVerifResult] = useState<VerifResult | null>(null)
  const [applyingMatricule, setApplyingMatricule] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const params = new URLSearchParams({ role: 'STUDENT', search: query, limit: '10' })
      const res = await fetchApi(`/api/v2/users?${params}`, { credentials: 'include' })
      const data = await res.json()
      setResults(data.data ?? [])
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setSearching(false) }
  }

  const selectStudent = async (student: StudentSearchResult) => {
    setSelected(student)
    setLoadingDashboard(true)
    setVerifResult(null)
    try {
      const res = await fetchApi(`/api/v2/paiements-minesec/dashboard/student/${student.id}`, { credentials: 'include' })
      const data = await res.json()
      setDashboard(data.data ?? null)
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setLoadingDashboard(false) }
  }

  const verifierSurCarteScolaire = async () => {
    if (!dashboard) return
    setVerifying(true)
    setVerifResult(null)
    try {
      const res = await fetchApi(`/api/v2/matricules/verify/${dashboard.student.id}`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (data.success) setVerifResult(data.data)
      else onToast(data.message || t('matricules.error_generic'), 'error')
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setVerifying(false) }
  }

  const confirmerMatricule = async () => {
    if (!dashboard || !verifResult?.matricule) return
    setApplyingMatricule(true)
    try {
      const res = await fetchApi(`/api/v2/students/${dashboard.student.id}/matricule`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ matricule: verifResult.matricule }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('matricules.verif_applied_toast'), 'success')
        setVerifResult(null)
        selectStudent(selected!)
      } else onToast(data.message || t('matricules.error_generic'), 'error')
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setApplyingMatricule(false) }
  }

  const generateForStudent = async () => {
    if (!dashboard || !selected) return
    setGenerating(true)
    try {
      const res = await fetchApi(`/api/v2/paiements-minesec/generate/${dashboard.student.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ anneeScolaire: dashboard.enrollment.anneeScolaire || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1) }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('matricules.generated_toast').replace('{count}', String(data.data.generated)), 'success')
        selectStudent(selected)
      } else onToast(data.message || t('matricules.error_generic'), 'error')
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setGenerating(false) }
  }

  return (
    <div className="rounded-[16px] md:rounded-[12px] p-[16px] md:p-[20px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)', marginTop: 24 }}>
      <h3 className="text-[14.5px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('matricules.student_dashboard_title')}</h3>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input style={inputStyle} value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder={t('matricules.search_placeholder')} />
        <button onClick={search} disabled={searching} style={btnSec}>{searching ? '...' : t('matricules.search_btn')}</button>
      </div>

      {results.length > 0 && !selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {results.map(r => (
            <button key={r.id} onClick={() => selectStudent(r)}
              style={{ ...btnSec, textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
              <span>{r.lastName} {r.firstName}</span>
              <span style={{ color: 'var(--text3)' }}>{r.studentProfile?.class?.name ?? ''}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div>
          <button onClick={() => { setSelected(null); setDashboard(null); setResults([]) }} style={{ ...btnSec, marginBottom: 14, fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={13} strokeWidth={2} /> {t('matricules.back_to_search')}
          </button>

          {loadingDashboard ? (
            <p style={{ color: 'var(--text2)' }}>{t('common.loading')}</p>
          ) : !dashboard ? (
            <p style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('matricules.no_data')}</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{dashboard.student.nom} {dashboard.student.prenom}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                    {dashboard.student.classe} · {t('matricules.matricule_label')} {dashboard.student.matriculeNational ?? t('matricules.no_matricule')}
                  </div>
                </div>
                <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 800, ...(STATUT_COLORS[dashboard.totaux.statutGlobal] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }) }}>
                  {t(dashboard.totaux.statutGlobal === 'A_JOUR' ? 'matricules.minesec_statut_a_jour' : dashboard.totaux.statutGlobal === 'EN_RETARD' ? 'matricules.minesec_statut_retard' : 'matricules.minesec_statut_partiel')}
                </span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <button onClick={verifierSurCarteScolaire} disabled={verifying} style={{ ...btnSec, fontSize: 12, padding: '6px 14px' }}>
                  {verifying ? t('matricules.verif_loading') : t('matricules.verif_btn')}
                </button>

                {verifResult && (
                  <div style={{
                    marginTop: 10, borderRadius: 10, padding: '12px 16px',
                    background: verifResult.trouve ? (verifResult.conflitMatriculeExistant ? 'rgba(234,179,8,0.12)' : 'rgba(22,163,74,0.12)') : 'var(--bg2)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: verifResult.trouve ? 8 : 0 }}>{verifResult.message}</div>
                    {verifResult.trouve && (
                      <>
                        <div style={{ fontSize: 12, color: 'var(--text2)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', marginBottom: 10 }}>
                          <span style={{ fontWeight: 700 }}>{t('matricules.verif_field_matricule')}</span><span>{verifResult.matricule}</span>
                          {verifResult.nomComplet && <><span style={{ fontWeight: 700 }}>{t('matricules.verif_field_nom')}</span><span>{verifResult.nomComplet}</span></>}
                          {verifResult.classe && <><span style={{ fontWeight: 700 }}>{t('matricules.verif_field_classe')}</span><span>{verifResult.classe}</span></>}
                          {verifResult.dateOfBirth && <><span style={{ fontWeight: 700 }}>{t('matricules.verif_field_dob')}</span><span>{verifResult.dateOfBirth}</span></>}
                          {verifResult.gender && <><span style={{ fontWeight: 700 }}>{t('matricules.verif_field_gender')}</span><span>{verifResult.gender}</span></>}
                        </div>
                        <button onClick={confirmerMatricule} disabled={applyingMatricule} style={{ ...btnPri, fontSize: 12, padding: '6px 14px' }}>
                          {applyingMatricule ? t('matricules.verif_loading') : t('matricules.verif_confirm_btn')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12, marginBottom: 20 }}>
                <div className="px-[14px] py-[10px] md:px-[16px] md:py-[12px]" style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 10 }}>
                  <div className="text-[10.5px] md:text-[11px]" style={{ fontWeight: 700, opacity: 0.8 }}>{t('matricules.minesec_total_attendu')}</div>
                  <div className="text-[16px] md:text-[18px]" style={{ fontWeight: 800 }}>{dashboard.totaux.totalAttendu.toLocaleString()} FCFA</div>
                </div>
                <div className="px-[14px] py-[10px] md:px-[16px] md:py-[12px]" style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--green)', borderRadius: 10 }}>
                  <div className="text-[10.5px] md:text-[11px]" style={{ fontWeight: 700, opacity: 0.8 }}>{t('matricules.minesec_total_paye')}</div>
                  <div className="text-[16px] md:text-[18px]" style={{ fontWeight: 800 }}>{dashboard.totaux.totalPaye.toLocaleString()} FCFA</div>
                </div>
                <div className="px-[14px] py-[10px] md:px-[16px] md:py-[12px]" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)', borderRadius: 10 }}>
                  <div className="text-[10.5px] md:text-[11px]" style={{ fontWeight: 700, opacity: 0.8 }}>{t('matricules.minesec_total_restant')}</div>
                  <div className="text-[16px] md:text-[18px]" style={{ fontWeight: 800 }}>{dashboard.totaux.totalRestant.toLocaleString()} FCFA</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:[grid-template-columns:1fr_1fr]" style={{ gap: 16 }}>
                {/* MINESEC */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{t('matricules.minesec_column')}</h4>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <a href="https://cartescolaire.cm/verify-payment" target="_blank" rel="noopener noreferrer"
                        style={{ ...btnSec, fontSize: 11, padding: '4px 10px', textDecoration: 'none', display: 'inline-block' }}>
                        {t('matricules.pay_on_cartescolaire_btn')}
                      </a>
                      <button onClick={generateForStudent} disabled={generating} style={{ ...btnPri, fontSize: 11, padding: '4px 10px' }}>
                        {generating ? '...' : t('matricules.generate_btn')}
                      </button>
                    </span>
                  </div>
                  {dashboard.paiementsMinesec.length === 0 ? (
                    <p style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 13 }}>{t('matricules.no_data')}</p>
                  ) : dashboard.paiementsMinesec.map(p => {
                    const sc = STATUT_COLORS[p.status === 'IMPAYE' ? 'EN_RETARD' : p.status === 'VERIFIE' ? 'A_JOUR' : 'PARTIELLEMENT_PAYE'] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                    return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                        <span>{p.typeFrais}</span>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {p.montantAttendu.toLocaleString()} FCFA
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, ...sc }}>{p.status}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Établissement */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{t('matricules.etablissement_column')}</h4>
                  {dashboard.paiementsEtablissement.length === 0 ? (
                    <p style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 13 }}>{t('matricules.no_data')}</p>
                  ) : dashboard.paiementsEtablissement.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                      <span>{p.label}</span>
                      <span>{p.montantPaye.toLocaleString()} / {p.montantAttendu.toLocaleString()} FCFA</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
