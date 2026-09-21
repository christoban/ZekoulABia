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
  Plus,
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
  onNouveauDossier?: () => void
}

// 5 colonnes strictes selon blueprint §3.3
const COLONNES = [
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

export default function EnrollmentKanbanBoard({
  dossiers,
  onSelectDossier,
  onDownloadPdf,
  onNouveauDossier,
}: Props) {
  const [recherche, setRecherche] = useState('')
  const [filtreClasse, setFiltreClasse] = useState('ALL')
  const [filtrePuce, setFiltrePuce] = useState<'TOUS' | 'CONCOURS' | 'REJECTED' | 'EXPIRED'>('TOUS')

  const countConcours = dossiers.filter((d) => d.sourceType === 'CONCOURS').length
  const countRefuses = dossiers.filter((d) => d.status === 'REJECTED').length
  const countExpires = dossiers.filter((d) => d.status === 'EXPIRED').length

  const classesDisponibles = Array.from(
    new Set(dossiers.map((d) => d.classe?.name).filter(Boolean)),
  )

  const dossiersFiltres = dossiers.filter((d) => {
    const matchTerm =
      recherche === '' ||
      d.nomProvisoire.toLowerCase().includes(recherche.toLowerCase()) ||
      (d.numeroInterne && d.numeroInterne.toLowerCase().includes(recherche.toLowerCase()))
    const matchClasse = filtreClasse === 'ALL' || d.classe?.name === filtreClasse

    let matchPuce = true
    if (filtrePuce === 'CONCOURS') matchPuce = d.sourceType === 'CONCOURS'
    else if (filtrePuce === 'REJECTED') matchPuce = d.status === 'REJECTED'
    else if (filtrePuce === 'EXPIRED') matchPuce = d.status === 'EXPIRED'

    return matchTerm && matchClasse && matchPuce
  })

  // Tri pour les brouillons : dossiers concours en premier
  const trierDossiers = (list: KanbanDossier[]) => {
    return [...list].sort((a, b) => {
      if (a.sourceType === 'CONCOURS' && b.sourceType !== 'CONCOURS') return -1
      if (b.sourceType === 'CONCOURS' && a.sourceType !== 'CONCOURS') return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Barre de filtre & recherche */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          background: 'var(--surface, #fff)',
          padding: 10,
          borderRadius: 10,
          border: '1px solid var(--border, #e5e7eb)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text3, #9ca3af)' }} />
            <input
              type="text"
              placeholder="Rechercher par nom, N° interne..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                borderRadius: 8,
                border: '1px solid var(--border, #e5e7eb)',
                fontSize: 12,
              }}
            />
          </div>

          <select
            value={filtreClasse}
            onChange={(e) => setFiltreClasse(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              fontSize: 12,
              background: 'var(--surface, #fff)',
            }}
          >
            <option value="ALL">Toutes les classes</option>
            {classesDisponibles.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Puces de filtre rapide */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFiltrePuce('TOUS')}
            style={{
              padding: '4px 10px',
              borderRadius: 16,
              border: filtrePuce === 'TOUS' ? '1px solid var(--blue, #2563eb)' : '1px solid var(--border, #e5e7eb)',
              background: filtrePuce === 'TOUS' ? 'rgba(37,99,235,0.08)' : 'transparent',
              color: filtrePuce === 'TOUS' ? 'var(--blue, #2563eb)' : 'var(--text2, #4b5563)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Tous ({dossiers.length})
          </button>

          {countConcours > 0 && (
            <button
              type="button"
              onClick={() => setFiltrePuce('CONCOURS')}
              style={{
                padding: '4px 10px',
                borderRadius: 16,
                border: filtrePuce === 'CONCOURS' ? '1px solid var(--green, #16a34a)' : '1px solid var(--border, #e5e7eb)',
                background: filtrePuce === 'CONCOURS' ? 'rgba(22,163,74,0.08)' : 'transparent',
                color: filtrePuce === 'CONCOURS' ? 'var(--green, #16a34a)' : 'var(--text2, #4b5563)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Admis à finaliser ({countConcours})
            </button>
          )}

          {countRefuses > 0 && (
            <button
              type="button"
              onClick={() => setFiltrePuce('REJECTED')}
              style={{
                padding: '4px 10px',
                borderRadius: 16,
                border: filtrePuce === 'REJECTED' ? '1px solid var(--red, #ef4444)' : '1px solid var(--border, #e5e7eb)',
                background: filtrePuce === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'transparent',
                color: filtrePuce === 'REJECTED' ? 'var(--red, #ef4444)' : 'var(--text2, #4b5563)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Refusés ({countRefuses})
            </button>
          )}

          {countExpires > 0 && (
            <button
              type="button"
              onClick={() => setFiltrePuce('EXPIRED')}
              style={{
                padding: '4px 10px',
                borderRadius: 16,
                border: filtrePuce === 'EXPIRED' ? '1px solid var(--text3)' : '1px solid var(--border, #e5e7eb)',
                background: filtrePuce === 'EXPIRED' ? 'var(--bg2)' : 'transparent',
                color: 'var(--text3)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Expirés ({countExpires})
            </button>
          )}
        </div>
      </div>

      {/* Grille Kanban à 5 colonnes strictes (min 260px) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(240px, 1fr))',
          gap: 14,
          overflowX: 'auto',
          paddingBottom: 12,
        }}
      >
        {COLONNES.map((col) => {
          const dossiersColonne = trierDossiers(
            dossiersFiltres.filter((d) => col.statuts.includes(d.status)),
          )
          const ColIcon = col.icon

          return (
            <div
              key={col.id}
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
                  {dossiersColonne.length}
                </span>
              </div>

              {/* Liste de cartes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {dossiersColonne.length === 0 ? (
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
                  dossiersColonne.map((d) => {
                    const sourceInfo = SOURCE_LABELS[d.sourceType] || { label: 'Hors concours', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' }

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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--border2, #f3f4f6)', fontSize: 11, color: 'var(--text3, #9ca3af)' }}>
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
        })}
      </div>
    </div>
  )
}
