'use client'
import { useEffect } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'
import type { Toast } from '../_types'

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }
const STYLES: Record<string, string> = {
  success: 'bg-[var(--green-light)] text-[var(--green)] border-[var(--green)]',
  error:   'bg-[var(--red-light)] text-[var(--red)] border-[var(--red)]',
  info:    'bg-[var(--blue-light)] text-[var(--blue)] border-[var(--blue)]',
  warning: 'bg-[var(--amber-light)] text-[var(--amber)] border-[var(--amber)]',
}

function ToastItem({ t, onRemove }: { t: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3500)
    return () => clearTimeout(timer)
  }, [onRemove])
  const Icon = ICONS[t.type]
  return (
    <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg border min-w-[240px] max-w-[360px] text-[12.5px] font-bold shadow-md ${STYLES[t.type]}`}
      style={{ animation: 'slideInRight 0.3s ease' }}>
      <span className="flex-shrink-0 flex items-center"><Icon size={15} strokeWidth={2} /></span>
      <span>{t.msg}</span>
    </div>
  )
}

export default function StudentToast({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed top-20 right-6 z-[500] flex flex-col gap-2">
      {toasts.map(t => <ToastItem key={t.id} t={t} onRemove={() => onRemove(t.id)} />)}
    </div>
  )
}
