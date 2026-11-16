export type DecisionValue = 'PASS' | 'REPEAT' | 'DELIBERATION'

export interface CouncilSession {
  id: string
  status: 'OPEN' | 'LOCKED'
  createdAt: string
  validatedAt: string | null
  class: { id: string; name: string }
  academicPeriod: { id: string; name: string }
  _count: { decisions: number }
  publishedCount?: number
}

export interface CouncilDecision {
  studentId: string
  decision: string
  observations: string | null
  student: { id: string; firstName: string; lastName: string }
  healthScore?: number
  alertLevel?: 'critical' | 'warning' | null
}

export interface CouncilSessionDetail {
  id: string
  status: string
  class: { id: string; name: string }
  academicPeriod: { id: string; name: string }
  presidedBy: { id: string; firstName: string; lastName: string } | null
  decisions: CouncilDecision[]
}

export const DEC_COLOR: Record<string, { color: string; bg: string }> = {
  PASS: { color: 'var(--green)', bg: 'var(--green-light)' },
  REPEAT: { color: 'var(--red)', bg: 'var(--red-light)' },
  DELIBERATION: { color: 'var(--amber)', bg: 'var(--amber-light)' },
}

