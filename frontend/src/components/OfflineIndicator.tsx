'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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

  // Position flottante déplaçable pour la pastille fermée
  const [pillPos, setPillPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    moved: false,
  })

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
      const timeout = setTimeout(() => setShowSuccess(false), 3000)
      return () => clearTimeout(timeout)
    }
  }, [pendingCount, isOnline, syncing])

  // Initialisation de la position par défaut de la pastille (en bas à gauche, loin du bouton d'envoi)
  useEffect(() => {
    if (typeof window !== 'undefined' && pillPos === null) {
      setPillPos({
        x: 16,
        y: Math.max(80, window.innerHeight - 130),
      })
    }
  }, [pillPos])

  // Gestion du drag tactile (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    const curX = pillPos?.x ?? 16
    const curY = pillPos?.y ?? (window.innerHeight - 130)
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      origX: curX,
      origY: curY,
      moved: false,
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    const dx = touch.clientX - dragRef.current.startX
    const dy = touch.clientY - dragRef.current.startY
    if (Math.hypot(dx, dy) > 5) {
      dragRef.current.moved = true
    }
    const newX = Math.min(Math.max(8, dragRef.current.origX + dx), window.innerWidth - 56)
    const newY = Math.min(Math.max(8, dragRef.current.origY + dy), window.innerHeight - 56)
    setPillPos({ x: newX, y: newY })
  }

  const handleTouchEnd = () => {
    if (!dragRef.current.moved) {
      // Simple clic sans déplacement -> ré-ouvrir
      setDismissed(false)
    }
  }

  // Gestion du drag à la souris (desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const curX = pillPos?.x ?? 16
    const curY = pillPos?.y ?? (window.innerHeight - 130)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: curX,
      origY: curY,
      moved: false,
    }

    const onMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - dragRef.current.startX
      const dy = moveEvt.clientY - dragRef.current.startY
      if (Math.hypot(dx, dy) > 5) {
        dragRef.current.moved = true
      }
      const newX = Math.min(Math.max(8, dragRef.current.origX + dx), window.innerWidth - 56)
      const newY = Math.min(Math.max(8, dragRef.current.origY + dy), window.innerHeight - 56)
      setPillPos({ x: newX, y: newY })
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (!dragRef.current.moved) {
        setDismissed(false)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  if (isOnline && pendingCount === 0 && !syncing && !showSuccess) return null

  // Si l'utilisateur a fermé la bannière : pastille discrète et DÉPLAÇABLE (touch & mouse)
  if (dismissed && !isOnline) {
    const currentX = pillPos?.x ?? 16
    const currentY = pillPos?.y ?? 120

    return (
      <div
        style={{
          position: 'fixed',
          left: currentX,
          top: currentY,
          zIndex: 1250,
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <button
          type="button"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          title={t('offline.title') ?? 'Hors ligne (glisser pour déplacer, cliquer pour ouvrir)'}
          className="p-3 rounded-full shadow-2xl border-2 border-[var(--red)] bg-[var(--surface)] text-[var(--red)] transition-transform active:scale-95 cursor-grab active:cursor-grabbing flex items-center justify-center"
          style={{
            boxShadow: '0 8px 24px rgba(220, 38, 38, 0.35)',
            width: 46,
            height: 46,
          }}
          aria-label="Mode hors-ligne actif (déplaçable)"
        >
          <WifiOff size={20} className="pointer-events-none" />
        </button>
      </div>
    )
  }

  if (dismissed) return null

  // Bannière complète : positionnée pour ne JAMAIS chevaucher l'assistant IA
  // Mobile : bottom-[76px], left-3, right-[76px] (laisse 76px libre à droite pour le bouton IA)
  // Desktop : bottom-6, left-6 (l'assistant est en bas à droite)
  return (
    <div
      className="fixed z-[1250] bottom-[76px] left-3 right-[76px] md:left-6 md:right-auto md:bottom-6 md:max-w-[340px] rounded-2xl p-3.5 shadow-2xl border font-sans text-sm font-semibold flex flex-col gap-2 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{
        background: !isOnline
          ? 'var(--surface)'
          : syncing
          ? 'var(--surface)'
          : pendingCount > 0
          ? 'var(--surface)'
          : 'var(--surface)',
        borderColor: !isOnline
          ? 'var(--red)'
          : syncing
          ? 'var(--blue)'
          : pendingCount > 0
          ? 'var(--amber)'
          : 'var(--green)',
        color: 'var(--text)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isOnline && <WifiOff size={18} className="shrink-0 text-[var(--red)]" />}
          {syncing && <RefreshCw size={18} className="shrink-0 animate-spin text-[var(--blue)]" />}
          {isOnline && !syncing && pendingCount > 0 && <Clock size={18} className="shrink-0 text-[var(--amber)]" />}
          {showSuccess && <CheckCircle2 size={18} className="shrink-0 text-[var(--green)]" />}

          <span
            className="text-[13px] font-extrabold"
            style={{
              color: !isOnline
                ? 'var(--red)'
                : syncing
                ? 'var(--blue)'
                : pendingCount > 0
                ? 'var(--amber)'
                : 'var(--green)',
            }}
          >
            {!isOnline && (t('offline.title') ?? 'Mode hors-ligne')}
            {syncing && (t('offline.syncing') ?? 'Synchronisation…')}
            {isOnline && !syncing && pendingCount > 0 && `${pendingCount} ${t('offline.element')}${pendingCount > 1 ? 's' : ''} ${t('offline.pending')}`}
            {showSuccess && `${syncedCount} ${t('offline.element')}${syncedCount > 1 ? 's' : ''} ${t('offline.synced')}`}
          </span>
        </div>

        {/* Bouton de fermeture spacieux, toujours cliquable sans blocage par l'IA */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--bg2)] transition-colors cursor-pointer"
          title="Réduire en pastille déplaçable"
          aria-label="Fermer l'indicateur"
        >
          <X size={16} />
        </button>
      </div>

      {!isOnline && (
        <div className="text-[11.5px] font-medium leading-snug text-[var(--text2)]">
          {t('offline.description') ?? 'Données enregistrées localement. Synchronisation automatique dès détection du réseau.'}
        </div>
      )}

      {syncing && pendingCount > 0 && (
        <div className="text-[11.5px] font-medium text-[var(--text2)]">
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


