'use client'

import React, { useState } from 'react'
import { X, Upload, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import {
  ApiError,
  applyOfficialProgressionsImport,
  proposeOfficialProgressionsImport,
  type ImportProgressionDryRunDto,
} from '../../_api'
import ReferentielProgressionImportPreview from './ReferentielProgressionImportPreview'

interface Props {
  open: boolean
  onClose: () => void
  onImported: (msg: string) => void
}

/**
 * Modale d'import JSON des progressions officielles en 2 étapes :
 * - Étape 1 : sélection du fichier + aperçu dry-run (propose)
 * - Étape 2 : confirmation finale + écriture atomique (apply)
 */
export default function ReferentielProgressionImportModal({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [fileName, setFileName] = useState('')
  const [rawPayload, setRawPayload] = useState<Record<string, unknown> | null>(null)
  const [dryRun, setDryRun] = useState<ImportProgressionDryRunDto | null>(null)
  const [confirmOverwriteIds, setConfirmOverwriteIds] = useState<string[]>([])
  const [skipManuallyEdited, setSkipManuallyEdited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const resetAndClose = () => {
    setStep(1)
    setFileName('')
    setRawPayload(null)
    setDryRun(null)
    setConfirmOverwriteIds([])
    setSkipManuallyEdited(false)
    setError(null)
    onClose()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError(null)
    setDryRun(null)
    setConfirmOverwriteIds([])
    setSkipManuallyEdited(false)
    setStep(1)

    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      setError('Fichier JSON invalide : impossible de lire ou parser le contenu.')
      return
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('Le fichier JSON doit contenir un objet racine avec un tableau « items ».')
      return
    }

    const payloadObj = parsed as Record<string, unknown>
    setRawPayload(payloadObj)
    setLoading(true)
    try {
      setDryRun(await proposeOfficialProgressionsImport(payloadObj))
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de l\'analyse dry-run du fichier.')
    } finally {
      setLoading(false)
    }
  }

  const toggleConfirmManualId = (id: string) => {
    setConfirmOverwriteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const unresolvedManualCount = dryRun
    ? dryRun.conflitsManuels.filter(
        (c) => !c.existingId || !confirmOverwriteIds.includes(c.existingId),
      ).length
    : 0

  const canProceedToConfirm = Boolean(
    dryRun && dryRun.rejets.length === 0 && (unresolvedManualCount === 0 || skipManuallyEdited),
  )

  const handleApply = async () => {
    if (!rawPayload) return
    setLoading(true)
    setError(null)
    try {
      const result = await applyOfficialProgressionsImport({
        ...rawPayload,
        confirmOverwriteManualIds: confirmOverwriteIds,
        skipManuallyEdited,
      })
      const msg =
        result.totalAffected === 0
          ? `Import ${result.level} déjà à jour (${result.unchangedCount} inchangée(s), ${result.skippedManualCount} ignorée(s)).`
          : `Import ${result.level} appliqué : ${result.createdCount} créée(s), ${result.updatedCount} MAJ, ${result.overwrittenManualCount} manuelle(s) remplacée(s), ${result.unchangedCount} inchangée(s).`
      onImported(msg)
      resetAndClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'application de l\'import.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
          borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', boxShadow: '0 20px 44px rgba(0,0,0,0.28)',
          fontFamily: 'var(--font-nunito), Nunito, sans-serif',
        }}
      >
        <div
          style={{
            padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)',
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
              Importer des progressions officielles (JSON) — Étape {step}/2
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {step === 1
                ? 'Analyse préalable (dry-run) sans écriture en base'
                : 'Confirmation finale avant écriture atomique'}
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div
              style={{
                background: 'var(--bg2)', border: '1px solid var(--red, #dc2626)', borderRadius: 10,
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
                color: 'var(--red, #dc2626)', fontSize: 13, fontWeight: 700,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <>
              <label
                style={{
                  border: '1.5px dashed var(--border)', borderRadius: 12, padding: '18px 16px',
                  background: 'var(--bg2)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6, cursor: 'pointer', textAlign: 'center',
                }}
              >
                <Upload size={22} color="var(--primary)" />
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>
                  {fileName || 'Sélectionner un fichier JSON de niveau (ex. 6e)'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Lot mono-niveau uniquement · Analyse dry-run automatique avant toute écriture
                </div>
                <input type="file" accept=".json,application/json" onChange={handleFileChange} disabled={loading} style={{ display: 'none' }} />
              </label>

              {loading && (
                <div style={{ textAlign: 'center', padding: 16, fontSize: 13, color: 'var(--text3)' }}>
                  Analyse du fichier en cours...
                </div>
              )}

              {dryRun && (
                <ReferentielProgressionImportPreview
                  dryRun={dryRun}
                  confirmOverwriteIds={confirmOverwriteIds}
                  onToggleConfirmManualId={toggleConfirmManualId}
                  skipManuallyEdited={skipManuallyEdited}
                  onSkipManuallyEditedChange={setSkipManuallyEdited}
                />
              )}
            </>
          )}

          {step === 2 && dryRun && (
            <div
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
                padding: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
                Confirmation de l&apos;import atomique — Niveau {dryRun.level}
              </div>
              <div>Fichier : <strong>{fileName}</strong> · Source : <strong>{dryRun.source}</strong></div>
              <div>
                Créations : <strong>{dryRun.resume.aCreer}</strong> · Mises à jour :{' '}
                <strong>{dryRun.resume.aMettreAJour}</strong> · Inchangés :{' '}
                <strong>{dryRun.resume.inchanges}</strong>
              </div>
              {dryRun.conflitsManuels.length > 0 && (
                <div>
                  Lignes modifiées manuellement écrasées : <strong>{confirmOverwriteIds.length}</strong> ·
                  Ignorées : <strong>{unresolvedManualCount}</strong>
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Le serveur revalidera intégralement le fichier JSON (schéma, matières, conflits) avant
                d&apos;appliquer toutes les écritures dans une transaction unique.
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 20px', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0,
          }}
        >
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
              }}
            >
              <ArrowLeft size={15} />
              Retour à l&apos;aperçu
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={resetAndClose}
              disabled={loading}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Annuler
            </button>
            {step === 1 ? (
              <button
                type="button"
                disabled={!canProceedToConfirm || loading}
                onClick={() => setStep(2)}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: canProceedToConfirm ? 'var(--primary)' : 'var(--bg2)',
                  color: canProceedToConfirm ? '#ffffff' : 'var(--text3)',
                  fontSize: 13, fontWeight: 700, cursor: canProceedToConfirm ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                Continuer vers la confirmation
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleApply}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: 'var(--green, #16a34a)', color: '#ffffff',
                  fontSize: 13, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}
              >
                <CheckCircle2 size={15} />
                {loading ? 'Application en cours...' : 'Confirmer et appliquer'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
