'use client'

import type React from 'react'

export function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
        {msg}
      </td>
    </tr>
  )
}

export function MobileEmpty({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      {msg}
    </div>
  )
}

export function MobileLogRow({ badge, date, primary, secondary, tertiary, last }: {
  badge: React.ReactNode
  date: string
  primary: React.ReactNode
  secondary?: string
  tertiary?: string
  last: boolean
}) {
  return (
    <div style={{
      padding: '11px 14px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>{badge}</div>
        <span style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{date}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word', lineHeight: 1.4 }}>
        {primary}
      </div>
      {secondary && (
        <div style={{ fontSize: 11.5, color: 'var(--text2)', wordBreak: 'break-word' }}>{secondary}</div>
      )}
      {tertiary && (
        <div style={{ fontSize: 11.5, color: 'var(--text3)', wordBreak: 'break-word', fontStyle: 'italic' }}>{tertiary}</div>
      )}
    </div>
  )
}
