import type { LucideIcon } from 'lucide-react'
import { School, Presentation, Users, GraduationCap, Search } from 'lucide-react'

export type SuccessInfo = {
  icon: LucideIcon
  badge: string
  color: string
  bg: string
  dest: string
  firstName: string
}

export const ROLE_CONFIG: Record<string, Omit<SuccessInfo, 'firstName'>> = {
  ADMIN: { icon: School, badge: 'Administrateur', color: 'var(--primary)', bg: 'var(--primary-light)', dest: '/admin/dashboard' },
  TEACHER: { icon: Presentation, badge: 'Enseignant', color: 'var(--blue)', bg: 'var(--blue-light)', dest: '/teacher/dashboard' },
  PARENT: { icon: Users, badge: 'Parent', color: 'var(--amber)', bg: 'var(--amber-light)', dest: '/parent/dashboard' },
  STUDENT: { icon: GraduationCap, badge: 'Élève', color: 'var(--purple)', bg: 'var(--purple-light)', dest: '/student/dashboard' },
  STAFF: { icon: Search, badge: 'Staff', color: 'var(--primary)', bg: 'var(--primary-light)', dest: '/staff/dashboard' },
}

export type AccountChoice = {
  userId: string
  schoolId: string
  role: string
  schoolName: string
  nomComplet: string
}

export type LoginStep = 'credentials' | 'choose_account' | 'email_otp' | 'totp' | 'mfa_setup'

export type LoginData = {
  role: string
  nomComplet: string
  userId: string
  permissions: string[]
  roleMismatch: boolean
  mustChangePassword?: boolean
  redirectTo?: string | null
}

export type InactiveUserInfo = {
  userId: string
  nomComplet: string
  role: string
  dest: string
}

export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return (local?.[0] ?? '') + '***@' + (domain ?? '')
}

export function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--accent)'
  e.target.style.boxShadow = '0 0 0 3px rgba(227, 176, 75, 0.2)'
}

export function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--border)'
  e.target.style.boxShadow = 'none'
}
