'use client'

import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff, RefreshCw, Loader2, CheckCircle2, Trash2 } from 'lucide-react'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { getPendingActions, deletePendingAction, type PendingAction } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'

interface Props {
  namespace?: 'staff' | 'teacher' | 'admin' | 'common'
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function OfflineSyncButtonPopover({ namespace = 'common', onToast }: Props) {
  const t = useT(namespace)
  const { pendingCount, syncing, isOnline, syncQueue } = useSyncQueue()
  const [open, setOpen] = useState(false)
  const [actions, setActions] = useState<PendingAction[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      getPendingActions().then(setActions)
    }
  }, [open, pendingCount])

  // Fermeture automatique lors d'un clic à l'extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleSync = async () => {
    if (!isOnline) {
      if (onToast) onToast('Aucune connexion internet', 'error')
      return
    }
    await syncQueue()
    if (onToast) onToast('Synchronisation terminée', 'success')
    const updated = await getPendingActions()
    setActions(updated)
  }

  const handleDelete = async (id: number) => {
    await deletePendingAction(id)
    setActions(prev => prev.filter(a => a.id !== id))
    if (onToast) onToast('Action supprimée de la file', 'info')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        title={isOnline ? `En ligne · ${pendingCount} action(s) en attente` : 'Hors ligne'}
        style={{
          height: 36,
          padding: '0 10px',
          borderRadius: 9,
          background: isOnline ? (pendingCount > 0 ? 'var(--amber-light)' : 'var(--bg2)') : 'var(--red-light)',
          border: `1px solid ${isOnline ? (pendingCount > 0 ? 'var(--amber)' : 'var(--border)') : 'var(--red)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          color: isOnline ? (pendingCount > 0 ? 'var(--amber)' : 'var(--text2)') : 'var(--red)',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'inherit',
          transition: 'all 0.15s ease',
        }}
      >
        {syncing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isOnline ? (
          <Wifi size={16} />
        ) : (
          <WifiOff size={16} />
        )}

        <span className="hidden sm:inline">
          {isOnline ? (pendingCount > 0 ? `${pendingCount} en attente` : 'En ligne') : 'Hors ligne'}
        </span>

        {pendingCount > 0 && (
          <span
            style={{
              background: 'var(--amber)',
              color: 'white',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 800,
              padding: '1px 6px',
              lineHeight: 1,
            }}
          >
            {pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 340,
            maxHeight: 420,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header Popover */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isOnline ? <Wifi size={16} color="var(--green)" /> : <WifiOff size={16} color="var(--red)" />}
              <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>
                {isOnline ? 'Connexion établie' : 'Mode hors ligne'}
              </span>
            </div>
            {isOnline && pendingCount > 0 && (
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'var(--green)',
                  color: 'white',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {syncing ? 'Sync...' : 'Synchroniser'}
              </button>
            )}
          </div>

          {/* Action List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {actions.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text3)' }}>
                <CheckCircle2 size={36} color="var(--green)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                  Tout est à jour !
                </div>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  Aucune modification en attente d’envoi.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Actions stockées en local ({actions.length})
                </div>
                {actions.map(action => (
                  <div
                    key={action.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                        {action.type}
                      </div>
                      <div className="truncate" style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)' }}>
                        {action.endpoint}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(action.id!)}
                      title="Supprimer cette action"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--red)',
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 6,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
