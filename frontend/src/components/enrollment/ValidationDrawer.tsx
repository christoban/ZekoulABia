'use client'

import React, { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type { PieceItem } from './EnrollmentPieceChecklist'
import ValidationDrawerDetails from './ValidationDrawerDetails'
import {
  type DrawerActionType,
  executerValidationAction,
  ValidationDrawerActionForm,
  ValidationDrawerFooterBar,
} from './ValidationDrawerActions'

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
  submittedData?: Record<string, unknown> | null
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
  const [actionType, setActionType] = useState<DrawerActionType | null>(null)
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

  const handleConfirmAction = async () => {
    if (!actionType) return
    setActionLoading(true)
    setError(null)
    const result = await executerValidationAction({
      dossierId: dossier.id,
      actionType,
      commentaire,
      derogationCapacite,
    })
    setActionLoading(false)
    if (result.ok) {
      onActionComplete()
      onClose()
    } else {
      setError(result.error)
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

          <ValidationDrawerDetails
            dossier={dossier}
            pieces={pieces}
            loadingPieces={loadingPieces}
            onRefreshPieces={loadPieces}
            onActionComplete={onActionComplete}
          />

          {/* Formulaire de confirmation d'action */}
          {actionType && (
            <ValidationDrawerActionForm
              actionType={actionType}
              commentaire={commentaire}
              derogationCapacite={derogationCapacite}
              actionLoading={actionLoading}
              onCommentaireChange={setCommentaire}
              onDerogationChange={setDerogationCapacite}
              onCancel={() => setActionType(null)}
              onConfirm={handleConfirmAction}
            />
          )}
        </div>

        {/* Barre d'action permanente bas pour ADMIN */}
        {isAdmin && !actionType && dossier.status !== 'ACTIVATED' && (
          <ValidationDrawerFooterBar onSelectAction={setActionType} />
        )}
      </div>
    </div>
  )
}
