import type { ChildWithStats, ReportCard } from '../../_types'

export interface GradesData {
  children: ChildWithStats[]
  bulletins: ReportCard[]
}

export interface SequenceItem {
  id: string
  name: string
  isCurrent: boolean
}

export interface ContinuousGradeItem {
  id: string
  value: number | null
  coefficient: number
  appreciation?: string | null
  subject?: { name: string } | null
}

export const MENTION_COLOR = (m: string | null): [string, string] => {
  const map: Record<string, [string, string]> = {
    TB: ['var(--green-light)', 'var(--green)'],
    B: ['var(--blue-light)', 'var(--blue)'],
    AB: ['var(--amber-light)', 'var(--amber)'],
    P: ['var(--orange-light)', 'var(--orange)'],
    I: ['var(--red-light)', 'var(--red)'],
  }
  return map[m ?? ''] ?? ['var(--bg2)', 'var(--text2)']
}

export const thSt: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--text3)',
  background: 'var(--bg2)',
  borderBottom: '1px solid var(--border)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
}

export const tdSt: React.CSSProperties = {
  padding: '8.5px 12px',
  fontSize: 12.5,
  color: 'var(--text2)',
  verticalAlign: 'middle',
}
