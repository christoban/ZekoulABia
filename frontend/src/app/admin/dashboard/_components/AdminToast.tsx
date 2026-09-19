'use client'
import { useEffect } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'
import type { Toast } from '../_types'

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }
const STYLES: Record<string, string> = {
  success: 'bg-[var(--green-light)] text-[var(--green)] border-[var(--green)]',
  error:   'bg-[var(--red-light)] text-[var(--red)] border-[var(--red)]',
  info:    'bg-[var(--surface)] text-[var(--text)] border-[var(--border)]',
  warning: 'bg-[var(--amber-light)] text-[var(--amber)] border-[var(--amber)]',
}

function ToastItem({ t, onRemove }: { t: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3500)
    return () => clearTimeout(timer)
  }, [onRemove])
  const Icon = ICONS[t.type]
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 sm:px-5 sm:py-[14px] rounded-xl border-[1.5px] w-full sm:w-auto sm:min-w-[280px] max-w-[calc(100vw-32px)] sm:max-w-[400px] text-[13.5px] sm:text-[15px] font-bold shadow-lg ${STYLES[t.type]}`}
      style={{ animation: 'slideInRight 0.3s ease' }}>
      <span className="flex-shrink-0 flex items-center"><Icon size={18} strokeWidth={2} /></span>
      <span className="break-words min-w-0 flex-1">{t.msg}</span>
    </div>
  )
}

export default function AdminToast({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed top-16 sm:top-20 right-4 left-4 sm:left-auto sm:right-6 z-[500] flex flex-col items-center sm:items-end gap-2 pointer-events-none [&>*]:pointer-events-auto">
      {toasts.map(t => <ToastItem key={t.id} t={t} onRemove={() => onRemove(t.id)} />)}
    </div>
  )
}
