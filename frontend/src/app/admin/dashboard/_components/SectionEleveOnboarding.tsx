'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  XCircle,
  Download,
  PlusCircle,
  Eye,
  Send,
  Loader2,
  FileCheck,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'
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

const STATUT_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'var(--bg2, #f3f4f6)', color: 'var(--text2, #4b5563)', label: 'Brouillon' },
  LINK_SENT: { bg: 'rgba(59,130,246,0.1)', color: 'var(--blue, #2563eb)', label: 'Lien envoyé' },
  SUBMITTED: { bg: 'rgba(234,179,8,0.15)', color: '#b45309', label: 'En attente' },
  RETURNED: { bg: 'rgba(245,158,11,0.15)', color: '#d97706', label: 'À compléter' },
  VALIDATED: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green, #16a34a)', label: 'Validé' },
  ACTIVATED: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green, #16a34a)', label: 'Inscrit' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red, #ef4444)', label: 'Rejeté' },
  EXPIRED: { bg: 'var(--bg2, #f3f4f6)', color: 'var(--text3, #9ca3af)', label: 'Expiré' },
}

export default function SectionEleveOnboarding({ onToast, onNav }: Props) {
  const t = useT('admin')
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  // Sélection multiple pour validation par lot
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Tiroir de validation
  const [drawerDossier, setDrawerDossier] = useState<Dossier | null>(null)

  const chargerDossiers = useCallback(async () => {
    setLoading(true)
    try {
      const url = statusFilter
        ? `/api/v2/eleve-onboarding?status=${statusFilter}`
        : '/api/v2/eleve-onboarding'
      const res = await fetchApi(url, { credentials: 'include' })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setDossiers(data.data)
      }
    } catch {
      onToast('Erreur lors du chargement des dossiers', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, onToast])

  useEffect(() => {
    chargerDossiers()
  }, [chargerDossiers])

  // Filtrage local par terme de recherche
  const dossiersFiltres = dossiers.filter((d) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      d.nomProvisoire.toLowerCase().includes(term) ||
      (d.numeroInterne && d.numeroInterne.toLowerCase().includes(term)) ||
      (d.classe?.name && d.classe.name.toLowerCase().includes(term))
    )
  })

  // Gestion de la sélection par lot
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

  // Téléchargement PDF
  const handleDownloadPdf = (id: string) => {
    window.open(`/api/v2/eleve-onboarding/${id}/fiche-pdf`, '_blank')
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Bannière de supervision */}
      <DelegationSupervisionBanner domainLabel="Inscriptions & Admissions" onNav={onNav} />

      {/* En-tête */}
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
            File de Validation des Inscriptions (Dossier v2)
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text2, #4b5563)' }}>
            Examinez les dossiers d&apos;inscription soumis, contrôlez les pièces et accordez les admissions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
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
              placeholder="Rechercher élève, N° interne, classe..."
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              fontSize: 13,
              background: 'var(--surface, #fff)',
            }}
          >
            <option value="">Tous les statuts</option>
            <option value="SUBMITTED">Soumis (en attente)</option>
            <option value="RETURNED">À compléter (renvoyé)</option>
            <option value="ACTIVATED">Inscrit</option>
            <option value="DRAFT">Brouillon</option>
            <option value="REJECTED">Rejeté</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            Sélectionner les dossiers soumis
          </button>
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
            Aucun dossier ne correspond à votre recherche.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2, #f9fafb)', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                <th style={{ padding: '10px 14px', width: 36 }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length > 0 &&
                      selectedIds.length === dossiersFiltres.filter((d) => d.status === 'SUBMITTED').length
                    }
                    onChange={(e) => {
                      if (e.target.checked) handleSelectAllSubmitted()
                      else setSelectedIds([])
                    }}
                  />
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Élève</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Classe</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Complétude</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>Statut</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dossiersFiltres.map((d) => {
                const isSelected = selectedIds.includes(d.id)
                const statutInfo = STATUT_STYLES[d.status] || { bg: 'var(--bg2)', color: 'var(--text)', label: d.status }
                return (
                  <tr
                    key={d.id}
                    style={{
                      borderBottom: '1px solid var(--border, #f3f4f6)',
                      background: isSelected ? 'rgba(59,130,246,0.04)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(d.id)}
                      />
                    </td>
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

      {/* Barre de validation groupée flottante */}
      <BulkValidationBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onSuccess={(valides, echecs) => {
          onToast(`${valides} dossier(s) validé(s)${echecs > 0 ? `, ${echecs} échec(s)` : ''}`, 'success')
          chargerDossiers()
        }}
      />

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
