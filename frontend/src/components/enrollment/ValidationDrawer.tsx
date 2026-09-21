'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Download,
  AlertTriangle,
  Loader2,
  Smartphone,
  ShieldAlert,
  FileCheck,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import EnrollmentPieceChecklist, { type PieceItem } from './EnrollmentPieceChecklist'
import EnrollmentCompletenessRing from './EnrollmentCompletenessRing'
import StudentFeesStatusBadge from './StudentFeesStatusBadge'

export interface DrawerDossier {
  id: string
  nomProvisoire: string
  status: string
  sourceType: string
  recipientType: string
  classId: string | null
  classe: { name: string } | null
  contactEmail: string | null
  contactTelephone: string | null
  parentContactEmail?: string | null
  parentContactTelephone?: string | null
  eleveADispositif?: boolean
  parentADispositif?: boolean
  completenessScore?: number | null
  validableSousReserve?: boolean
  returnedComment?: string | null
  numeroInterne?: string | null
  createdStudentId?: string | null
  submittedData?: Record<string, any> | null
}

interface Props {
  dossier: DrawerDossier | null
  isOpen: boolean
  onClose: () => void
  onActionComplete: () => void
  isAdmin?: boolean
}

export default function ValidationDrawer({
  dossier,
  isOpen,
  onClose,
  onActionComplete,
  isAdmin = true,
}: Props) {
  const [pieces, setPieces] = useState<PieceItem[]>([])
  const [loadingPieces, setLoadingPieces] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modales d'actions
  const [actionType, setActionType] = useState<'VALIDATE' | 'RETURN' | 'REJECT' | null>(null)
  const [commentaire, setCommentaire] = useState('')
  const [derogationCapacite, setDerogationCapacite] = useState(false)

  // Charger les pièces
  const loadPieces = async () => {
    if (!dossier) return
    setLoadingPieces(true)
    try {
      const res = await fetchApi(`/api/v2/eleve-onboarding/${dossier.id}/pieces`)
      const data = await res.json()
      if (data.success && data.data?.documents) {
        setPieces(data.data.documents)
      }
    } catch {
      // silencieux
    } finally {
      setLoadingPieces(false)
    }
  }

  useEffect(() => {
    if (isOpen && dossier) {
      loadPieces()
      setActionType(null)
      setCommentaire('')
      setError(null)
    }
  }, [isOpen, dossier?.id])

  if (!isOpen || !dossier) return null

  const handleValider = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetchApi(`/api/v2/eleve-onboarding/${dossier.id}/inscrire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          derogationCapacite,
          motifDerogation: derogationCapacite ? commentaire : undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onActionComplete()
        onClose()
      } else {
        setError(data.message || 'Échec de la validation')
      }
    } catch {
      setError('Erreur réseau lors de la validation')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRenvoyer = async () => {
    if (!commentaire.trim()) {
      setError('Le commentaire de renvoi est obligatoire pour guider la famille.')
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetchApi(`/api/v2/eleve-onboarding/${dossier.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentaire }),
      })
      const data = await res.json()
      if (data.success) {
        onActionComplete()
        onClose()
      } else {
        setError(data.message || 'Échec du renvoi')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejeter = async () => {
    if (!commentaire.trim()) {
      setError('Le motif de rejet est obligatoire.')
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetchApi(`/api/v2/eleve-onboarding/${dossier.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: commentaire }),
      })
      const data = await res.json()
      if (data.success) {
        onActionComplete()
        onClose()
      } else {
        setError(data.message || 'Échec du rejet')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--surface, #fff)',
          height: '100%',
          boxShadow: '-4px 0 25px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Entête du tiroir */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface2, #f9fafb)',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #111827)' }}>
              Revue du dossier
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3, #9ca3af)' }}>
              ID : {dossier.id.slice(0, 10)}... • Statut : <strong>{dossier.status}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps du tiroir */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
          {error && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                color: 'var(--red, #ef4444)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={15} />
              {error}
            </div>
          )}

          {/* Fiche identité élève */}
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'var(--bg2, rgba(0,0,0,0.03))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #111827)' }}>
                {dossier.nomProvisoire}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2, #4b5563)', marginTop: 2 }}>
                Classe : <strong>{dossier.classe?.name || 'Non affectée'}</strong>
              </div>
              {dossier.numeroInterne && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue, #2563eb)', marginTop: 2 }}>
                  N° Interne : {dossier.numeroInterne}
                </div>
              )}
            </div>

            <EnrollmentCompletenessRing
              score={dossier.completenessScore ?? 0}
              validableSousReserve={dossier.validableSousReserve}
              size="md"
            />
          </div>

          {/* Section Pièces justificatives */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                Pièces justificatives requises
              </span>
              <button
                type="button"
                onClick={loadPieces}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 11,
                  color: 'var(--blue, #2563eb)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Actualiser
              </button>
            </div>

            {loadingPieces ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)' }}>
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : (
              <EnrollmentPieceChecklist
                onboardingId={dossier.id}
                pieces={pieces}
                sourceType={dossier.sourceType}
                onPieceUpdated={() => {
                  loadPieces()
                  onActionComplete()
                }}
              />
            )}
          </div>

          {/* Contacts & Dispositifs */}
          <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Smartphone size={14} />
              Contacts & Profil d&apos;accès
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>Parent : {dossier.parentContactTelephone || dossier.contactTelephone || 'Non renseigné'}</div>
              <div>Élève : {dossier.contactTelephone || 'Sans numéro propre'}</div>
              <div>Smartphone élève : {dossier.eleveADispositif ? 'Oui' : 'Non (mode protégé / NO_LOGIN)'}</div>
            </div>
          </div>

          {/* État des frais en lecture seule (Secrétariat) */}
          {dossier.createdStudentId && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                État des frais scolaires
              </div>
              <StudentFeesStatusBadge studentId={dossier.createdStudentId} />
            </div>
          )}

          {/* Téléchargement PDF */}
          <a
            href={`/api/v2/eleve-onboarding/${dossier.id}/fiche-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              background: 'var(--surface, #fff)',
              color: 'var(--text, #111827)',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Download size={15} />
            Télécharger la fiche officielle (avec QR code)
          </a>

          {/* Formulaire de confirmation d'action */}
          {actionType && (
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                border: '1px solid var(--border, #e5e7eb)',
                background: 'var(--surface2, #f9fafb)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {actionType === 'VALIDATE' && 'Confirmer la validation & inscription'}
                {actionType === 'RETURN' && 'Renvoyer le dossier à la famille'}
                {actionType === 'REJECT' && 'Rejeter définitivement la demande'}
              </div>

              {actionType === 'VALIDATE' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={derogationCapacite}
                    onChange={(e) => setDerogationCapacite(e.target.checked)}
                  />
                  Forcer l&apos;inscription sous dérogation de capacité
                </label>
              )}

              {(actionType === 'RETURN' || actionType === 'REJECT' || derogationCapacite) && (
                <textarea
                  rows={3}
                  placeholder={
                    actionType === 'RETURN'
                      ? 'Commentaire précisant les pièces ou informations manquantes...'
                      : 'Motif justifié...'
                  }
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #e5e7eb)',
                    fontSize: 12,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #e5e7eb)',
                    background: 'transparent',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={
                    actionType === 'VALIDATE'
                      ? handleValider
                      : actionType === 'RETURN'
                      ? handleRenvoyer
                      : handleRejeter
                  }
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background:
                      actionType === 'VALIDATE'
                        ? 'var(--green, #16a34a)'
                        : actionType === 'RETURN'
                        ? '#d97706'
                        : 'var(--red, #ef4444)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {actionLoading && <Loader2 size={13} className="animate-spin" />}
                  Confirmer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Barre d'action permanente bas pour ADMIN */}
        {isAdmin && !actionType && dossier.status !== 'ACTIVATED' && (
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border, #e5e7eb)',
              background: 'var(--surface2, #f9fafb)',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              onClick={() => setActionType('REJECT')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #e5e7eb)',
                background: 'transparent',
                color: 'var(--red, #ef4444)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <XCircle size={14} />
              Rejeter
            </button>

            <button
              type="button"
              onClick={() => setActionType('RETURN')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d97706',
                background: 'rgba(217,119,6,0.08)',
                color: '#b45309',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <RotateCcw size={14} />
              Renvoyer
            </button>

            <button
              type="button"
              onClick={() => setActionType('VALIDATE')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--green, #16a34a)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CheckCircle2 size={14} />
              Inscrire l&apos;élève
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
