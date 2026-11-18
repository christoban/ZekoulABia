import { Smartphone, Mail, type LucideIcon } from 'lucide-react'

export interface ClassItem {
  id: string
  name: string
  level: string
}

export interface BroadcastTarget {
  role?: string
  classId?: string
  level?: string
  paymentStatus?: string
}

export interface BroadcastLog {
  id: string
  channel: string
  target: BroadcastTarget
  message: string
  recipientCount: number
  sentCount: number
  failedCount: number
  status: string
  createdAt: string
}

export interface PreviewData {
  total: number
  withPhone: number
  withEmail: number
}

export const CANAL_LABEL: Record<string, string> = {
  SMS: 'SMS',
  EMAIL: 'Email',
  BOTH: 'SMS & Email',
}

export const CANAL_ICON: Record<string, LucideIcon> = {
  SMS: Smartphone,
  EMAIL: Mail,
  BOTH: Smartphone,
}

export const STATUS_STYLE: Record<string, { color: string; bg: string; labelKey: string }> = {
  completed: { color: 'var(--green)', bg: 'var(--green-light)', labelKey: 'completed' },
  partial: { color: 'var(--amber)', bg: 'var(--amber-light)', labelKey: 'partial' },
  failed: { color: 'var(--red)', bg: 'var(--red-light)', labelKey: 'failed' },
}

// Options de <select> natif — pas d'icône possible dans un <option>, texte seul.
export const ROLE_OPTIONS = [
  { value: '', labelKey: 'empty' },
  { value: 'PARENT', labelKey: 'parent' },
  { value: 'STUDENT', labelKey: 'student' },
  { value: 'TEACHER', labelKey: 'teacher' },
  { value: 'STAFF', labelKey: 'staff' },
]

export const PAYMENT_OPTIONS = [
  { value: '', labelKey: 'empty' },
  { value: 'OVERDUE', labelKey: 'overdue' },
  { value: 'PENDING', labelKey: 'pending' },
  { value: 'PARTIAL', labelKey: 'partial' },
  { value: 'PAID', labelKey: 'paid' },
]

export const VARIABLES = ['{nom_eleve}', '{classe}', '{solde}']

export function targetSummary(target: BroadcastTarget, translate: (key: string) => string): string {
  const parts: string[] = []
  if (target.role) parts.push(translate(`communications.target_role.${target.role}`))
  if (target.classId) parts.push(translate('communications.target_class'))
  if (target.level) parts.push(translate('communications.target_level').replace('{level}', target.level))
  if (target.paymentStatus) parts.push(translate(`communications.target_payment.${target.paymentStatus}`))
  return parts.join(' · ') || '—'
}
