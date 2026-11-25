import type { AdminSection } from '../_types'

export const ADMIN_SECTIONS: AdminSection[] = [
  'dashboard', 'users', 'classes', 'subjects',
  'attendance', 'grades', 'bulletins', 'timetable',
  'council', 'academic-events', 'finance', 'ai', 'statistics', 'communications', 'babillard', 'carnet-liaison', 'messagerie', 'settings', 'corbeille', 'sync-offline',
  'bulletin-validation',
  'pedagogie', 'rh', 'lv2-choice', 'entrance-exams', 'pebs-exams', 'matricules', 'school-payments', 'eleve-onboarding', 'minesec-stats', 'minedub-stats', 'ministerial-stats', 'group-transfers',
  'org-pedagogy',
]

export interface SchoolInfo {
  id?: string
  name: string
  logoUrl: string | null
  subdomain?: string
  city?: string
  phone?: string
  email?: string
  isPrimaire?: boolean | null
}

export interface AdminBadges {
  users?: string
  classes?: string
  grades?: string
  finance?: string
  'eleve-onboarding'?: string
}

export interface SessionUser {
  id?: string
  userId?: string
  nomComplet?: string
  firstName?: string
  role?: string
  avatarUrl?: string | null
}
