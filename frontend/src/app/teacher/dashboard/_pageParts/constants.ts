import type { TeacherSection } from '../_types'

export interface SessionUser {
  userId: string
  role: string
  nomComplet?: string
  firstName?: string
  permissions?: string[]
}

export const TEACHER_SECTIONS: TeacherSection[] = [
  'dashboard', 'classes', 'attendance', 'grades', 'bulletins', 'timetable', 'sync',
  'pp-classe', 'pp-appreciations', 'ap-departement', 'cahier-de-texte', 'at-risk', 'mon-suivi',
  'correction-anonyme',
  'mon-profil-rh', 'notifications', 'babillard', 'carnet-liaison', 'messagerie',
]

export const TEACHER_ASSISTANT_SUGGESTIONS = [
  'Donne 15 à Jean Dupont en maths pour la 4eA',
  'Marque Awa absente aujourd’hui en 3eB',
  'Quelle est la moyenne de ma 4eA en maths ?',
]

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export function getTeacherTitles(tnav: TranslateFn): Record<TeacherSection, string> {
  return {
    dashboard: tnav('pageTitle.teacher_dashboard'),
    classes: tnav('pageTitle.teacher_classes'),
    attendance: tnav('pageTitle.teacher_attendance'),
    grades: tnav('pageTitle.teacher_grades'),
    bulletins: tnav('pageTitle.teacher_bulletins'),
    timetable: tnav('pageTitle.teacher_timetable'),
    sync: tnav('pageTitle.teacher_sync'),
    'pp-classe': tnav('pageTitle.teacher_ppClasse'),
    'pp-appreciations': tnav('pageTitle.teacher_ppAppreciations'),
    'ap-departement': tnav('pageTitle.teacher_apDepartement'),
    'cahier-de-texte': tnav('pageTitle.teacher_cahierDeTexte'),
    'at-risk': tnav('pageTitle.teacher_atRisk'),
    'mon-suivi': tnav('pageTitle.teacher_monSuivi'),
    'correction-anonyme': tnav('pageTitle.teacher_correctionAnonyme'),
    'mon-profil-rh': tnav('sidebar.monProfilRH'),
    notifications: tnav('pageTitle.teacher_notifications'),
    babillard: tnav('sidebar.babillard'),
    'carnet-liaison': tnav('sidebar.carnetLiaison'),
    messagerie: tnav('sidebar.messagerie'),
  }
}
