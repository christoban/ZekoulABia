'use client'

import React, { useState, useEffect } from 'react'
import ModalOverlay from '@/components/finance/ModalOverlay'
import { AlertTriangle, Check, X, ArrowRight, RefreshCw, Trash2 } from 'lucide-react'
import { getPendingActions, deletePendingAction, updatePendingActionStatus, type PendingAction } from '@/lib/offline/db'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  isOpen: boolean
  onClose: () => void
  onResolved?: () => void
}

export default function ConflictResolutionModal({ isOpen, onClose, onResolved }: Props) {
  const [conflictActions, setConflictActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  const loadConflicts = async () => {
    setLoading(true)
    try {
      const all = await getPendingActions()
      setConflictActions(all.filter((a) => a.status === 'CONFLICT'))
    } catch {
      // silencieux
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadConflicts()
    }
  }, [isOpen])

  if (!isOpen) return null

  // Résolution 1 : Conserver la version serveur (supprimer l'action locale)
  const handleKeepServer = async (actionId: number) => {
    setResolvingId(actionId)
    try {
      await deletePendingAction(actionId)
      await loadConflicts()
      onResolved?.()
    } finally {
      setResolvingId(null)
    }
  }

  // Résolution 2 : Forcer la version locale (rejeu avec flag d'écrasement)
  const handleKeepLocal = async (action: PendingAction) => {
    if (!action.id) return
    setResolvingId(action.id)
    try {
      const payload = typeof action.payload === 'object' && action.payload !== null
        ? { ...(action.payload as Record<string, unknown>), forceOverwrite: true }
        : action.payload

      const res = await fetchApi(action.endpoint, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': action.idempotencyKey,
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        await deletePendingAction(action.id)
      } else {
        // En cas de nouvel échec, repasser en PENDING pour le prochain cycle de synchro
        await updatePendingActionStatus(action.id, 'PENDING')
      }
      await loadConflicts()
      onResolved?.()
    } catch {
      await updatePendingActionStatus(action.id, 'PENDING')
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width: '100%', maxWidth: 580, background: 'var(--surface)', borderRadius: 14, padding: 22, border: '1px solid var(--border)' }}>
        {/* Titre & Entête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--amber-light, #fef3c7)', color: 'var(--amber, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Arbitrage des Conflits Réseau</h3>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text3)' }}>
                {conflictActions.length} modification(s) en concurrence avec une saisie tierce sur le serveur
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{ background: 'var(--bg2)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' }}
            aria-label="Fermer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Corps */}
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
            Vérification des conflits...
          </div>
        ) : conflictActions.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg2)', borderRadius: 10 }}>
            <Check size={24} style={{ color: 'var(--green)', margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Aucun conflit détecté</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>Toutes vos opérations sont synchronisées ou en attente normale.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 380, overflowY: 'auto', marginBottom: 16 }}>
            {conflictActions.map((action) => {
              const conflict = action.conflictData as { serverValue?: unknown; localValue?: unknown; message?: string } | undefined
              return (
                <div
                  key={action.id}
                  style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--amber, #d97706)' }}>
                      {action.type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>
                      {new Date(action.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {conflict?.message && (
                    <div style={{ fontSize: 11.5, color: 'var(--text2)', fontStyle: 'italic' }}>
                      « {conflict.message} »
                    </div>
                  )}

                  {/* Comparaison des valeurs si disponibles */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                    <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)' }}>
                      <div style={{ color: 'var(--text3)', fontWeight: 700, marginBottom: 2 }}>Votre saisie locale :</div>
                      <div style={{ fontWeight: 800, color: 'var(--primary)' }}>
                        {conflict?.localValue !== undefined ? String(conflict.localValue) : JSON.stringify(action.payload).slice(0, 40) + '...'}
                      </div>
                    </div>
                    <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)' }}>
                      <div style={{ color: 'var(--text3)', fontWeight: 700, marginBottom: 2 }}>Valeur sur le serveur :</div>
                      <div style={{ fontWeight: 800, color: 'var(--text)' }}>
                        {conflict?.serverValue !== undefined ? String(conflict.serverValue) : 'Version déjà enregistrée'}
                      </div>
                    </div>
                  </div>

                  {/* Boutons d'arbitrage */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      disabled={resolvingId === action.id}
                      onClick={() => handleKeepLocal(action)}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        borderRadius: 7,
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: resolvingId === action.id ? 0.6 : 1,
                      }}
                    >
                      <RefreshCw size={12} className={resolvingId === action.id ? 'animate-spin' : ''} />
                      Garder ma saisie locale
                    </button>
                    <button
                      type="button"
                      disabled={resolvingId === action.id}
                      onClick={() => handleKeepServer(action.id!)}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        borderRadius: 7,
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: 'var(--surface)',
                        color: 'var(--text2)',
                        border: '1px solid var(--border2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: resolvingId === action.id ? 0.6 : 1,
                      }}
                    >
                      <Trash2 size={12} />
                      Conserver le serveur
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pied de page */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--bg2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
