'use client'

import React, { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { db } from '@/lib/offline/db'
import ConflictResolutionModal from './ConflictResolutionModal'

export default function OfflineTopBar() {
  const isOnline = useOnlineStatus()
  const { pendingCount, syncing, syncQueue } = useSyncQueue()
  const [conflictCount, setConflictCount] = useState(0)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [dismissedOffline, setDismissedOffline] = useState(false)
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false)

  // Surveiller les conflits dans db.pendingActions
  useEffect(() => {
    const checkConflicts = () => {
      db.pendingActions
        .where('status')
        .equals('CONFLICT')
        .count()
        .then(setConflictCount)
        .catch(() => {})
    }
    checkConflicts()
    const interval = setInterval(checkConflicts, 5000)
    return () => clearInterval(interval)
  }, [pendingCount])

  // Détecter la reconnexion pour afficher brièvement le succès
  useEffect(() => {
    if (isOnline && dismissedOffline) {
      setDismissedOffline(false)
      setShowReconnectedBanner(true)
      const timer = setTimeout(() => setShowReconnectedBanner(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, dismissedOffline])

  // Si l'utilisateur est hors-ligne mais a explicitement fermé la bannière, ne rien afficher
  if (!isOnline && dismissedOffline) {
    return null
  }

  if (isOnline && !syncing && pendingCount === 0 && conflictCount === 0 && !showReconnectedBanner) {
    return null
  }

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease',
          background: !isOnline
            ? 'var(--surface-sunken, #1e293b)'
            : conflictCount > 0
            ? 'var(--amber, #d97706)'
            : 'var(--green, #16a34a)',
          color: '#ffffff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!isOnline ? (
            <>
              <WifiOff size={14} strokeWidth={2.5} />
              <span>Mode hors connexion actif · Vos saisies sont chiffrées et enregistrées en local.</span>
              {pendingCount > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>
                  {pendingCount} action(s) en attente
                </span>
              )}
            </>
          ) : syncing ? (
            <>
              <RefreshCw size={13} className="animate-spin" strokeWidth={2.5} />
              <span>Connexion rétablie · Synchronisation en cours de vos données locales ({pendingCount} restant)...</span>
            </>
          ) : conflictCount > 0 ? (
            <>
              <AlertTriangle size={14} strokeWidth={2.5} />
              <span>Attention : {conflictCount} conflit(s) détecté(s) lors de la synchronisation.</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={14} strokeWidth={2.5} />
              <span>Connexion rétablie · Toutes vos données locales sont synchronisées.</span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {conflictCount > 0 && (
            <button
              type="button"
              onClick={() => setShowConflictModal(true)}
              style={{
                background: '#ffffff',
                color: 'var(--amber, #d97706)',
                border: 'none',
                borderRadius: 6,
                padding: '3px 9px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Résoudre
            </button>
          )}

          {isOnline && pendingCount > 0 && !syncing && (
            <button
              type="button"
              onClick={() => syncQueue()}
              style={{
                background: 'rgba(255,255,255,0.25)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Synchroniser
            </button>
          )}

          {!isOnline && (
            <button
              type="button"
              onClick={() => setDismissedOffline(true)}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                borderRadius: 4,
                color: '#ffffff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3px 7px',
                fontSize: 11,
                gap: 4,
              }}
              title="Fermer la bannière"
              aria-label="Fermer la bannière"
            >
              <X size={13} strokeWidth={2.5} />
              <span>Fermer</span>
            </button>
          )}
        </div>
      </div>

      <ConflictResolutionModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        onResolved={() => {
          db.pendingActions.where('status').equals('CONFLICT').count().then(setConflictCount)
        }}
      />
    </>
  )
}
