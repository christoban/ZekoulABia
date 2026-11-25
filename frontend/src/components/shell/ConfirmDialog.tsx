'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, HelpCircle, X } from 'lucide-react'
import { getResolvedClientLanguage } from '@/lib/i18n'

export interface ConfirmDialogOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface PendingConfirm {
  options: ConfirmDialogOptions
  resolve: (confirmed: boolean) => void
}

type ConfirmSubscriber = (entry: PendingConfirm) => void

const subscribers = new Set<ConfirmSubscriber>()

const DESTRUCTIVE_RE = /\b(supprim|delet|révoqu|dissoci|purg|réinitialis|reset|détach|archiver|retirer|clôturer)\b/i

export function confirmAction(input: string | ConfirmDialogOptions): Promise<boolean> {
  if (typeof window === 'undefined' || subscribers.size === 0) {
    return Promise.resolve(false)
  }
  const options: ConfirmDialogOptions = typeof input === 'string' ? { message: input } : input
  return new Promise<boolean>((resolve) => {
    const entry: PendingConfirm = { options, resolve }
    for (const sub of subscribers) {
      sub(entry)
      break
    }
  })
}

function detectIsEnglish(): boolean {
  return getResolvedClientLanguage() === 'en'
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  const en = detectIsEnglish()
  const isDanger = danger ?? DESTRUCTIVE_RE.test(message)
  const resolvedTitle = title ?? (isDanger ? (en ? 'Confirm action' : 'Confirmer la suppression') : (en ? 'Confirmation' : 'Confirmation'))
  const resolvedConfirm = confirmLabel ?? (en ? 'Confirm' : 'Confirmer')
  const resolvedCancel = cancelLabel ?? (en ? 'Cancel' : 'Annuler')
  const Icon = isDanger ? AlertTriangle : HelpCircle
  const accentColor = isDanger ? 'var(--red)' : 'var(--primary)'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zekoul-confirm-title"
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 1150, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: isDanger ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)', color: accentColor }}
            >
              <Icon size={17} />
            </span>
            <h3 id="zekoul-confirm-title" className="text-sm font-bold m-0" style={{ color: 'var(--text)' }}>
              {resolvedTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={resolvedCancel}
            className="p-1 rounded-lg opacity-70 hover:opacity-100"
            style={{ background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text2)' }}>
          {message}
        </div>

        <div
          className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {resolvedCancel}
          </button>
          <button
            type="button"
            autoFocus={!isDanger}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-90"
            style={{
              background: isDanger ? 'var(--red)' : 'var(--primary)',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            {resolvedConfirm}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmDialogHost() {
  const [queue, setQueue] = useState<PendingConfirm[]>([])

  useEffect(() => {
    const onRequest: ConfirmSubscriber = (entry) => {
      setQueue((prev) => [...prev, entry])
    }
    subscribers.add(onRequest)
    return () => {
      subscribers.delete(onRequest)
    }
  }, [])

  const current = queue[0] ?? null

  const settle = (result: boolean) => {
    if (!current) return
    setQueue((prev) => prev.slice(1))
    current.resolve(result)
  }

  return (
    <ConfirmDialog
      open={current !== null}
      title={current?.options.title}
      message={current?.options.message ?? ''}
      confirmLabel={current?.options.confirmLabel}
      cancelLabel={current?.options.cancelLabel}
      danger={current?.options.danger}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )
}
