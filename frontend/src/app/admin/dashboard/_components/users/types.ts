import {
  BookOpen,
  Compass,
  Eye,
  KeyRound,
  Package,
  School,
  Search,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { AdminSection } from '../../_types'

export interface SectionUsersProps {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: AdminSection) => void
}

export type StaffPermission =
  | 'MANAGE_TIMETABLE' | 'VALIDATE_GRADES' | 'MANAGE_EXAMS'
  | 'SUPERVISE_TEACHERS' | 'MANAGE_ATTENDANCE' | 'MANAGE_DISCIPLINE'
  | 'MANAGE_INCIDENTS' | 'MANAGE_FINANCE' | 'VALIDATE_PAYMENTS'
  | 'GENERATE_REPORTS' | 'MANAGE_ATELIERS' | 'MANAGE_PRACTICAL_GRADES'
  | 'MANAGE_INTERNSHIPS' | 'MANAGE_STAGE_CONVENTIONS' | 'MANAGE_WORKSHOP_STOCK'
  | 'MANAGE_CLASS_COUNCIL' | 'MANAGE_CATCHUP_REQUESTS'
  | 'VIEW_DEPARTMENT_GRADES' | 'SUPERVISE_DEPARTMENT_TEACHERS'
  | 'VALIDATE_DEPARTMENT_TIMETABLE' | 'GENERATE_DEPARTMENT_REPORTS'
  | 'VIEW_SUPERVISED_GRADES' | 'SUPERVISE_LESSON_PLANS'
  | 'GENERATE_PEDAGOGICAL_REPORTS' | 'MANAGE_CE_REPORTS' | 'MANAGE_PEDAGOGICAL_BRIEF'
  | 'MANAGE_PATRIMOINE' | 'MANAGE_DEGRADATIONS' | 'MANAGE_LIBRARY' | 'MANAGE_ORIENTATION'

export type StaffTitle = {
  key: string
  label: string
  permissions: StaffPermission[]
}

export interface UserItem {
  id: string
  firstName: string
  lastName: string
  email: string | null
  role: string
  avatarUrl?: string | null
  studentStatus?: string | null
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  studentProfile: {
    id?: string
    class: { name: string } | null
    dateOfBirth: string | null
    gender: string | null
    photoUrl?: string | null
    matricule?: string | null
  } | null
  staffProfile: { title: string } | null
  classesProfessorPrincipal?: { id: string; name: string }[]
}

export interface InviteForm {
  firstName: string
  lastName: string
  email: string
  role: string
  selectedTitles: string[]
  customPerms: StaffPermission[]
  showCustomPerms: boolean
  loading: boolean
  error: string
  tempPassword: string
}

export interface ClassItem {
  id: string
  name: string
  cycle?: string | null
}

export interface SubjectOption {
  id: string
  name: string
}

export interface StudioStudent {
  id: string
  name?: string
  matricule?: string | null
  photoUrl?: string | null
}

export interface RoleLabelStyle {
  label: string
  bg: string
  color: string
}

export const EMPTY_INVITE_FORM: InviteForm = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'TEACHER',
  selectedTitles: [],
  customPerms: [],
  showCustomPerms: false,
  loading: false,
  error: '',
  tempPassword: '',
}

export const ROLE_TAB_CODES = ['', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF'] as const

export function iconForTitle(key: string): LucideIcon {
  if (key.includes('Censeur') || key.includes('Vice-Principal') || key.includes('Deputy Head') || key.includes('Directeur Adjoint')) return Search
  if (key.includes('Surveillant') || key.includes('Discipline')) return Eye
  if (key.includes('Intendant') || key.includes('Économe') || key.includes('Bursar')) return Wallet
  if (key.includes('Chef des Travaux')) return Wrench
  if (key.includes('Documentaliste') || key.includes('Librarian')) return BookOpen
  if (key.includes('Orientation') || key.includes('Counsellor') || key.includes('Pédagogique')) return Compass
  if (key.includes('Comptable') || key.includes('Matières')) return Package
  if (key.includes('HOD') || key.includes('Animateur')) return School
  return KeyRound
}

export function mergePermissions(selectedTitles: string[], customPerms: StaffPermission[], titles: StaffTitle[]): StaffPermission[] {
  const set = new Set<StaffPermission>(customPerms)
  for (const tk of selectedTitles) {
    const title = titles.find(t => t.key === tk)
    title?.permissions.forEach(p => set.add(p))
  }
  return Array.from(set)
}

const AVATAR_COLORS = ['var(--green)', 'var(--blue)', 'var(--amber)', 'var(--primary)', 'var(--purple)', 'var(--orange)']

export function avatarColorFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
