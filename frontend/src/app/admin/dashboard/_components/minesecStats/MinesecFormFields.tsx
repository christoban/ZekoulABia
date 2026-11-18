'use client'

import type React from 'react'
import { useT } from '@/lib/i18n'
import { inputStyle } from './types'

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', margin: '8px 0 4px' }}>{children}</div>
}

export function BoolSelect({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  const t = useT('admin')
  return (
    <select style={inputStyle} value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}>
      <option value="">—</option>
      <option value="true">{t('minesecStats.oui')}</option>
      <option value="false">{t('minesecStats.non')}</option>
    </select>
  )
}
