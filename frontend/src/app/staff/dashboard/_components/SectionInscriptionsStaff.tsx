'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  PlusCircle,
  Upload,
  Printer,
  FileCheck,
  RefreshCw,
  CloudOff,
  AlertCircle,
  Kanban,
  List,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import EnrollmentKanbanBoard, { type KanbanDossier } from '@/components/enrollment/EnrollmentKanbanBoard'
import EnrollmentListView from '@/components/enrollment/EnrollmentListView'
import EnrollmentStepperForm from '@/components/enrollment/EnrollmentStepperForm'
import ValidationDrawer from '@/components/enrollment/ValidationDrawer'
import ImportUsersWizardModal from '@/app/admin/dashboard/_components/ImportUsersWizardModal'

interface Props {
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionInscriptionsStaff({ onToast }: Props) {
  const isOnline = useOnlineStatus()
  const { pendingCount, syncQueue, syncing } = useSyncQueue()
  const [onglet, setOnglet] = useState<'BOARD' | 'NOUVEAU'>('BOARD')
  const [vue, setVue] = useState<'KANBAN' | 'LISTE'>('KANBAN')
  const [dossiers, setDossiers] = useState<KanbanDossier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDossier, setSelectedDossier] = useState<KanbanDossier | null>(null)
  const [importWizardOpen, setImportWizardOpen] = useState(false)
  const [menuImprimerOpen, setMenuImprimerOpen] = useState(false)

  const chargerDossiers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi('/api/v2/eleve-onboarding')
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setDossiers(data.data)
      } else {
        setError(data.message || 'Impossible de charger les dossiers')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    chargerDossiers()
  }, [chargerDossiers])

  const handleDownloadPdf = (id: string) => {
    window.open(`/api/v2/eleve-onboarding/${id}/fiche-pdf`, '_blank')
  }

  const handleDownloadFicheVierge = () => {
    window.open('/api/v2/eleve-onboarding/fiche-vierge-pdf', '_blank')
    setMenuImprimerOpen(false)
  }

  const dossiersRenvoyes = dossiers.filter((d) => d.status === 'RETURNED')

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* En-tête officiel selon blueprint §3.3 */}
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
            <Users size={24} style={{ color: 'var(--green, #16a34a)' }} />
            Inscriptions
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text2, #4b5563)' }}>
            Dossiers hors concours et dossiers des admis
          </p>
        </div>

        {/* Boutons d'actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {onglet === 'NOUVEAU' ? (
            <button
              type="button"
              onClick={() => setOnglet('BOARD')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1.5px solid var(--border, #e5e7eb)',
                background: 'var(--surface, #fff)',
                color: 'var(--text, #111827)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ← Retour aux dossiers
            </button>
          ) : (
            <>
              {/* Sélecteur de vue Kanban | Liste */}
              <div
                style={{
                  display: 'flex',
                  background: 'var(--bg2, #f3f4f6)',
                  borderRadius: 8,
                  padding: 2,
                  border: '1px solid var(--border, #e5e7eb)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setVue('KANBAN')}
                  title="Vue Kanban"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: vue === 'KANBAN' ? 'var(--surface, #fff)' : 'transparent',
                    color: vue === 'KANBAN' ? 'var(--text, #111827)' : 'var(--text3, #9ca3af)',
                    cursor: 'pointer',
                    boxShadow: vue === 'KANBAN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Kanban size={14} /> Kanban
                </button>
                <button
                  type="button"
                  onClick={() => setVue('LISTE')}
                  title="Vue Liste"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: vue === 'LISTE' ? 'var(--surface, #fff)' : 'transparent',
                    color: vue === 'LISTE' ? 'var(--text, #111827)' : 'var(--text3, #9ca3af)',
                    cursor: 'pointer',
                    boxShadow: vue === 'LISTE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <List size={14} /> Liste
                </button>
              </div>

              {/* Bouton Menu Imprimer la fiche */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setMenuImprimerOpen(!menuImprimerOpen)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1.5px solid var(--border, #e5e7eb)',
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
                  <Printer size={15} />
                  Imprimer la fiche
                </button>

                {menuImprimerOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '110%',
                      zIndex: 50,
                      background: 'var(--surface, #fff)',
                      border: '1px solid var(--border, #e5e7eb)',
                      borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      padding: 6,
                      minWidth: 220,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleDownloadFicheVierge}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text, #111827)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg2)')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <FileText size={14} style={{ color: 'var(--blue)' }} /> Fiche d'inscription vierge
                    </button>
                  </div>
                )}
              </div>

              {/* Bouton Importer une liste */}
              <button
                type="button"
                onClick={() => setImportWizardOpen(true)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border, #e5e7eb)',
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
                <Upload size={15} />
                Importer une liste
              </button>

              {/* Bouton principal Nouveau dossier */}
              <button
                type="button"
                onClick={() => setOnglet('NOUVEAU')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--green, #16a34a)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(22,163,74,0.3)',
                }}
              >
                <PlusCircle size={15} />
                Nouveau dossier
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bandeau d'alerte si des dossiers sont "À compléter" (renvoyés par la direction) */}
      {dossiersRenvoyes.length > 0 && onglet === 'BOARD' && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#b45309', fontWeight: 700 }}>
              {dossiersRenvoyes.length} dossier(s) renvoyé(s) par la direction.
              Veuillez compléter les informations ou pièces demandées.
            </span>
          </div>
        </div>
      )}

      {/* État hors-ligne / synchronisation */}
      {(!isOnline || pendingCount > 0) && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: !isOnline ? 'rgba(234,88,12,0.1)' : 'rgba(37,99,235,0.08)',
            border: `1px solid ${!isOnline ? 'rgba(234,88,12,0.3)' : 'rgba(37,99,235,0.2)'}`,
            color: !isOnline ? '#c2410c' : '#1d4ed8',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isOnline ? <CloudOff size={16} /> : <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />}
            <span>
              {!isOnline
                ? 'Mode hors-ligne : vous pouvez continuer à saisir des dossiers en brouillon (sauvegardés localement).'
                : `${pendingCount} action(s) locale(s) en attente de synchronisation.`}
            </span>
          </div>
          {isOnline && pendingCount > 0 && (
            <button
              type="button"
              onClick={() => syncQueue().then((synced) => onToast?.(`${synced} action(s) synchronisée(s)`, 'success'))}
              disabled={syncing}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: '#1d4ed8',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: syncing ? 'not-allowed' : 'pointer',
              }}
            >
              {syncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            color: 'var(--red, #ef4444)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Contenu selon onglet et vue */}
      {onglet === 'BOARD' && vue === 'KANBAN' && (
        <EnrollmentKanbanBoard
          dossiers={dossiers}
          onSelectDossier={(d) => setSelectedDossier(d)}
          onDownloadPdf={handleDownloadPdf}
          onNouveauDossier={() => setOnglet('NOUVEAU')}
        />
      )}

      {onglet === 'BOARD' && vue === 'LISTE' && (
        <EnrollmentListView
          dossiers={dossiers}
          onSelectDossier={(d) => setSelectedDossier(d)}
          onDownloadPdf={handleDownloadPdf}
          onNouveauDossier={() => setOnglet('NOUVEAU')}
        />
      )}

      {onglet === 'NOUVEAU' && (
        <EnrollmentStepperForm
          onSuccess={() => {
            onToast?.('Dossier enregistré avec succès !', 'success')
            chargerDossiers()
            setOnglet('BOARD')
          }}
          onCancel={() => setOnglet('BOARD')}
        />
      )}

      {/* Tiroir de revue d'un dossier */}
      <ValidationDrawer
        dossier={selectedDossier}
        isOpen={!!selectedDossier}
        onClose={() => setSelectedDossier(null)}
        onActionComplete={() => {
          chargerDossiers()
          onToast?.('Dossier mis à jour avec succès', 'info')
        }}
        isAdmin={false}
      />

      {/* Modal d'import Excel restreint pour le secrétaire */}
      {importWizardOpen && (
        <ImportUsersWizardModal
          onClose={() => setImportWizardOpen(false)}
          onToast={onToast ?? (() => {})}
          isSecretary={true}
          onSuccess={() => {
            chargerDossiers()
            onToast?.('Import des élèves effectué avec succès !', 'success')
            setImportWizardOpen(false)
          }}
        />
      )}
    </div>
  )
}
