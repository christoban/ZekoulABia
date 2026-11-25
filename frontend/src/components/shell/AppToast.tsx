'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

export type AppToastType = 'success' | 'error' | 'info' | 'warning'

export interface AppToastItem {
  id: number
  msg: string
  type: AppToastType
}

type ToastListener = (item: AppToastItem, durationMs: number) => void

const listeners = new Set<ToastListener>()
let nextToastId = 1

export function notifyToast(msg: string, type: AppToastType = 'info', durationMs = 4000): void {
  const item: AppToastItem = { id: nextToastId++, msg, type }
  for (const listener of listeners) {
    listener(item, durationMs)
  }
}

const ICONS: Record<AppToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const COLORS: Record<AppToastType, { border: string; accent: string }> = {
  success: { border: 'var(--green)', accent: 'var(--green)' },
  error: { border: 'var(--red)', accent: 'var(--red)' },
  warning: { border: 'var(--amber)', accent: 'var(--amber)' },
  info: { border: 'var(--blue)', accent: 'var(--blue)' },
}

export function AppToast({
  toasts,
  onRemove,
  style,
}: {
  toasts: ReadonlyArray<AppToastItem>
  onRemove: (id: number) => void
  style?: CSSProperties
}) {
  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 sm:bottom-5 right-4 sm:right-5 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-auto pointer-events-none"
      style={{ zIndex: 1100, ...style }}
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] ?? Info
        const palette = COLORS[toast.type] ?? COLORS.info
        return (
          <div
            key={toast.id}
            onClick={() => onRemove(toast.id)}
            className="pointer-events-auto cursor-pointer flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl shadow-lg border text-sm font-medium transition-all"
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              borderColor: palette.border,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
            }}
          >
            <Icon size={17} style={{ color: palette.accent, flexShrink: 0 }} />
            <span className="flex-1 leading-snug break-words">{toast.msg}</span>
            <button
              type="button"
              aria-label="Fermer"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(toast.id)
              }}
              className="p-0.5 rounded opacity-65 hover:opacity-100 shrink-0"
              style={{ color: 'var(--text2)', background: 'transparent', border: 'none' }}
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function GlobalToastHost() {
  const [toasts, setToasts] = useState<AppToastItem[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  useEffect(() => {
    const onNotify: ToastListener = (item, durationMs) => {
      setToasts((prev) => [...prev.slice(-4), item])
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((entry) => entry.id !== item.id))
      }, durationMs)
    }
    listeners.add(onNotify)
    return () => {
      listeners.delete(onNotify)
    }
  }, [])

  return <AppToast toasts={toasts} onRemove={removeToast} style={{ zIndex: 1120 }} />
}

