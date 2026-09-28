'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'

export type ImportRow = Record<string, string>

export interface ValidationIssue {
  field: string
  message: string
}

export interface ValidatedRow {
  ligne: number
  rawRow: ImportRow
  status: 'VALID' | 'WARNING' | 'ERROR'
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

interface Props {
  headers: string[]
  rows: ValidatedRow[]
  columnMapping: Record<string, string>
  onRowsChange: (rows: ImportRow[]) => void
}

const statusStyle = {
  VALID: { background: 'var(--green-light)', color: 'var(--green)' },
  WARNING: { background: 'var(--amber-light)', color: 'var(--amber)' },
  ERROR: { background: 'var(--red-light)', color: 'var(--red)' },
}

export default function ImportValidationGrid({ headers, rows, columnMapping, onRowsChange }: Props) {
  const t = useT('admin')
  const [editing, setEditing] = useState<{ row: number; header: string } | null>(null)
  const [editedRows, setEditedRows] = useState<Record<number, ImportRow>>({})

  useEffect(() => {
    setEditedRows({})
  }, [rows])

  const issuesFor = (row: ValidatedRow, header: string) => {
    const field = columnMapping[header]
    return [...row.errors, ...row.warnings].filter(issue =>
      issue.field === field || (issue.field === 'contact' && (field === 'email' || field === 'telephone')),
    )
  }

  const updateCell = (rowIndex: number, header: string, value: string) => {
    const targetField = columnMapping[header]
    const updatedRow = {
      ...(editedRows[rowIndex] ?? rows[rowIndex].rawRow),
      [header]: value,
      ...(targetField ? { [targetField]: value } : {}),
    }
    const nextEditedRows = { ...editedRows, [rowIndex]: updatedRow }
    setEditedRows(nextEditedRows)
    onRowsChange(rows.map((row, index) => nextEditedRows[index] ?? row.rawRow))
    setEditing(null)
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 720 }}>
        <thead>
          <tr style={{ background: 'var(--bg2)' }}>
            <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text2)' }}>#</th>
            <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text2)' }}>{t('users.import_modal.status')}</th>
            {headers.map(header => <th key={header} style={{ padding: '10px', textAlign: 'left', color: 'var(--text2)' }}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.ligne} style={{ borderTop: '1px solid var(--border)', background: statusStyle[row.status].background }}>
              <td style={{ padding: '9px 10px', color: 'var(--text3)' }}>{row.ligne}</td>
              <td style={{ padding: '9px 10px' }}>
                <span style={{ color: statusStyle[row.status].color, fontWeight: 800 }}>{t(`users.import_modal.status_${row.status.toLowerCase()}`)}</span>
              </td>
              {headers.map(header => {
                const issues = issuesFor(row, header)
                const isEditing = editing?.row === rowIndex && editing.header === header
                const value = editedRows[rowIndex]?.[header] ?? row.rawRow[header] ?? (columnMapping[header] ? row.rawRow[columnMapping[header]] : undefined) ?? ''
                return (
                  <td key={header} title={issues.map(issue => issue.message).join('\n')} style={{ padding: '6px 8px', minWidth: 120, verticalAlign: 'top' }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        defaultValue={value}
                        onBlur={event => updateCell(rowIndex, header, event.target.value)}
                        onKeyDown={event => { if (event.key === 'Enter') updateCell(rowIndex, header, event.currentTarget.value) }}
                        style={{ width: '100%', padding: '6px', border: `1px solid ${statusStyle[row.status].color}`, borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => issues.length > 0 && setEditing({ row: rowIndex, header })}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: issues.length > 0 ? 'text' : 'default', font: 'inherit', padding: 0, textAlign: 'left', width: '100%' }}
                      >
                        {value || '—'}
                        {issues.length > 0 && <div style={{ color: statusStyle[row.status].color, fontSize: 11, marginTop: 3 }}>{issues.map(issue => issue.message).join(' · ')}</div>}
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
