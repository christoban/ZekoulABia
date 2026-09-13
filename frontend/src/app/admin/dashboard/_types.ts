export type AdminSection =
  | 'dashboard' | 'users' | 'classes' | 'subjects'
  | 'attendance' | 'grades' | 'bulletins' | 'timetable'
  | 'council' | 'academic-year' | 'academic-events' | 'finance' | 'ai' | 'statistics' | 'communications' | 'babillard' | 'messagerie' | 'settings'
  | 'bulletin-validation'
  | 'sync-offline'
  | 'pedagogie' | 'rh' | 'lv2-choice' | 'entrance-exams' | 'pebs-exams' | 'matricules' | 'school-payments' | 'eleve-onboarding' | 'minesec-stats' | 'minedub-stats' | 'notifications' | 'group-transfers' | 'corbeille' | 'tasks'
  | 'org-pedagogy'

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}
