export type TeacherSection =
  | 'dashboard' | 'classes' | 'attendance' | 'grades'
  | 'bulletins' | 'timetable' | 'resources' | 'sync'
  | 'pp-classe' | 'pp-appreciations'
  | 'ap-departement'
  | 'cahier-de-texte'
  | 'at-risk' | 'mon-suivi'
  | 'correction-anonyme'
  | 'mon-profil-rh' | 'notifications' | 'babillard' | 'messagerie'

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
  teacherProfile?: {
    id: string
    specialization: string[]
    teacherSubjects: { subject: { id: string; name: string } }[]
  } | null
  classesProfessorPrincipal?: { id: string; name: string; _count?: { students: number } }[]
  headedDepartments?: { id: string; name: string; color: string; subjects?: { id: string; name: string }[] }[]
}
