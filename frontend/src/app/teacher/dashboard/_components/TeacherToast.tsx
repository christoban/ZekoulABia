'use client'
import { useEffect } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'
import type { Toast } from '../_types'

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }
const STYLES: Record<string, string> = {
  success: 'bg-[var(--green-light)] border-[var(--green)] text-[var(--green)]',
  error:   'bg-[var(--red-light)] border-[var(--red)] text-[var(--red)]',
  info:    'bg-[var(--blue-light)] border-[var(--blue)] text-[var(--blue)]',
  warning: 'bg-[var(--amber-light)] border-[var(--amber)] text-[var(--amber)]',
}

function ToastItem({ t, onRemove }: { t: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3500)
    return () => clearTimeout(timer)
  }, [onRemove])
  const Icon = ICONS[t.type]
  return (
    <div className={`flex items-center gap-[10px] px-5 py-[14px] rounded-[12px] border-[1.5px] min-w-[280px] max-w-[400px] text-[15px] font-bold shadow-lg ${STYLES[t.type]}`}
      style={{ animation: 'slideInRight 0.3s ease' }}>
      <span className="flex-shrink-0 flex items-center"><Icon size={18} strokeWidth={2} /></span>
      <span>{t.msg}</span>
    </div>
  )
}

export default function TeacherToast({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed top-20 right-6 z-[500] flex flex-col gap-2">
      {toasts.map(t => <ToastItem key={t.id} t={t} onRemove={() => onRemove(t.id)} />)}
    </div>
  )
}
