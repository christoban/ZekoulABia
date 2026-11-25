'use client'

/**
 * Écran administrateur (école d'origine A) — Plan v2 §8 : demandes reçues, état du
 * consentement parent, délai restant d'auto-approbation, accepter / refuser avec motif.
 * Toutes les décisions passent par le serveur (machine d'états atomique, RBAC, flag).
 */
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useT } from '@/lib/i18n'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { ArrowRightLeft, RefreshCw, Check, X, Loader2, Hourglass, ShieldCheck, ShieldX } from 'lucide-react'
import TransferStatusBadge from '@/features/studentTransfer/TransferStatusBadge'
import type { ReceivedTransfer } from '@/features/studentTransfer/transferApi'
import { listerRecues, deciderDemande } from '@/features/studentTransfer/transferApi'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

const sTitle: CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }
const sCard: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }
const btnPrimary: CSSProperties = { padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--primary, #2563eb)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
const btnGhost: CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface, #fff)', color: 'var(--text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const inputStyle: CSSProperties = { width: '100%', minHeight: 38, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }

function joursRestants(demande: ReceivedTransfer): number {
  if (!demande.sourceAutoApprovalAt || demande.status !== 'PENDING_SOURCE') return 0
  const delta = new Date(demande.sourceAutoApprovalAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(delta / 86_400_000))
}

export default function SectionAdminStudentTransfers({ onToast }: Props) {
  const t = useT('studentTransfer')
  const isOnline = useOnlineStatus()
  const [demandes, setDemandes] = useState<ReceivedTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [refus, setRefus] = useState<ReceivedTransfer | null>(null)
  const [motif, setMotif] = useState('')

  const charger = useCallback(async () => {
    setLoading(true)
    try { setDemandes(await listerRecues()); } catch (e) { onToast(String((e as Error).message), 'error') } finally { setLoading(false) }
  }, [onToast])

  useEffect(() => { void charger() }, [charger])

  const accepter = async (demande: ReceivedTransfer) => {
    if (!isOnline) return onToast(t('tuteur.erreur_generique'), 'error')
    try {
      await deciderDemande({ requestId: demande.id, decision: 'APPROVE' })
      onToast(t('admin.accept_valide'), 'success')
      void charger()
    } catch (e) { onToast(String((e as Error).message), 'error') }
  }

  const refuser = async () => {
    if (!refus || !isOnline) return onToast(t('tuteur.erreur_generique'), 'error')
    try {
      await deciderDemande({ requestId: refus.id, decision: 'REFUSE', rejectionReason: motif.trim() || undefined })
      onToast(t('admin.refus_refuse'), 'info')
      setRefus(null); setMotif('')
      void charger()
    } catch (e) { onToast(String((e as Error).message), 'error') }
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={sTitle}>{t('admin.page_title')}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{t('admin.page_subtitle')}</div>
      </div>

      <div style={{ ...sCard }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowRightLeft size={15} color="var(--primary, #2563eb)" /> {t('title')}
          </div>
          <button onClick={() => { void charger() }} style={btnGhost}><RefreshCw size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {t('admin.recharger')}</button>
        </div>

        {loading ? (
          <div style={{ padding: '26px 20px', textAlign: 'center', color: 'var(--text3)' }}><Loader2 size={18} className="animate-spin inline" /></div>
        ) : demandes.length === 0 ? (
          <div style={{ padding: '26px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('admin.liste_vide')}</div>
        ) : (
          demandes.map((demande) => {
            const reste = joursRestants(demande)
            const decisionnable = ['PENDING_SOURCE'].includes(demande.status)
            return (
              <div key={demande.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 240 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {t('admin.demande_recue_titre')} · {demande.targetSchoolName}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                    {t('staff.demande_demandee_le')} {new Date(demande.requestedAt).toLocaleDateString()} · {t('staff.annee_cible_label')} : {demande.academicYearTarget}
                  </div>
                  {/* État du consentement parent */}
                  <div style={{ fontSize: 11.5, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {demande.consenterDecision === 'ACCEPTED' ? (
                      <span style={{ color: 'var(--green, #16a34a)', fontWeight: 700 }}><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> {t('admin.consentement_accepte')}</span>
                    ) : demande.consenterDecision === 'REFUSED' ? (
                      <span style={{ color: 'var(--red, #dc2626)', fontWeight: 700 }}><ShieldX size={13} style={{ verticalAlign: -2 }} /> {t('admin.consentement_refuse')}</span>
                    ) : demande.consenterDecision === 'REVOKED' ? (
                      <span style={{ color: 'var(--red, #dc2626)', fontWeight: 700 }}>{t('admin.consentement_revoque')}</span>
                    ) : (
                      <span style={{ color: 'var(--amber, #d97706)' }}>{t('admin.consentement_attente')}</span>
                    )}
                  </div>
                  {/* Délai restant avant auto-approbation */}
                  {reste > 0 && (
                    <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Hourglass size={12} /> {t('admin.delai_auto', { jours: reste })}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <TransferStatusBadge status={demande.status} />
                  {decisionnable && (
                    <>
                      <button onClick={() => setRefus(demande)} disabled={!isOnline} style={{ ...btnGhost, borderColor: 'var(--red, #dc2626)', color: 'var(--red, #dc2626)' }}>
                        <X size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {t('admin.refuser_bouton')}
                      </button>
                      <button onClick={() => { void accepter(demande) }} disabled={!isOnline} style={{ ...btnPrimary, background: 'var(--green, #16a34a)' }}>
                        <Check size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {t('admin.accepter_bouton')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal du refus avec motif */}
      {refus && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--surface, #fff)', borderRadius: 12, border: '1px solid var(--border)', padding: 18, width: 'min(440px, 100%)' }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 10 }}>{t('admin.refuser_bouton')}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('admin.refuser_motif_label')}</div>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={t('admin.refuser_motif_placeholder')} style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setRefus(null)} style={btnGhost}>✕</button>
              <button onClick={refuser} disabled={!isOnline} style={{ ...btnPrimary, background: 'var(--red, #dc2626)' }}>{t('admin.refuser_bouton')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
