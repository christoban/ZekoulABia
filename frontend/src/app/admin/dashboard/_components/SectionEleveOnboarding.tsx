'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  FileCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  XCircle,
  Download,
  Eye,
  Loader2,
  Info,
  Clock,
  Archive,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import EnrollmentCompletenessRing from '@/components/enrollment/EnrollmentCompletenessRing'
import ValidationDrawer, { type DrawerDossier } from '@/components/enrollment/ValidationDrawer'
import BulkValidationBar from '@/components/enrollment/BulkValidationBar'
import type { AdminSection } from '../_types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: AdminSection) => void
}

interface Dossier extends DrawerDossier {
  createdAt: string
  matchScore: number | null
}

type TabType = 'A_VALIDER' | 'RENVOYES' | 'REFUSES' | 'HISTORIQUE'

const STATUT_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'var(--bg2, #f3f4f6)', color: 'var(--text2, #4b5563)', label: 'Brouillon' },
  LINK_SENT: { bg: 'var(--blue-light)', color: 'var(--blue)', label: 'Chez la famille' },
  SUBMITTED: { bg: 'var(--amber-light)', color: 'var(--amber)', label: 'Soumis à la direction' },
  RETURNED: { bg: 'var(--amber-light)', color: 'var(--amber)', label: 'À compléter' },
  VALIDATED: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green, #16a34a)', label: 'Inscrit' },
  ACTIVATED: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green, #16a34a)', label: 'Inscrit' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red, #ef4444)', label: 'Refusé' },
  EXPIRED: { bg: 'var(--bg2, #f3f4f6)', color: 'var(--text3, #9ca3af)', label: 'Expiré' },
}

const SOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CONCOURS: { label: 'Concours', color: 'var(--green)', bg: 'var(--green-light)' },
  AUTOSERVICE: { label: 'Hors concours', color: 'var(--blue)', bg: 'var(--blue-light)' },
  HORS_CONCOURS: { label: 'Hors concours', color: 'var(--blue)', bg: 'var(--blue-light)' },
  TRANSFERT: { label: 'Transfert', color: 'var(--purple)', bg: 'var(--purple-light)' },
  IMPORT_MASSE: { label: 'Import', color: 'var(--amber)', bg: 'var(--amber-light)' },
  DIRECT: { label: 'Hors concours', color: 'var(--blue)', bg: 'var(--blue-light)' },
}

export default function SectionEleveOnboarding({ onToast, onNav }: Props) {
  const t = useT('admin')
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('A_VALIDER')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerDossier, setDrawerDossier] = useState<Dossier | null>(null)

  const chargerDossiers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/eleve-onboarding', { credentials: 'include' })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setDossiers(data.data)
      }
    } catch {
      onToast('Erreur lors du chargement des dossiers', 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    chargerDossiers()
  }, [chargerDossiers])

  // Filtrage selon l'onglet actif
  const countAValider = dossiers.filter((d) => d.status === 'SUBMITTED').length
  const countRenvoyes = dossiers.filter((d) => d.status === 'RETURNED').length
  const countRefuses = dossiers.filter((d) => d.status === 'REJECTED').length
  const countHistorique = dossiers.filter((d) => d.status === 'ACTIVATED' || d.status === 'VALIDATED').length

  const dossiersParOnglet = dossiers.filter((d) => {
    switch (activeTab) {
      case 'A_VALIDER':
        return d.status === 'SUBMITTED'
      case 'RENVOYES':
        return d.status === 'RETURNED'
      case 'REFUSES':
        return d.status === 'REJECTED'
      case 'HISTORIQUE':
        return d.status === 'ACTIVATED' || d.status === 'VALIDATED'
      default:
        return true
    }
  })

  // Filtrage local par recherche
  const dossiersFiltres = dossiersParOnglet.filter((d) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      d.nomProvisoire.toLowerCase().includes(term) ||
      (d.numeroInterne && d.numeroInterne.toLowerCase().includes(term)) ||
      (d.classe?.name && d.classe.name.toLowerCase().includes(term))
    )
  })

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const handleSelectAllSubmitted = () => {
    const submittedIds = dossiersFiltres
      .filter((d) => d.status === 'SUBMITTED')
      .map((d) => d.id)
    setSelectedIds(submittedIds)
  }

  const handleDownloadPdf = (id: string) => {
    window.open(`/api/v2/eleve-onboarding/${id}/fiche-pdf`, '_blank')
  }

  const getEmptyStateMessage = () => {
    if (search.trim()) {
      return 'Aucun dossier ne correspond à votre recherche.'
    }
    switch (activeTab) {
      case 'A_VALIDER':
        return 'Aucun dossier à valider. Tout est à jour.'
      case 'RENVOYES':
        return 'Aucun dossier renvoyé au secrétariat.'
      case 'REFUSES':
        return 'Aucun dossier refusé.'
      case 'HISTORIQUE':
        return 'Aucun dossier dans l’historique.'
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* En-tête officiel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text, #111827)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <FileCheck size={24} style={{ color: 'var(--green, #16a34a)' }} />
            Validation des inscriptions
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text2, #4b5563)' }}>
            Examinez les dossiers hors concours soumis par le secrétariat, contrôlez les pièces et confirmez les inscriptions.
          </p>
        </div>

        <button
          type="button"
          onClick={chargerDossiers}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            background: 'var(--surface, #fff)',
            color: 'var(--text, #111827)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Actualiser
        </button>
      </div>

      {/* Bandeau d'information et de gouvernance */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 10,
           background: 'var(--blue-light)',
           border: '1px solid var(--blue)',

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
           <Info size={18} style={{ color: 'var(--blue)', flexShrink: 0 }} />

          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
            Les inscriptions sont préparées par le secrétariat. Vous validez chaque dossier hors concours.
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
          Les admis au concours sont inscrits sans validation supplémentaire.
        </div>
      </div>

      {/* 4 Onglets de navigation */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border, #e5e7eb)',
          paddingBottom: 2,
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => { setActiveTab('A_VALIDER'); setSelectedIds([]) }}
          style={{
            padding: '8px 16px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'A_VALIDER' ? 'var(--surface, #fff)' : 'transparent',
            borderBottom: activeTab === 'A_VALIDER' ? '2px solid var(--green, #16a34a)' : '2px solid transparent',
            color: activeTab === 'A_VALIDER' ? 'var(--green, #16a34a)' : 'var(--text2, #4b5563)',
            fontWeight: activeTab === 'A_VALIDER' ? 700 : 500,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Clock size={15} />
          <span>À valider</span>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              background: countAValider > 0 ? 'rgba(234,179,8,0.2)' : 'var(--bg2)',
              color: countAValider > 0 ? '#b45309' : 'var(--text3)',
            }}
          >
            {countAValider}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('RENVOYES'); setSelectedIds([]) }}
          style={{
            padding: '8px 16px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'RENVOYES' ? 'var(--surface, #fff)' : 'transparent',
            borderBottom: activeTab === 'RENVOYES' ? '2px solid #d97706' : '2px solid transparent',
            color: activeTab === 'RENVOYES' ? '#d97706' : 'var(--text2, #4b5563)',
            fontWeight: activeTab === 'RENVOYES' ? 700 : 500,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <RotateCcw size={15} />
          <span>Renvoyés</span>
          {countRenvoyes > 0 && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(245,158,11,0.2)',
                color: '#d97706',
              }}
            >
              {countRenvoyes}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('REFUSES'); setSelectedIds([]) }}
          style={{
            padding: '8px 16px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'REFUSES' ? 'var(--surface, #fff)' : 'transparent',
            borderBottom: activeTab === 'REFUSES' ? '2px solid var(--red, #ef4444)' : '2px solid transparent',
            color: activeTab === 'REFUSES' ? 'var(--red, #ef4444)' : 'var(--text2, #4b5563)',
            fontWeight: activeTab === 'REFUSES' ? 700 : 500,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <XCircle size={15} />
          <span>Refusés</span>
          {countRefuses > 0 && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(239,68,68,0.15)',
                color: 'var(--red, #ef4444)',
              }}
            >
              {countRefuses}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('HISTORIQUE'); setSelectedIds([]) }}
          style={{
            padding: '8px 16px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'HISTORIQUE' ? 'var(--surface, #fff)' : 'transparent',
            borderBottom: activeTab === 'HISTORIQUE' ? '2px solid var(--blue)' : '2px solid transparent',
            color: activeTab === 'HISTORIQUE' ? 'var(--blue)' : 'var(--text2, #4b5563)',
            fontWeight: activeTab === 'HISTORIQUE' ? 700 : 500,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Archive size={15} />
          <span>Historique</span>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              background: 'var(--bg2)',
              color: 'var(--text3)',
            }}
          >
            {countHistorique}
          </span>
        </button>
      </div>

      {/* Barre de filtre et recherche */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          background: 'var(--surface, #fff)',
          padding: 12,
          borderRadius: 10,
          border: '1px solid var(--border, #e5e7eb)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text3, #9ca3af)' }} />
            <input
              type="text"
              placeholder="Rechercher par élève, N° interne, classe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: 8,
                border: '1px solid var(--border, #e5e7eb)',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeTab === 'A_VALIDER' && (
            <button
              type="button"
              onClick={handleSelectAllSubmitted}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border, #e5e7eb)',
                background: 'transparent',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sélectionner les dossiers à valider
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text3, #9ca3af)' }}>
            {dossiersFiltres.length} résultat(s)
          </span>
        </div>
      </div>

      {/* Table des dossiers */}
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
            {getEmptyStateMessage()}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2, #f9fafb)', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                {activeTab === 'A_VALIDER' && (
                  <th style={{ padding: '10px 14px', width: 36 }}>
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length > 0 &&
                        selectedIds.length === dossiersFiltres.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) handleSelectAllSubmitted()
                        else setSelectedIds([])
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
                const motifDerogation = (d.submittedData as any)?.motifDerogation || (d.submittedData as any)?.motifHorsConcours

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
                          onChange={() => handleToggleSelect(d.id)}
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
                          onClick={() => handleDownloadPdf(d.id)}
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
                          onClick={() => setDrawerDossier(d)}
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

      {/* Barre de validation groupée */}
      {activeTab === 'A_VALIDER' && (
        <BulkValidationBar
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
          onSuccess={(valides, echecs) => {
            onToast(`${valides} dossier(s) validé(s)${echecs > 0 ? `, ${echecs} échec(s)` : ''}`, 'success')
            chargerDossiers()
          }}
        />
      )}

      {/* Tiroir d'examen et validation */}
      <ValidationDrawer
        dossier={drawerDossier}
        isOpen={!!drawerDossier}
        onClose={() => setDrawerDossier(null)}
        onActionComplete={() => {
          chargerDossiers()
          onToast('Dossier mis à jour avec succès', 'success')
        }}
        isAdmin={true}
      />
    </div>
  )
}
