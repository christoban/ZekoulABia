'use client'

import { Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

export function ActiveStatusPill({ active, pillRadius = 12 }: { active: boolean; pillRadius?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: pillRadius === 999 ? '2px 8px' : '3px 8px',
        borderRadius: pillRadius,
        fontSize: 11,
        fontWeight: pillRadius === 999 ? 800 : 700,
        background: active ? 'var(--green-light)' : 'var(--red-light)',
        color: active ? 'var(--green)' : 'var(--red)',
      }}
    >
      {active ? 'Actif' : 'Inactif'}
    </span>
  )
}

export function MobileEmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      {message}
    </div>
  )
}

export function DesktopEmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
        {message}
      </td>
    </tr>
  )
}

export function ReferentielTableHead({ columns }: { columns: { label: string; alignRight?: boolean }[] }) {
  return (
    <thead>
      <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
        {columns.map(col => (
          <th key={col.label} style={{ padding: '10px 16px', textAlign: col.alignRight ? 'right' : undefined }}>
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  )
}

export function RowActionButtons({
  onEdit,
  onDelete,
  onToggle,
  active,
  mobile,
}: {
  onEdit: () => void
  onDelete?: () => void
  onToggle?: () => void
  active?: boolean
  mobile?: boolean
}) {
  if (mobile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '5px 8px', display: 'inline-flex', alignItems: 'center' }}
          >
            {active ? <ToggleRight size={16} color="var(--green)" /> : <ToggleLeft size={16} color="var(--text3)" />}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700 }}
        >
          <Edit2 size={12} /> Modifier
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            style={{ background: 'var(--red-light)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--red)', display: 'inline-flex', alignItems: 'center' }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          title={active ? 'Désactiver' : 'Activer'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4 }}
        >
          {active ? <ToggleRight size={18} color="var(--green)" /> : <ToggleLeft size={18} color="var(--text3)" />}
        </button>
      )}
      <button
        type="button"
        onClick={onEdit}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}
      >
        <Edit2 size={13} />
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          style={{ background: 'var(--red-light)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--red)' }}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}
