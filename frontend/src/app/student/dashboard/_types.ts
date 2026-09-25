export type StudentSection = 'dashboard' | 'grades' | 'bulletins' | 'timetable' | 'attendance' | 'library' | 'health-tracking' | 'notifications' | 'babillard' | 'messagerie' | 'academic-profile'

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export interface UserInfo {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
   studentProfile?: {
     id: string
     class: {
       id: string
       name: string
     }
     groupIds?: string[]
   } | null
}
