export type AdminSection =
  | 'dashboard' | 'users' | 'classes' | 'subjects'
  | 'attendance' | 'grades' | 'bulletins' | 'timetable'
  | 'council' | 'academic-events' | 'finance' | 'ai' | 'statistics' | 'communications' | 'babillard' | 'messagerie' | 'settings'
  | 'bulletin-validation'
  | 'sync-offline'
  | 'pedagogie' | 'rh' | 'lv2-choice' | 'entrance-exams' | 'pebs-exams' | 'matricules' | 'school-payments' | 'eleve-onboarding' | 'minesec-stats' | 'minedub-stats' | 'ministerial-stats' | 'notifications' | 'group-transfers' | 'corbeille'
  | 'org-pedagogy'

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}
