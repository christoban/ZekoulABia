'use client'

import React from 'react'
import { Download, Eye, Loader2 } from 'lucide-react'
import EnrollmentCompletenessRing from '@/components/enrollment/EnrollmentCompletenessRing'
import { STATUT_STYLES, SOURCE_LABELS, type Dossier, type TabType } from './types'

interface OnboardingDossiersTableProps {
  loading: boolean
  activeTab: TabType
  dossiersFiltres: Dossier[]
  selectedIds: string[]
  emptyStateMessage: string
  onSelectAllSubmitted: () => void
  onClearSelection: () => void
  onToggleSelect: (id: string) => void
  onDownloadPdf: (id: string) => void
  onExamine: (dossier: Dossier) => void
}

export default function OnboardingDossiersTable({
  loading,
  activeTab,
  dossiersFiltres,
  selectedIds,
  emptyStateMessage,
  onSelectAllSubmitted,
  onClearSelection,
  onToggleSelect,
  onDownloadPdf,
  onExamine,
}: OnboardingDossiersTableProps) {
  return (
    <div
      style={{
        background: 'var(--surface, #fff)',
        borderRadius: 12,
        border: '1px solid var(--border, #e5e7eb)',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
          Chargement de la file de validation...
        </div>
      ) : dossiersFiltres.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          {emptyStateMessage}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2, #f9fafb)', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
              {activeTab === 'A_VALIDER' && (
                <th style={{ padding: '10px 14px', width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === dossiersFiltres.length}
                    onChange={(e) => {
                      if (e.target.checked) onSelectAllSubmitted()
                      else onClearSelection()
                    }}
                  />
                </th>
              )}
              <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Élève</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Classe demandée</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Voie & Source</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Complétude</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Statut</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {dossiersFiltres.map((d) => {
              const isSelected = selectedIds.includes(d.id)
              const statutInfo = STATUT_STYLES[d.status] || { bg: 'var(--bg2)', color: 'var(--text)', label: d.status }
              const sourceInfo = SOURCE_LABELS[d.sourceType] || { label: 'Hors concours', color: 'var(--blue)', bg: 'var(--blue-light)' }
              const sub = d.submittedData as { motifDerogation?: string; motifHorsConcours?: string } | null | undefined
              const motifDerogation = sub?.motifDerogation || sub?.motifHorsConcours

              return (
                <tr
                  key={d.id}
                  style={{
                    borderBottom: '1px solid var(--border, #f3f4f6)',
                    background: isSelected ? 'rgba(59,130,246,0.04)' : 'transparent',
                  }}
                >
                  {activeTab === 'A_VALIDER' && (
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(d.id)}
                      />
                    </td>
                  )}
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{d.nomProvisoire}</div>
                    {d.numeroInterne && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)' }}>
                        {d.numeroInterne}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>
                    {d.classe?.name || <span style={{ color: 'var(--text3)' }}>Non affectée</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: sourceInfo.bg,
                          color: sourceInfo.color,
                          alignSelf: 'flex-start',
                        }}
                      >
                        {sourceInfo.label}
                      </span>
                      {motifDerogation && (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          Motif : {motifDerogation}
                        </span>
                      )}
                    </div>
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
                    {d.returnedComment && activeTab === 'RENVOYES' && (
                      <div style={{ fontSize: 11, color: '#d97706', marginTop: 3 }}>
                        « {d.returnedComment} »
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => onDownloadPdf(d.id)}
                        title="Télécharger la fiche d'inscription PDF"
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
                      <button
                        type="button"
                        onClick={() => onExamine(d)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: 'none',
                          background: 'var(--green, #16a34a)',
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
                        Examiner
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
  )
}
