export type StudentSection =
  | 'dashboard'
  | 'grades'
  | 'bulletins'
  | 'timetable'
  | 'attendance'
  | 'library'
  | 'health-tracking'
  | 'notifications'
  | 'babillard'
  | 'messagerie'
  | 'academic-profile'
  | 'homework'
  | 'orientation'
  | 'documents'
  | 'profile'

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
  avatarUrl?: string | null
  studentProfile?: {
    id: string
    matricule?: string | null
    numeroInterne?: string | null
    healthScore?: number | null
    pebsFiliere?: string | null
    lv2Subject?: { id: string; name: string } | null
    class: {
      id: string
      name: string
      level?: string | null
      serie?: string | null
      filiere?: string | null
    }
    groupIds?: string[]
  } | null
}
