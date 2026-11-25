'use client'

/**
 * Section « Transferts d'élèves » du dashboard STAFF (Plan v2 §8, côté école cible B).
 * Trois blocs selon les permissions réelles (RBAC serveur au-delà) :
 * - Secrétaire (TRANSFER_REQUEST) : bandeau de vérification MINESEC + liste des demandes
 *   envoyées avec statut, annulation online-only et association du profil de réception.
 * - Censeur / Conseiller (TRANSFER_DOSSIER_VIEW) : « Historique avant transfert » lecture seule.
 * Actions des sensibles : refusées hors-ligne (registre FORT) — boutons désactivés hors ligne.
 */
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useT } from '@/lib/i18n'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { RefreshCw, ShieldCheck, ShieldAlert, Loader2, X, AlertCircle } from 'lucide-react'
import type { SentTransfer } from '@/features/studentTransfer/transferApi'
import {
  verifierIdentite, creerDemande, listerEnvoyees, annulerDemande, associerProfilCible,
} from '@/features/studentTransfer/transferApi'
import TransferStatusBadge from '@/features/studentTransfer/TransferStatusBadge'
import HistoriqueAvantTransfert from './HistoriqueAvantTransfert'
import type { SessionUser } from '../_types'

interface Props {
  sessionUser: SessionUser | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const sTitle: CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }
const sSub: CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const sCard: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }
const btnPrimary: CSSProperties = { padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--primary, #2563eb)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
const btnGhost: CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--surface, #fff)', color: 'var(--text, #111827)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }

export default function SectionTransfertsStaff({ sessionUser, onToast }: Props) {
  const t = useT('studentTransfer')
  const isOnline = useOnlineStatus()
  const permissions = sessionUser?.permissions ?? []
  const peutCreer = permissions.includes('TRANSFER_REQUEST')
  const peutVoirDossier = permissions.includes('TRANSFER_DOSSIER_VIEW')
  const [onglet, setOnglet] = useState<'VERIFIER' | 'DEMANDES' | 'HISTORIQUE'>(peutCreer ? 'DEMANDES' : 'HISTORIQUE')
  const [demandes, setDemandes] = useState<SentTransfer[]>([])
  const [loading, setLoading] = useState(false)
  const [nationalId, setNationalId] = useState('')
  const [detect, setDetect] = useState<'LIBRE' | 'EXISTE' | null>(null)
  const [creerOuvert, setCreerOuvert] = useState(false)
  const [annee, setAnnee] = useState('2026-2027')
  const [annulation, setAnnulation] = useState<SentTransfer | null>(null)
  const [association, setAssociation] = useState<SentTransfer | null>(null)

  const charger = useCallback(async () => {
    if (!peutCreer) return
    setLoading(true)
    try { setDemandes(await listerEnvoyees()) } catch (e) { onToast(String((e as Error).message), 'error') } finally { setLoading(false) }
  }, [peutCreer, onToast])

  useEffect(() => { void charger() }, [charger])

  const refuseHorsLigne = () => onToast(t('tuteur.erreur_generique'), 'error')

  const verifier = async () => {
    setDetect(null)
    try {
      setDetect((await verifierIdentite(nationalId)) ? 'EXISTE' : 'LIBRE')
    } catch (e) {
      onToast(String((e as Error).message), 'error')
    }
  }

  const creer = async () => {
    if (!isOnline) return refuseHorsLigne()
    try {
      await creerDemande({ nationalId, academicYearTarget: annee })
      onToast(t('staff.creer_ok'), 'success')
      setCreerOuvert(false); setDetect(null); setNationalId('')
      void charger()
    } catch (e) { onToast(String((e as Error).message), 'error') }
  }

  const annuler = async () => {
    if (!annulation || !isOnline) { refuseHorsLigne(); return }
    try {
      await annulerDemande(annulation.id)
      onToast(t('staff.annulee_ok'), 'success')
      setAnnulation(null); void charger()
    } catch (e) { onToast(String((e as Error).message), 'error') }
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={sTitle}>{t('staff.page_title')}</div>
        <div style={sSub}>{t('staff.page_subtitle')}</div>
      </div>

      {/* Hors-ligne : toutes les actions de transfert sont refusées (registre FORT). */}
      {!isOnline && (
        <div style={{ ...sCard, padding: '10px 14px', background: 'rgba(234,88,12,0.1)', borderColor: 'rgba(234,88,12,0.3)', color: '#c2410c', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <ShieldAlert size={16} /> {t('tuteur.erreur_generique')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {peutCreer && (['DEMANDES', 'VERIFIER'] as const).map((id) => (
          <button key={id} onClick={() => setOnglet(id)} style={{ ...btnGhost, background: onglet === id ? 'var(--primary, #2563eb)' : 'var(--surface)', color: onglet === id ? '#fff' : 'var(--text)', borderColor: onglet === id ? 'var(--primary, #2563eb)' : 'var(--border)' }}>
            <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
            {id === 'DEMANDES' ? t('staff.onglet_demandes') : t('staff.onglet_verifier')}
          </button>
        ))}
        {peutVoirDossier && (
          <button onClick={() => setOnglet('HISTORIQUE')} style={{ ...btnGhost, background: onglet === 'HISTORIQUE' ? 'var(--primary, #2563eb)' : 'var(--surface)', color: onglet === 'HISTORIQUE' ? '#fff' : 'var(--text)', borderColor: onglet === 'HISTORIQUE' ? 'var(--primary, #2563eb)' : 'var(--border)' }}>
            {t('staff.onglet_historique')}
          </button>
        )}
      </div>

      {onglet === 'VERIFIER' && peutCreer && (
        <div style={{ ...sCard, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{t('staff.verifier_titre')}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 10px' }}>{t('staff.verifier_help')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={nationalId}
              onChange={(e) => { setNationalId(e.target.value); setDetect(null) }}
              placeholder={t('staff.matricule_placeholder')}
              style={{ flex: '1 1 260px', minHeight: 38, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            />
            <button onClick={verifier} disabled={!nationalId || !isOnline} style={btnPrimary}>{t('staff.verifier_bouton')}</button>
          </div>
          {detect === 'EXISTE' && (
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#b45309', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 12.5 }}>
              <span>{t('staff.detect_ok')}</span>
              <button onClick={() => setCreerOuvert(true)} style={btnPrimary}>{t('staff.creer_demande')}</button>
            </div>
          )}
          {detect === 'LIBRE' && (
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', color: 'var(--green, #16a34a)', fontSize: 12.5 }}>
              {t('staff.detect_libre')}
            </div>
          )}
        </div>
      )}

      {onglet === 'DEMANDES' && peutCreer && (
        <div style={sCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{t('staff.onglet_demandes')}</div>
            <button onClick={() => { void charger() }} style={btnGhost}><RefreshCw size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {t('staff.recharger')}</button>
          </div>
          {loading || demandes.length === 0 ? (
            <div style={{ padding: '26px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>
              {loading ? <Loader2 size={18} className="animate-spin inline" /> : t('staff.liste_vide')}
            </div>
          ) : (
            demandes.map((d) => <LigneDemande key={d.id} demande={d}
              onAnnuler={() => setAnnulation(d)} onAssocier={() => setAssociation(d)} />)
          )}
        </div>
      )}

      {onglet === 'HISTORIQUE' && peutVoirDossier && <HistoriqueAvantTransfert />}

      {creerOuvert && (
        <div style={overlay}>
          <div style={dialogue}>
            <Entete titre={t('staff.creer_dialogue_titre')} onClose={() => setCreerOuvert(false)} />
            <p style={{ fontSize: 12.5, color: 'var(--text2)', margin: '0 0 10px' }}>{t('staff.creer_dialogue_texte')}</p>
            <label style={{ ...sLabel }}>{t('staff.annee_cible_label')}</label>
            <input value={annee} onChange={(e) => setAnnee(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setCreerOuvert(false)} style={btnGhost}>✕</button>
              <button onClick={creer} disabled={!isOnline} style={btnPrimary}>{t('staff.creer_bouton_confirmer')}</button>
            </div>
          </div>
        </div>
      )}

      {annulation && (
        <div style={overlay}>
          <div style={dialogue}>
            <Entete titre={t('staff.annuler_confirmer_titre')} onClose={() => setAnnulation(null)} />
            <p style={{ fontSize: 12.5, color: 'var(--text2)' }}>{t('staff.annuler_confirmer_texte')}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setAnnulation(null)} style={btnGhost}>✕</button>
              <button onClick={annuler} disabled={!isOnline} style={{ ...btnPrimary, background: 'var(--red, #dc2626)' }}>{t('staff.annuler_bouton_confirmer')}</button>
            </div>
          </div>
        </div>
      )}

      {association && <DialogueAssociation demande={association} onFermer={() => setAssociation(null)} onToast={onToast} onOk={() => { setAssociation(null); void charger() }} />}
    </div>
  )
}

/* ── Ligne de demande ── */
function LigneDemande({ demande, onAnnuler, onAssocier }: { demande: SentTransfer; onAnnuler: () => void; onAssocier: () => void }) {
  const isOnline = useOnlineStatus()
  const t = useT('studentTransfer')
  const annulable = ['PENDING_GUARDIAN', 'PENDING_SOURCE'].includes(demande.status)
  const aAssocier = demande.status === 'COMPLETED' && !demande.targetStudentProfileId
  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          {demande.sourceSchoolName} · {demande.academicYearTarget}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
          {t('staff.demande_demandee_le')} {new Date(demande.requestedAt).toLocaleDateString()}
          {demande.rejectionReason ? ` · ${t('staff.message_refus')} : ${demande.rejectionReason}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TransferStatusBadge status={demande.status} />
        {annulable && (
          <button onClick={onAnnuler} disabled={!isOnline} style={{ ...btnGhost, borderColor: 'var(--red, #dc2626)', color: 'var(--red, #dc2626)' }}>
            <X size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {t('staff.annuler_bouton')}
          </button>
        )}
        {aAssocier && (
          <button onClick={onAssocier} disabled={!isOnline} style={btnPrimary}>{t('staff.associer_bouton')}</button>
        )}
      </div>
    </div>
  )
}

/* ── Dialogue d'association du profil de réception (inscription déjà faite côté B) ── */
function DialogueAssociation({ demande, onFermer, onToast, onOk }: { demande: SentTransfer; onFermer: () => void; onToast: Props['onToast']; onOk: () => void }) {
  const t = useT('studentTransfer')
  const isOnline = useOnlineStatus()
  const [eleves, setEleves] = useState<{ userId: string; firstName: string; lastName: string }[]>([])
  const [choix, setChoix] = useState('')

  useEffect(() => {
    fetchApiUsers().then(setEleves).catch(() => setEleves([]))
  }, [])

  async function fetchApiUsers(): Promise<{ userId: string; firstName: string; lastName: string }[]> {
    const res = await fetch('/api/v2/users?role=STUDENT&limit=200', { credentials: 'include' })
    const json = await res.json().catch(() => null) as { success?: boolean; data?: unknown } | null
    const list = Array.isArray(json?.data) ? json.data : []
    return (list as Array<{ userId?: string; id?: string; firstName: string; lastName: string }>)
      .map((u) => ({ userId: String(u.userId ?? u.id ?? ''), firstName: u.firstName, lastName: u.lastName }))
      .filter((u) => (u.userId ? true : false))
  }

  const associer = async () => {
    if (!isOnline) return onToast(t('tuteur.erreur_generique'), 'error')
    try {
      await associerProfilCible(demande.id, choix)
      onToast(t('staff.associer_ok'), 'success')
      onOk()
    } catch (e) {
      const msg = String((e as Error).message)
      onToast(msg.includes('déjà associé') ? t('staff.associer_deja') : msg, 'error')
    }
  }

  return (
    <div style={overlay}>
      <div style={dialogue}>
        <Entete titre={t('staff.associer_titre')} onClose={onFermer} />
        <p style={{ fontSize: 12.5, color: 'var(--text2)', margin: '0 0 10px' }}>{t('staff.associer_texte')}</p>
        <select value={choix} onChange={(e) => setChoix(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {eleves.map((u) => <option key={u.userId} value={u.userId}>{u.firstName} {u.lastName}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onFermer} style={btnGhost}>✕</button>
          <button onClick={associer} disabled={!choix || !isOnline} style={btnPrimary}>{t('staff.associer_bouton_confirmer')}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Morceaux de dialogue communs ── */
function Entete({ titre, onClose }: { titre: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>
        <AlertCircle size={16} color="var(--primary, #2563eb)" /> {titre}
      </div>
      <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
    </div>
  )
}

const sLabel: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '8px 0 4px' }
const inputStyle: CSSProperties = { width: '100%', minHeight: 38, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }
const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const dialogue: CSSProperties = { background: 'var(--surface, #fff)', borderRadius: 12, border: '1px solid var(--border)', padding: 18, width: 'min(440px, 100%)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }
