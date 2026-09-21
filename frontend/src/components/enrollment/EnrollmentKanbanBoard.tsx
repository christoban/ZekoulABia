'use client'

import React, { useState } from 'react'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  Search,
  ExternalLink,
  Download,
  Eye,
} from 'lucide-react'
import EnrollmentCompletenessRing from './EnrollmentCompletenessRing'

export interface KanbanDossier {
  id: string
  nomProvisoire: string
  status: string
  sourceType: string
  recipientType: string
  classId: string | null
  classe: { name: string } | null
  contactEmail: string | null
  contactTelephone: string | null
  completenessScore?: number | null
  validableSousReserve?: boolean
  returnedComment?: string | null
  numeroInterne?: string | null
  createdStudentId?: string | null
  createdAt: string
  submittedData?: {
    nom?: string
    prenom?: string
    gender?: string
  } | null
}

interface Props {
  dossiers: KanbanDossier[]
  onSelectDossier: (dossier: KanbanDossier) => void
  onDownloadPdf?: (id: string) => void
}

const COLONNES = [
  {
    id: 'DRAFT',
    titre: 'Brouillons internes',
    statuts: ['DRAFT'],
    couleur: 'var(--text2, #4b5563)',
    bg: 'var(--bg2, rgba(0,0,0,0.03))',
    icon: FileText,
  },
  {
    id: 'LINK_SENT',
    titre: 'Lien envoyé (famille)',
    statuts: ['LINK_SENT'],
    couleur: '#2563eb',
    bg: 'rgba(37,99,235,0.08)',
    icon: ExternalLink,
  },
  {
    id: 'SUBMITTED',
    titre: 'Soumis pour validation',
    statuts: ['SUBMITTED'],
    couleur: '#b45309',
    bg: 'rgba(245,158,11,0.06)',
    icon: Clock,
  },
  {
    id: 'RETURNED',
    titre: 'À compléter (Renvoyés)',
    statuts: ['RETURNED'],
    couleur: '#d97706',
    bg: 'rgba(217,119,6,0.08)',
    icon: RotateCcw,
  },
  {
    id: 'ACTIVATED',
    titre: 'Validés & Inscrits',
    statuts: ['ACTIVATED', 'VALIDATED'],
    couleur: 'var(--green, #16a34a)',
    bg: 'rgba(22,163,74,0.06)',
    icon: CheckCircle2,
  },
  {
    id: 'REJECTED',
    titre: 'Rejetés & Expirés',
    statuts: ['REJECTED', 'EXPIRED'],
    couleur: '#dc2626',
    bg: 'rgba(220,38,38,0.08)',
    icon: AlertTriangle,
  },
]

export default function EnrollmentKanbanBoard({
  dossiers,
  onSelectDossier,
  onDownloadPdf,
}: Props) {
  const [recherche, setRecherche] = useState('')
  const [filtreClasse, setFiltreClasse] = useState('ALL')

  const classesDisponibles = Array.from(
    new Set(dossiers.map(d => d.classe?.name).filter(Boolean)),
  )

  const dossiersFiltres = dossiers.filter((d) => {
    const matchTerm =
      recherche === '' ||
      d.nomProvisoire.toLowerCase().includes(recherche.toLowerCase()) ||
      (d.numeroInterne && d.numeroInterne.toLowerCase().includes(recherche.toLowerCase()))
    const matchClasse = filtreClasse === 'ALL' || d.classe?.name === filtreClasse
    return matchTerm && matchClasse
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barre de filtre & recherche */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 10,
                color: 'var(--text3, #9ca3af)',
              }}
            />
            <input
              type="text"
              placeholder="Rechercher par élève ou N° interne..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: 8,
                border: '1px solid var(--border, #e5e7eb)',
                background: 'var(--surface, #fff)',
                color: 'var(--text, #111827)',
                fontSize: 13,
              }}
            />
          </div>

          <select
            value={filtreClasse}
            onChange={(e) => setFiltreClasse(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              background: 'var(--surface, #fff)',
              color: 'var(--text, #111827)',
              fontSize: 13,
            }}
          >
            <option value="ALL">Toutes les classes</option>
            {classesDisponibles.map((cl) => (
              <option key={cl} value={cl!}>
                {cl}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text2, #4b5563)', fontWeight: 600 }}>
          {dossiersFiltres.length} dossier(s)
        </div>
      </div>

      {/* Colonnes Kanban */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {COLONNES.map((col) => {
          const items = dossiersFiltres.filter((d) => col.statuts.includes(d.status))
          return (
            <div
              key={col.id}
              style={{
                background: 'var(--surface2, #f9fafb)',
                borderRadius: 12,
                border: '1px solid var(--border, #e5e7eb)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 280,
              }}
            >
              {/* Entête colonne */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--border, #e5e7eb)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <col.icon size={14} style={{ color: col.couleur }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: col.couleur }}>
                    {col.titre}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: col.bg,
                    color: col.couleur,
                  }}
                >
                  {items.length}
                </span>
              </div>

              {/* Cartes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {items.length === 0 ? (
                  <div
                    style={{
                      padding: '28px 12px',
                      textAlign: 'center',
                      fontSize: 12,
                      color: 'var(--text3, #9ca3af)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      borderRadius: 8,
                      border: '1px dashed var(--border, #e5e7eb)',
                      background: 'rgba(0,0,0,0.01)',
                    }}
                  >
                    <col.icon size={18} style={{ opacity: 0.4 }} />
                    <span>Aucun dossier {col.titre.toLowerCase()}</span>
                  </div>
                ) : (
                  items.map((dossier) => (
                    <div
                      key={dossier.id}
                      onClick={() => onSelectDossier(dossier)}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: 'var(--surface, #fff)',
                        border: '1px solid var(--border, #e5e7eb)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--text, #111827)',
                            }}
                          >
                            {dossier.nomProvisoire}
                          </div>
                          {dossier.numeroInterne && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--blue, #2563eb)',
                                marginTop: 1,
                              }}
                            >
                              {dossier.numeroInterne}
                            </div>
                          )}
                        </div>

                        <EnrollmentCompletenessRing
                          score={dossier.completenessScore ?? 0}
                          validableSousReserve={dossier.validableSousReserve}
                          size="sm"
                          showLabel={false}
                        />
                      </div>

                      {/* Classe & source */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11,
                          color: 'var(--text2, #4b5563)',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            background: 'var(--bg2, rgba(0,0,0,0.04))',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          {dossier.classe?.name || 'Sans classe'}
                        </span>
                        <span>•</span>
                        <span>{dossier.sourceType}</span>
                      </div>

                      {/* Commentaire de retour si retourné */}
                      {dossier.status === 'RETURNED' && dossier.returnedComment && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#b45309',
                            background: 'rgba(245,158,11,0.1)',
                            padding: '5px 8px',
                            borderRadius: 6,
                            borderLeft: '3px solid #d97706',
                          }}
                        >
                          {dossier.returnedComment}
                        </div>
                      )}

                      {/* Actions rapides */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 6,
                          paddingTop: 6,
                          borderTop: '1px solid var(--border, #f3f4f6)',
                        }}
                      >
                        {onDownloadPdf && (
                          <button
                            type="button"
                            title="Télécharger la fiche d'inscription PDF"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDownloadPdf(dossier.id)
                            }}
                            style={{
                              padding: 4,
                              borderRadius: 6,
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text3, #9ca3af)',
                              cursor: 'pointer',
                            }}
                          >
                            <Download size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          title="Examiner le dossier"
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border, #e5e7eb)',
                            background: 'transparent',
                            color: 'var(--text2, #4b5563)',
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Eye size={12} />
                          Ouvrir
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
