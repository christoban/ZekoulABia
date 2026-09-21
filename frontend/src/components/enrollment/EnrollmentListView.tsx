'use client'

import React, { useState } from 'react'
import {
  Download,
  Eye,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import EnrollmentCompletenessRing from './EnrollmentCompletenessRing'
import type { KanbanDossier } from './EnrollmentKanbanBoard'

interface Props {
  dossiers: KanbanDossier[]
  onSelectDossier: (dossier: KanbanDossier) => void
  onDownloadPdf?: (id: string) => void
  onNouveauDossier?: () => void
}

const STATUT_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'var(--bg2, #f3f4f6)', color: 'var(--text2, #4b5563)', label: 'Brouillon' },
  LINK_SENT: { bg: 'rgba(59,130,246,0.1)', color: 'var(--blue, #2563eb)', label: 'Chez la famille' },
  SUBMITTED: { bg: 'rgba(234,179,8,0.15)', color: '#b45309', label: 'Soumis à la direction' },
  RETURNED: { bg: 'rgba(245,158,11,0.15)', color: '#d97706', label: 'À compléter' },
  VALIDATED: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green, #16a34a)', label: 'Inscrit' },
  ACTIVATED: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green, #16a34a)', label: 'Inscrit' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red, #ef4444)', label: 'Refusé' },
  EXPIRED: { bg: 'var(--bg2, #f3f4f6)', color: 'var(--text3, #9ca3af)', label: 'Expiré' },
}

const SOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CONCOURS: { label: 'Concours', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  AUTOSERVICE: { label: 'Hors concours', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  HORS_CONCOURS: { label: 'Hors concours', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  TRANSFERT: { label: 'Transfert', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  IMPORT_MASSE: { label: 'Import', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
}

export default function EnrollmentListView({
  dossiers,
  onSelectDossier,
  onDownloadPdf,
  onNouveauDossier,
}: Props) {
  const [recherche, setRecherche] = useState('')
  const [filtreClasse, setFiltreClasse] = useState('ALL')

  const classesDisponibles = Array.from(
    new Set(dossiers.map((d) => d.classe?.name).filter(Boolean)),
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filtres */}
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
              placeholder="Rechercher élève, N° interne..."
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

        <span style={{ fontSize: 12, color: 'var(--text3, #9ca3af)' }}>
          {dossiersFiltres.length} dossier(s)
        </span>
      </div>

      {/* Table vue liste */}
      <div
        style={{
          background: 'var(--surface, #fff)',
          borderRadius: 12,
          border: '1px solid var(--border, #e5e7eb)',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {dossiersFiltres.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            Aucun dossier trouvé.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2, #f9fafb)', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Élève</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Classe</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Source</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Complétude</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Statut</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dossiersFiltres.map((d) => {
                const statutInfo = STATUT_STYLES[d.status] || { bg: 'var(--bg2)', color: 'var(--text)', label: d.status }
                const sourceInfo = SOURCE_LABELS[d.sourceType] || { label: 'Hors concours', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' }

                return (
                  <tr
                    key={d.id}
                    style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{d.nomProvisoire}</div>
                      {d.numeroInterne && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue, #2563eb)' }}>
                          {d.numeroInterne}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>
                      {d.classe?.name || <span style={{ color: 'var(--text3)' }}>Non affectée</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: sourceInfo.bg,
                          color: sourceInfo.color,
                        }}
                      >
                        {sourceInfo.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <EnrollmentCompletenessRing
                        score={d.completenessScore ?? 0}
                        validableSousReserve={d.validableSousReserve}
                        size="sm"
                      />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: statutInfo.bg,
                          color: statutInfo.color,
                        }}
                      >
                        {statutInfo.label}
                      </span>
                      {d.returnedComment && d.status === 'RETURNED' && (
                        <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>
                          « {d.returnedComment} »
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {onDownloadPdf && (
                          <button
                            type="button"
                            onClick={() => onDownloadPdf(d.id)}
                            title="Télécharger la fiche PDF"
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--border, #e5e7eb)',
                              background: 'var(--surface)',
                              color: 'var(--text2)',
                              cursor: 'pointer',
                            }}
                          >
                            <Download size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectDossier(d)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: 'none',
                            background: 'var(--blue, #2563eb)',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Eye size={12} />
                          Ouvrir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
