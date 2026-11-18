'use client'

import React from 'react'
import {
  Clock,
  CheckCircle2,
  RotateCcw,
  FileText,
  ExternalLink,
  Download,
  Plus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import EnrollmentCompletenessRing from './EnrollmentCompletenessRing'
import type { KanbanDossier } from './EnrollmentKanbanBoard'

export interface KanbanColumnDef {
  id: string
  titre: string
  statuts: string[]
  couleur: string
  bg: string
  icon: LucideIcon
  emptyMessage: string
}

// 5 colonnes strictes selon blueprint §3.3
export const KANBAN_COLONNES: KanbanColumnDef[] = [
  {
    id: 'DRAFT',
    titre: 'Brouillons',
    statuts: ['DRAFT'],
    couleur: 'var(--text2, #4b5563)',
    bg: 'var(--bg2, rgba(0,0,0,0.03))',
    icon: FileText,
    emptyMessage: 'Aucun brouillon',
  },
  {
    id: 'LINK_SENT',
    titre: 'Chez la famille',
    statuts: ['LINK_SENT'],
    couleur: '#2563eb',
    bg: 'rgba(37,99,235,0.08)',
    icon: ExternalLink,
    emptyMessage: 'Aucun dossier chez la famille',
  },
  {
    id: 'SUBMITTED',
    titre: 'Soumis à la direction',
    statuts: ['SUBMITTED'],
    couleur: '#b45309',
    bg: 'rgba(245,158,11,0.06)',
    icon: Clock,
    emptyMessage: 'Aucun dossier en attente',
  },
  {
    id: 'RETURNED',
    titre: 'À compléter',
    statuts: ['RETURNED'],
    couleur: '#d97706',
    bg: 'rgba(217,119,6,0.08)',
    icon: RotateCcw,
    emptyMessage: 'Aucun dossier à compléter',
  },
  {
    id: 'ACTIVATED',
    titre: 'Inscrits',
    statuts: ['ACTIVATED', 'VALIDATED'],
    couleur: 'var(--green, #16a34a)',
    bg: 'rgba(22,163,74,0.06)',
    icon: CheckCircle2,
    emptyMessage: 'Aucun élève inscrit',
  },
]

const SOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CONCOURS: { label: 'Concours', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  AUTOSERVICE: { label: 'Hors concours', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  HORS_CONCOURS: { label: 'Hors concours', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  TRANSFERT: { label: 'Transfert', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  IMPORT_MASSE: { label: 'Import', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
}

interface EnrollmentKanbanColumnProps {
  col: KanbanColumnDef
  dossiers: KanbanDossier[]
  onSelectDossier: (dossier: KanbanDossier) => void
  onDownloadPdf?: (id: string) => void
  onNouveauDossier?: () => void
}

export default function EnrollmentKanbanColumn({
  col,
  dossiers,
  onSelectDossier,
  onDownloadPdf,
  onNouveauDossier,
}: EnrollmentKanbanColumnProps) {
  const ColIcon = col.icon

  return (
    <div
      style={{
        background: 'var(--surface2, #f9fafb)',
        borderRadius: 12,
        border: '1px solid var(--border, #e5e7eb)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 480,
        padding: 10,
      }}
    >
      {/* En-tête colonne */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px 10px 8px',
          borderBottom: '1px solid var(--border, #e5e7eb)',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ColIcon size={15} style={{ color: col.couleur }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111827)' }}>
            {col.titre}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 10,
            background: col.bg,
            color: col.couleur,
          }}
        >
          {dossiers.length}
        </span>
      </div>

      {/* Liste de cartes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {dossiers.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text3, #9ca3af)',
              fontSize: 12,
              textAlign: 'center',
              padding: '20px 10px',
              gap: 8,
            }}
          >
            <span>{col.emptyMessage}</span>
            {col.id === 'DRAFT' && onNouveauDossier && (
              <button
                type="button"
                onClick={onNouveauDossier}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--blue, #2563eb)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Plus size={12} /> Nouveau dossier
              </button>
            )}
          </div>
        ) : (
          dossiers.map((d) => {
            const sourceInfo = SOURCE_LABELS[d.sourceType] || {
              label: 'Hors concours',
              color: '#2563eb',
              bg: 'rgba(37,99,235,0.1)',
            }

            return (
              <div
                key={d.id}
                onClick={() => onSelectDossier(d)}
                style={{
                  background: 'var(--surface, #fff)',
                  borderRadius: 10,
                  padding: 12,
                  border: '1px solid var(--border, #e5e7eb)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {/* Haut de carte : Nom et Anneau */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text, #111827)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {d.nomProvisoire}
                    </div>
                    {d.numeroInterne && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue, #2563eb)' }}>
                        {d.numeroInterne}
                      </div>
                    )}
                  </div>
                  <EnrollmentCompletenessRing
                    score={d.completenessScore ?? 0}
                    validableSousReserve={d.validableSousReserve}
                    size="sm"
                  />
                </div>

                {/* Classe & Source */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text2, #4b5563)', fontWeight: 600 }}>
                    {d.classe?.name || 'Non affectée'}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: sourceInfo.bg,
                      color: sourceInfo.color,
                    }}
                  >
                    {sourceInfo.label}
                  </span>
                </div>

                {/* Commentaire de la direction si renvoyé */}
                {d.status === 'RETURNED' && d.returnedComment && (
                  <div
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      fontSize: 11,
                      color: '#b45309',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    « {d.returnedComment} »
                  </div>
                )}

                {/* Pied de carte : Date & Action PDF */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 4,
                    borderTop: '1px solid var(--border2, #f3f4f6)',
                    fontSize: 11,
                    color: 'var(--text3, #9ca3af)',
                  }}
                >
                  <span>{new Date(d.createdAt).toLocaleDateString('fr-FR')}</span>
                  {onDownloadPdf && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDownloadPdf(d.id)
                      }}
                      title="Télécharger la fiche PDF"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text3)',
                        cursor: 'pointer',
                        padding: 2,
                      }}
                    >
                      <Download size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
