'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { FileCheck, Search, Info } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import ValidationDrawer from '@/components/enrollment/ValidationDrawer'
import BulkValidationBar from '@/components/enrollment/BulkValidationBar'
import type { AdminSection } from '../_types'
import OnboardingTabs from './eleveOnboarding/OnboardingTabs'
import OnboardingDossiersTable from './eleveOnboarding/OnboardingDossiersTable'
import type { Dossier, TabType } from './eleveOnboarding/types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: AdminSection) => void
}

export default function SectionEleveOnboarding({ onToast, onNav }: Props) {
  const t = useT('admin')
  void t
  void onNav
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('A_VALIDER')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerDossier, setDrawerDossier] = useState<Dossier | null>(null)

  const chargerDossiers = useCallback(async () => {
    const cacheKey = 'admin:eleve-onboarding'
    const cached = await getCachedData<Dossier[]>(cacheKey).catch(() => null)
    if (cached?.data && Array.isArray(cached.data)) {
      setDossiers(cached.data)
      setLoading(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false)
      return
    }

    try {
      if (!cached?.data) setLoading(true)
      const res = await fetchApi('/api/v2/eleve-onboarding', { credentials: 'include' })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setDossiers(data.data)
        await putCachedData(cacheKey, data.data).catch(() => {})
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNet = (typeof navigator !== 'undefined' && !navigator.onLine) || msg.includes('fetch') || msg.includes('Network')
      if (!isNet && !cached?.data) {
        onToast('Erreur lors du chargement des dossiers', 'error')
      }
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
    <div className="px-3.5 py-4 md:px-6 md:py-6" style={{ height: '100%', overflowY: 'auto', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
      <OnboardingTabs
        activeTab={activeTab}
        countAValider={countAValider}
        countRenvoyes={countRenvoyes}
        countRefuses={countRefuses}
        countHistorique={countHistorique}
        onSelectTab={(nextTab) => { setActiveTab(nextTab); setSelectedIds([]) }}
      />

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
      <OnboardingDossiersTable
        loading={loading}
        activeTab={activeTab}
        dossiersFiltres={dossiersFiltres}
        selectedIds={selectedIds}
        emptyStateMessage={getEmptyStateMessage()}
        onSelectAllSubmitted={handleSelectAllSubmitted}
        onClearSelection={() => setSelectedIds([])}
        onToggleSelect={handleToggleSelect}
        onDownloadPdf={handleDownloadPdf}
        onExamine={setDrawerDossier}
      />

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
