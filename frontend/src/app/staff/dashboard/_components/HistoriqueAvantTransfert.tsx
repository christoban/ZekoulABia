'use client'

/**
 * Bloc Censeur / Conseiller B (Plan v2 §8) : les élèves arrivés par transfert à cette école,
 * avec école d'origine et date de réception. Consultation du dossier en lecture seule
 * (categories + payload déchiffré par le serveur, checksum re-validé côté serveur).
 * Deux niveaux de détails : liste puis carte « Dossier reçu ».
 */
import { useState, useCallback, useEffect } from 'react'
import { useT } from '@/lib/i18n'
import { FileText, Building2, CalendarClock, Lock, Loader2, X } from 'lucide-react'
import type { CompletedTransferBrief, DossierTransfertLu } from '@/features/studentTransfer/transferApi'
import { historiqueTransferts, lireDossier } from '@/features/studentTransfer/transferApi'

export default function HistoriqueAvantTransfert() {
  const t = useT('studentTransfer')
  const [lignes, setLignes] = useState<CompletedTransferBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [dossier, setDossier] = useState<DossierTransfertLu | null>(null)
  const [origine, setOrigine] = useState<CompletedTransferBrief | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      setLignes(await historiqueTransferts())
      setErreur(null)
    } catch (e) {
      setErreur(String((e as Error).message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void charger() }, [charger])

  const ouvrir = async (ligne: CompletedTransferBrief) => {
    if (!ligne.snapshotId) return
    setErreur(null)
    try {
      setDossier(await lireDossier(ligne.id, ligne.snapshotId))
      setOrigine(ligne)
    } catch (e) {
      const msg = String((e as Error).message)
      setErreur(msg.includes('altéré') ? t('staff.dossier_erreur_integrite') : msg)
    }
  }

  return (
    <div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={15} color="var(--primary, #2563eb)" /> {t('staff.historique_titre')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t('staff.historique_subtitle')}</div>
        </div>

        {loading ? (
          <div style={{ padding: '26px 20px', textAlign: 'center', color: 'var(--text3)' }}><Loader2 size={18} className="animate-spin inline" /></div>
        ) : erreur ? (
          <div style={{ padding: '14px 16px', fontSize: 12.5, color: 'var(--red, #dc2626)' }}>{erreur}</div>
        ) : lignes.length === 0 ? (
          <div style={{ padding: '26px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('staff.historique_vide')}</div>
        ) : (
          lignes.map((ligne) => (
            <div key={ligne.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={14} color="var(--text3)" /> {t('staff.historique_ecole_origine')} : {ligne.sourceSchoolName}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <CalendarClock size={12} /> {t('staff.historique_date')} {ligne.completedAt ? new Date(ligne.completedAt).toLocaleDateString() : '—'}
                </div>
              </div>
              <button
                onClick={() => { void ouvrir(ligne) }}
                disabled={!ligne.snapshotId}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--primary, #2563eb)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: ligne.snapshotId ? 1 : 0.5 }}
              >
                {t('staff.historique_ouvrir')}
              </button>
            </div>
          ))
        )}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lock size={12} /> {t('staff.historique_censure_note')}
      </div>

      {/* Drawer détail du dossier */}
      {dossier && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--surface, #fff)', width: 'min(520px, 100%)', height: '100%', overflowY: 'auto', padding: 18, boxShadow: '-8px 0 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                {origine ? `${t('staff.historique_ecole_origine')} : ${origine.sourceSchoolName}` : t('categories.titre')}
              </div>
              <button onClick={() => { setDossier(null); setOrigine(null) }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dossier.categories.map((categorie) => (
                <BlocCategorie key={categorie} categorie={categorie} payload={dossier.payload} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BlocCategorie({ categorie, payload }: { categorie: string; payload: Record<string, unknown> }) {
  const t = useT('studentTransfer')
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg2, #f3f4f6)', fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>
        {t(`categories.${categorie}`)}
      </div>
      <pre style={{ margin: 0, padding: '10px 12px', fontSize: 11.5, color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflowY: 'auto' }}>
        {JSON.stringify(payload[categorie] ?? null, null, 2)}
      </pre>
    </div>
  )
}
