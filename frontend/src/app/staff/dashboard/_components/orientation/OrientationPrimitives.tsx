'use client'
import type React from 'react'
import { useT } from '@/lib/i18n'

export function OrientationBadge({
  value,
  map,
  labelMap,
}: {
  value: string
  map: Record<string, { bg: string; color: string }>
  labelMap?: Record<string, string>
}) {
  const t = useT('staff')
  const b = map[value] ?? { bg: 'var(--bg2)', color: 'var(--text3)' }
  const lbl = labelMap?.[value] ? t(`orientation.${labelMap[value]}`) : value
  return (
    <span style={{ background: b.bg, color: b.color, borderRadius: 6, padding: '2px 8px', fontSize: 11.5, fontWeight: 600 }}>
      {lbl}
    </span>
  )
}

export function OrientationModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-4 py-4 md:px-6 md:py-5" style={{ background: 'var(--surface)', borderRadius: 14, width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.14)' }}>
        {children}
      </div>
    </div>
  )
}

export function OrientationEmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', background: 'var(--bg)', borderRadius: 12, border: '1px dashed var(--border)' }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  )
}
