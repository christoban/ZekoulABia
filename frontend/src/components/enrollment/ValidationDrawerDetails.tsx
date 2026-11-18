'use client'

import React from 'react'
import { Download, Loader2, Smartphone } from 'lucide-react'
import EnrollmentPieceChecklist, { type PieceItem } from './EnrollmentPieceChecklist'
import EnrollmentCompletenessRing from './EnrollmentCompletenessRing'
import StudentFeesStatusBadge from './StudentFeesStatusBadge'
import type { DrawerDossier } from './ValidationDrawer'

interface ValidationDrawerDetailsProps {
  dossier: DrawerDossier
  pieces: PieceItem[]
  loadingPieces: boolean
  onRefreshPieces: () => void
  onActionComplete: () => void
}

export default function ValidationDrawerDetails({
  dossier,
  pieces,
  loadingPieces,
  onRefreshPieces,
  onActionComplete,
}: ValidationDrawerDetailsProps) {
  return (
    <>
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
            onClick={onRefreshPieces}
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
              onRefreshPieces()
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
    </>
  )
}
