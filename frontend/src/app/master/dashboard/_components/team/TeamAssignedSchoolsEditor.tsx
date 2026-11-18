'use client'

import { useT } from '@/lib/i18n'
import type { SchoolRow } from '../../_types'

interface Props {
  memberName: string
  schools: SchoolRow[]
  selectedIds: string[]
  busy: boolean
  onToggleSchool: (schoolId: string, checked: boolean) => void
  onCancel: () => void
  onSave: () => void
}

/** Éditeur multi-sélection des établissements assignés à un opérateur */
export default function TeamAssignedSchoolsEditor({
  memberName,
  schools,
  selectedIds,
  busy,
  onToggleSchool,
  onCancel,
  onSave,
}: Props) {
  const t = useT('master')

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
        {t('team.assign_schools_label', { name: memberName })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 140, overflowY: 'auto' }}>
        {schools
          .filter((s) => s.subdomain !== 'system' && !s.subdomain.startsWith('fixture-'))
          .map((s) => {
            const checked = selectedIds.includes(s.id)
            return (
              <label
                key={s.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 9px',
                  borderRadius: 6,
                  border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                  background: checked ? 'var(--green-light)' : 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggleSchool(s.id, e.target.checked)}
                />
                {s.name}
              </label>
            )
          })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg2)',
            color: 'var(--text)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('team.cancel')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('team.save')}
        </button>
      </div>
    </div>
  )
}
