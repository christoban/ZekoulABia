'use client'
import { useEffect } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'
import type { Toast } from '../_types'

interface Props {
  toasts: Toast[]
  onRemove: (id: number) => void
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }
const STYLES = {
  success: 'bg-[#f0fdf4] border-[rgba(5,150,105,0.2)] text-[#065f46]',
  error:   'bg-[#fef2f2] border-[rgba(220,38,38,0.2)] text-[#991b1b]',
  info:    'bg-white border-[#e8e0d4] text-[#1a1209]',
  warning: 'bg-[#fef3c7] border-[rgba(217,119,6,0.2)] text-[#92400e]',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const t = setTimeout(onRemove, 4000)
    return () => clearTimeout(t)
  }, [onRemove])

  const Icon = ICONS[toast.type]
  return (
    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] border min-w-[220px] max-w-[320px] text-[11px] font-bold shadow-[0_2px_8px_rgba(0,0,0,0.1)] ${STYLES[toast.type]}`}
      style={{ animation: 'slideInRight 0.2s ease' }}>
      <span className="flex-shrink-0 flex items-center"><Icon size={13} strokeWidth={2} /></span>
      <span>{toast.msg}</span>
    </div>
  )
}

export default function MasterToast({ toasts, onRemove }: Props) {
  if (!toasts.length) return null
  return (
    <div className="fixed top-[48px] right-4 z-[500] flex flex-col gap-1.5">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  )
}
