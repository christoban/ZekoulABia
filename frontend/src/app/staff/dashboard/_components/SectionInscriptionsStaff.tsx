'use client'

import React, { useState, useEffect, useCallback } from 'react'

import {
  Users,
  PlusCircle,
  Kanban,
  FileCheck,
  RefreshCw,
  Download,
  AlertCircle,
  CloudOff,
  Wifi,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import EnrollmentKanbanBoard, { type KanbanDossier } from '@/components/enrollment/EnrollmentKanbanBoard'
import EnrollmentStepperForm from '@/components/enrollment/EnrollmentStepperForm'
import ValidationDrawer from '@/components/enrollment/ValidationDrawer'

interface Props {
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionInscriptionsStaff({ onToast }: Props) {
  const isOnline = useOnlineStatus()
  const { pendingCount, syncQueue, syncing } = useSyncQueue()
  const [onglet, setOnglet] = useState<'KANBAN' | 'NOUVEAU'>('KANBAN')
  const [dossiers, setDossiers] = useState<KanbanDossier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDossier, setSelectedDossier] = useState<KanbanDossier | null>(null)

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

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      {/* En-tête */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
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
            Gestion des Inscriptions & Admissions
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text2, #4b5563)' }}>
            Suivi des dossiers élèves, contrôle des pièces justificatives et capacités de classe.
          </p>
        </div>

        {/* Boutons d'onglets */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setOnglet('KANBAN')}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: `1.5px solid ${onglet === 'KANBAN' ? 'var(--green, #16a34a)' : 'var(--border, #e5e7eb)'}`,
              background: onglet === 'KANBAN' ? 'rgba(22,163,74,0.08)' : 'var(--surface, #fff)',
              color: onglet === 'KANBAN' ? 'var(--green, #16a34a)' : 'var(--text, #111827)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Kanban size={15} />
            Tableau Kanban
          </button>

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
            }}
          >
            <PlusCircle size={15} />
            Nouveau dossier
          </button>
        </div>
      </div>

      {(!isOnline || pendingCount > 0) && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: !isOnline ? 'rgba(234,88,12,0.1)' : 'rgba(37,99,235,0.08)',
            border: `1px solid ${!isOnline ? 'rgba(234,88,12,0.3)' : 'rgba(37,99,235,0.2)'}`,
            color: !isOnline ? '#c2410c' : '#1d4ed8',
            fontSize: 13,
            marginBottom: 16,
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
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Contenu selon onglet */}
      {onglet === 'KANBAN' && (
        <EnrollmentKanbanBoard
          dossiers={dossiers}
          onSelectDossier={(d) => setSelectedDossier(d)}
          onDownloadPdf={handleDownloadPdf}
        />
      )}

      {onglet === 'NOUVEAU' && (
        <EnrollmentStepperForm
          onSuccess={(newId) => {
            onToast?.('Dossier créé avec succès !', 'success')
            chargerDossiers()
            setOnglet('KANBAN')
          }}
          onCancel={() => setOnglet('KANBAN')}
        />
      )}

      {/* Tiroir de revue */}
      <ValidationDrawer
        dossier={selectedDossier}
        isOpen={!!selectedDossier}
        onClose={() => setSelectedDossier(null)}
        onActionComplete={() => {
          chargerDossiers()
          onToast?.('Dossier mis à jour', 'info')
        }}
        isAdmin={false}
      />
    </div>
  )
}
