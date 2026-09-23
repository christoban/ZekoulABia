'use client'
import { useEffect } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'
import type { Toast } from '../_types'

const ICONS: Record<Toast['type'], React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle,
}

const STYLES: Record<Toast['type'], React.CSSProperties> = {
  success: { background: 'var(--green-light)', border: '1.5px solid rgba(142,42,58,0.3)',  color: 'var(--green)' },
  error:   { background: 'var(--red-light)', border: '1.5px solid rgba(220,38,38,0.3)',  color: 'var(--red)' },
  info:    { background: 'var(--blue-light)', border: '1.5px solid rgba(29,78,216,0.2)',  color: 'var(--blue)' },
  warning: { background: 'var(--amber-light)', border: '1.5px solid rgba(217,119,6,0.3)', color: 'var(--amber)' },
}

function ToastItem({ t, onRemove }: { t: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3500)
    return () => clearTimeout(timer)
  }, [onRemove])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px',
      borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      minWidth: 260, maxWidth: 380, fontSize: 14, fontWeight: 700,
      animation: 'slideInRight 0.25s ease',
      ...STYLES[t.type],
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, display: 'inline-flex' }}>
        {(() => { const Icon = ICONS[t.type]; return <Icon size={16} strokeWidth={2} /> })()}
      </span>
      <span>{t.msg}</span>
      <button onClick={onRemove}
        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: 16, padding: 0, flexShrink: 0 }}>
        ×
      </button>
    </div>
  )
}

interface Props {
  toasts: Toast[]
  onRemove: (id: number) => void
}

export default function StaffToast({ toasts, onRemove }: Props) {
  if (toasts.length === 0) return null
  return (
    <div style={{ position: 'fixed', top: 74, right: 20, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <style>{`@keyframes slideInRight { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:none } }`}</style>
      {toasts.map(t => (
        <ToastItem key={t.id} t={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  )
}
