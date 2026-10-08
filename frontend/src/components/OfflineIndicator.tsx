'use client'

import { useState, useEffect, useRef } from 'react'
import { WifiOff, RefreshCw, Clock, CheckCircle2, X } from 'lucide-react'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { useT } from '@/lib/i18n'

export function OfflineIndicator() {
  const t = useT('common')
  const { pendingCount, syncing, isOnline, syncQueue } = useSyncQueue()
  const [syncedCount, setSyncedCount] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const prevPendingRef = useRef(pendingCount)
  const prevOnlineRef = useRef(isOnline)

  // Réinitialiser le masquage si l'état de connexion change
  useEffect(() => {
    if (prevOnlineRef.current !== isOnline) {
      setDismissed(false)
      prevOnlineRef.current = isOnline
    }
  }, [isOnline])

  useEffect(() => {
    const prev = prevPendingRef.current
    prevPendingRef.current = pendingCount

    if (prev > 0 && pendingCount === 0 && isOnline && !syncing) {
      setSyncedCount(prev)
      setShowSuccess(true)
      const t = setTimeout(() => setShowSuccess(false), 3000)
      return () => clearTimeout(t)
    }
  }, [pendingCount, isOnline, syncing])

  if (isOnline && pendingCount === 0 && !syncing && !showSuccess) return null

  // Si l'utilisateur a fermé la bannière rouge sur mobile, afficher une pastille discrète
  if (dismissed && !isOnline) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        title={t('offline.title') ?? 'Hors ligne (cliquer pour détails)'}
        className="fixed z-50 bottom-[72px] right-3 md:bottom-6 md:right-6 p-2 rounded-full shadow-lg border border-[var(--red)] bg-[var(--red-light)] text-[var(--red)] transition-transform active:scale-95 cursor-pointer"
        aria-label="Mode hors-ligne actif"
      >
        <WifiOff size={16} />
      </button>
    )
  }

  if (dismissed) return null

  return (
    <div
      className="fixed z-50 bottom-[74px] right-3 left-3 md:left-auto md:bottom-6 md:right-6 md:max-w-[340px] rounded-xl p-3 shadow-xl border font-sans text-sm font-semibold flex flex-col gap-1.5 transition-all"
      style={{
        background: !isOnline
          ? 'var(--red-light)'
          : syncing
          ? 'var(--blue-light)'
          : pendingCount > 0
          ? 'var(--amber-light)'
          : 'var(--green-light)',
        borderColor: !isOnline
          ? 'var(--red)'
          : syncing
          ? 'var(--blue)'
          : pendingCount > 0
          ? 'var(--amber)'
          : 'var(--green)',
        color: !isOnline
          ? 'var(--red)'
          : syncing
          ? 'var(--blue)'
          : pendingCount > 0
          ? 'var(--amber)'
          : 'var(--green)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isOnline && <WifiOff size={16} className="shrink-0" />}
          {syncing && <RefreshCw size={16} className="shrink-0 animate-spin" />}
          {isOnline && !syncing && pendingCount > 0 && <Clock size={16} className="shrink-0" />}
          {showSuccess && <CheckCircle2 size={16} className="shrink-0" />}

          <span className="text-[13px] font-bold">
            {!isOnline && (t('offline.title') ?? 'Mode hors-ligne')}
            {syncing && (t('offline.syncing') ?? 'Synchronisation…')}
            {isOnline && !syncing && pendingCount > 0 && `${pendingCount} ${t('offline.element')}${pendingCount > 1 ? 's' : ''} ${t('offline.pending')}`}
            {showSuccess && `${syncedCount} ${t('offline.element')}${syncedCount > 1 ? 's' : ''} ${t('offline.synced')}`}
          </span>
        </div>

        {/* Bouton de fermeture pour libérer l'écran et la bottombar */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity cursor-pointer text-inherit"
          title="Fermer"
          aria-label="Fermer l'indicateur"
        >
          <X size={15} />
        </button>
      </div>

      {!isOnline && (
        <div className="text-[11.5px] font-medium leading-snug opacity-90">
          {t('offline.description') ?? 'Les données sont sauvegardées localement et seront synchronisées dès le retour du réseau.'}
        </div>
      )}

      {syncing && pendingCount > 0 && (
        <div className="text-[11.5px] font-medium opacity-90">
          {pendingCount} {t('offline.element')}{pendingCount > 1 ? 's' : ''} {t('offline.toSync')}
        </div>
      )}

      {isOnline && !syncing && pendingCount > 0 && (
        <button
          type="button"
          onClick={() => syncQueue()}
          className="mt-1 px-3 py-1.5 rounded-lg text-white font-bold text-xs cursor-pointer self-start transition-opacity hover:opacity-90"
          style={{ background: 'var(--amber)' }}
        >
          {t('offline.syncNow') ?? 'Synchroniser maintenant'}
        </button>
      )}
    </div>
  )
}

