'use client'

import { useState } from 'react'
import { X, RefreshCw, CheckCircle2, PlusCircle, Edit3, ShieldCheck, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type { OnToast } from './types'

export interface DeriveProgrammeSummary {
  programmeId: string
  programmeTitre: string
  subjectName: string
  className: string | null
  level: string | null
  ajoutesCount: number
  modifiesCount: number
  retiresCount: number
  retiresUtilisesCount: number
  titreModifie: boolean
}

interface SyncPreviewData {
  programme: {
    id: string
    titre: string
    subjectName: string
    className: string | null
  }
  diff: {
    aDerive: boolean
    titreModifie: boolean
    titreAvant: string
    titreApres: string
    ajoutes: Array<{ sourceKey: string; ordre: number; titre: string; moduleTitre: string | null }>
    modifies: Array<{
      chapitreId: string
      champsModifies: string[]
      avant: { titre: string }
      apres: { titre: string }
    }>
    retiresDuNational: Array<{
      chapitreId: string
      titre: string
      utilisee: boolean
      nbSeancesCahier: number
      nbCochesDirectes: number
    }>
    inchangesCount: number
  }
}

interface Props {
  open: boolean
  derives: DeriveProgrammeSummary[]
  onClose: () => void
  onSynced: () => void
  onToast: OnToast
}

export default function SyncProgrammesNationauxModal({
  open,
  derives,
  onClose,
  onSynced,
  onToast,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<SyncPreviewData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handlePreview = async (programmeId: string) => {
    setSelectedId(programmeId)
    setLoadingPreview(true)
    setErrorMsg(null)
    try {
      const res = await fetchApi(`/api/v2/pedagogie/programmes/${programmeId}/synchroniser/propose`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErrorMsg(json.message ?? 'Impossible de prévisualiser la mise à jour')
        setPreview(null)
      } else {
        setPreview(json.data as SyncPreviewData)
      }
    } catch {
      setErrorMsg('Erreur réseau lors de la prévisualisation')
      setPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleApply = async (programmeId: string) => {
    setApplyingId(programmeId)
    setErrorMsg(null)
    try {
      const res = await fetchApi(`/api/v2/pedagogie/programmes/${programmeId}/synchroniser/apply`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErrorMsg(json.message ?? 'Erreur lors de la synchronisation')
      } else {
        const d = json.data
        onToast(
          `Programme synchronisé : ${d.nbAjoutes} ajout(s), ${d.nbModifies} mise(s) à jour — coches et cahiers conservés`,
          'success',
        )
        setPreview(null)
        setSelectedId(null)
        onSynced()
      }
    } catch {
      setErrorMsg('Erreur réseau lors de la synchronisation')
    } finally {
      setApplyingId(null)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mises à jour du référentiel national"
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 740, maxHeight: '88vh', overflowY: 'auto',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
          padding: 20, boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={18} style={{ color: 'var(--amber)' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
              Mises à jour du référentiel national ({derives.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 8, background: 'var(--green-light)', color: 'var(--green)', fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
          <ShieldCheck size={15} />
          Synchronisation non destructive : toutes les coches d&apos;avancement, les cahiers de texte et les modules désactivés sont strictement préservés.
        </div>

        {errorMsg && (
          <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 12, background: 'var(--red-light)', color: 'var(--red)', fontSize: 12.5, fontWeight: 700 }}>
            {errorMsg}
          </div>
        )}

        {derives.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--green)', fontSize: 13, fontWeight: 700 }}>
            <CheckCircle2 size={24} style={{ display: 'inline', marginBottom: 6 }} />
            <div>Tous les programmes nationaux de l&apos;établissement sont à jour.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {derives.map((d) => {
              const isSelected = selectedId === d.programmeId
              return (
                <div
                  key={d.programmeId}
                  style={{
                    borderRadius: 10, border: `1px solid ${isSelected ? 'var(--sidebar)' : 'var(--border)'}`,
                    background: 'var(--bg)', padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                        {d.programmeTitre}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {d.className && <strong>{d.className}</strong>}
                        <span>{d.subjectName}</span>
                        <span style={{ color: 'var(--green)', fontWeight: 700 }}>+{d.ajoutesCount} ajout(s)</span>
                        <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{d.modifiesCount} modifié(s)</span>
                        {d.retiresCount > 0 && (
                          <span style={{ color: 'var(--amber)', fontWeight: 700 }}>
                            {d.retiresCount} retiré(s) du national (conservés)
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePreview(d.programmeId)}
                      disabled={loadingPreview && isSelected}
                      style={{
                        padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                        background: 'var(--surface)', color: 'var(--sidebar)',
                        border: '1px solid var(--sidebar)', cursor: 'pointer',
                      }}
                    >
                      {loadingPreview && isSelected ? 'Analyse...' : 'Prévisualiser'}
                    </button>
                  </div>

                  {isSelected && loadingPreview && (
                    <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
                      <Loader2 size={15} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />
                      Calcul du diff...
                    </div>
                  )}

                  {isSelected && !loadingPreview && preview && preview.programme.id === d.programmeId && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {preview.diff.ajoutes.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <PlusCircle size={12} /> Leçons à ajouter ({preview.diff.ajoutes.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 120, overflowY: 'auto' }}>
                            {preview.diff.ajoutes.map((a) => (
                              <div key={a.sourceKey} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 8px', borderRadius: 6, background: 'var(--surface)' }}>
                                {a.titre}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {preview.diff.modifies.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Edit3 size={12} /> Leçons mises à jour en place ({preview.diff.modifies.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 120, overflowY: 'auto' }}>
                            {preview.diff.modifies.map((m) => (
                              <div key={m.chapitreId} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 8px', borderRadius: 6, background: 'var(--surface)' }}>
                                <span>{m.apres.titre}</span>{' '}
                                <span style={{ fontSize: 11, color: 'var(--text3)' }}>({m.champsModifies.join(', ')})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {preview.diff.retiresDuNational.length > 0 && (
                        <div style={{ fontSize: 11.5, color: 'var(--amber)', fontWeight: 700 }}>
                          {preview.diff.retiresDuNational.length} leçon(s) absente(s) du nouveau référentiel seront conservées pour protéger l&apos;historique.
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          disabled={applyingId === d.programmeId}
                          onClick={() => handleApply(d.programmeId)}
                          style={{
                            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                            background: 'var(--sidebar)', color: 'white', border: 'none', cursor: 'pointer',
                          }}
                        >
                          {applyingId === d.programmeId ? 'Synchronisation...' : 'Appliquer la mise à jour'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              background: 'var(--bg2)', color: 'var(--text2)', border: 'none', cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
