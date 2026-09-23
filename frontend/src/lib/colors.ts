/**
 * Couleurs ZekoulABia — utilisées dans les composants dynamiques
 * (avatars, badges colorés selon le rôle, etc.)
 */
export const BADGE_COLORS = {
  green: 'bg-[var(--green-light)] text-[var(--green2)]',
  blue: 'bg-[#dbeafe] text-[#1e40af]',
  teal: 'bg-[var(--green-light)] text-[#134e4a]',
  amber: 'bg-[#fef3c7] text-[#92400e]',
  red: 'bg-[#fee2e2] text-[#991b1b]',
  purple: 'bg-[#ede9fe] text-[#5b21b6]',
  orange: 'bg-[#ffedd5] text-[#9a3412]',
  gray: 'bg-slate-100 text-slate-500',
} as const

export const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'from-[#d97706] to-[#dc2626]',
  TEACHER: 'from-[#1d4ed8] to-[#7c3aed]',
  STUDENT: 'from-[var(--primary)] to-[#1d4ed8]',
  PARENT: 'from-[var(--primary)] to-[var(--primary)]',
  STAFF: 'from-[#7c3aed] to-[#db2777]',
}

export type BadgeColor = keyof typeof BADGE_COLORS
