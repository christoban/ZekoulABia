'use client'
import { motion } from 'framer-motion'
import { LayoutDashboard, FileText, ScrollText, Calendar, ClipboardCheck, BookOpen, HeartPulse, Megaphone, MessageCircle, BarChart3, NotebookPen, Compass, FileBadge, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import { useUnreadBabillardCount } from '@/hooks/useUnreadBabillardCount'
import { AppSidebarDrawer } from '@/components/shell/AppSidebarDrawer'
import { resolveOrientationEligibility } from '@/lib/orientationEligibility'
import type { StudentSection, UserInfo } from '../_types'

interface NavItem {
  id: StudentSection
  icon: LucideIcon
  label: string
  badge?: string
  badgeColor?: 'red' | 'green' | 'amber'
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

const BADGE_STYLES = {
  red: 'bg-red-500/25 text-red-300',
  green: 'bg-success/20 text-success',
  amber: 'bg-amber-500/20 text-amber-300',
}

export default function StudentSidebar({ current, onChange, schoolName, logoUrl, onLogout, user, mobileOpen = false, onMobileClose }: {
  current: StudentSection
  onChange: (s: StudentSection) => void
  schoolName?: string
  logoUrl?: string | null
  onLogout?: () => void
  user?: UserInfo | null
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const messagesNonLus = useUnreadMessagesCount()
  const babillardNonLus = useUnreadBabillardCount()

  const orientationElig = resolveOrientationEligibility(
    user?.studentProfile?.class?.name,
    user?.studentProfile?.class?.level,
    user?.studentProfile?.class?.serie
  )

  // ==========================================================================
  // CONFIGURATION DU MENU DE NAVIGATION (BARRE LATÉRALE ÉLÈVE)
  // Pour ajouter, retirer, réordonner ou changer un onglet de l'espace élève :
  // - Modifiez les éléments ci-dessous ('dashboard', 'homework', 'grades', etc.)
  // - 'id'   : identifiant de l'écran (StudentSection dans '../_types.ts')
  // - 'icon' : icône importée de lucide-react
  // - 'label': titre affiché dans le menu
  // ==========================================================================
  const NAV: NavGroup[] = [
    {
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: tnav('sidebar.dashboard') },
      ]
    },
    {
      label: tnav('group.schoolAgenda'),
      items: [
        { id: 'homework', icon: NotebookPen, label: tnav('sidebar.homework') || 'Cahier & Devoirs' },
        { id: 'timetable', icon: Calendar, label: tnav('sidebar.timetable') },
        { id: 'attendance', icon: ClipboardCheck, label: tnav('sidebar.myAttendance') },
      ]
    },
    {
      label: tnav('group.results'),
      items: [
        { id: 'grades', icon: FileText, label: tnav('sidebar.myGrades') },
        { id: 'bulletins', icon: ScrollText, label: tnav('sidebar.bulletins') },
        { id: 'academic-profile', icon: BarChart3, label: tnav('sidebar.academicProfile') },
        ...(orientationElig.isEligible ? [
          { id: 'orientation' as const, icon: Compass, label: tnav('sidebar.orientation') || 'Orientation' }
        ] : []),
        { id: 'health-tracking', icon: HeartPulse, label: tnav('sidebar.myHealthTracking') },
      ]
    },
    {
      label: tnav('group.services'),
      items: [
        { id: 'profile', icon: UserCheck, label: 'Mon Dossier & Profil' },
        { id: 'documents', icon: FileBadge, label: tnav('sidebar.documents') || 'Mes Documents' },
        { id: 'library', icon: BookOpen, label: tnav('sidebar.myLibrary') },
        { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard'), ...(babillardNonLus > 0 ? { badge: String(babillardNonLus), badgeColor: 'amber' as const } : {}) },
        { id: 'messagerie', icon: MessageCircle, label: tnav('sidebar.messagerie'), ...(messagesNonLus > 0 ? { badge: String(messagesNonLus), badgeColor: 'red' as const } : {}) },
      ]
    },
  ]

  const className = user?.studentProfile?.class?.name || ''
  const userDisplayName = user ? `${user.firstName} ${user.lastName}` : tcommon('user.loading')
  const userInitials = user ? (user.firstName[0] || '') + (user.lastName[0] || '') : '??'
  const handleChange = (id: StudentSection) => { onChange(id); onMobileClose?.() }

  return (
    <AppSidebarDrawer
      roleBrandLabel={tcommon('brand.roleStudent')}
      schoolName={schoolName}
      schoolLogoUrl={logoUrl}
      userDisplayName={userDisplayName}
      userInitials={userInitials}
      userSubtitle={`${tcommon('user.studentFallback')}${className ? ` · ${className}` : ''}`}
      userAvatarUrl={user?.avatarUrl}
      userAvatarGradient="from-[var(--purple)] to-[var(--blue)]"
      onLogout={onLogout}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
    >
      <nav className="h-full overflow-y-auto px-1 py-1">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="text-[10px] font-black text-white/35 tracking-[1px] uppercase" style={{ padding: '6px 0 0 0' }}>
                {group.label}
              </div>
            )}
            {group.items.map(item => (
              <button key={item.id} onClick={() => handleChange(item.id)}
                className={cn(
                  'relative w-full flex items-center gap-2.5 rounded-lg mb-[2px]',
                  'text-[12px] font-semibold text-left border-none cursor-pointer font-nunito',
                  current === item.id
                    ? 'text-accent'
                    : 'text-white/55 hover:bg-[var(--sidebar2)] hover:text-white/85'
                )}
                style={{ padding: '6px 8px' }}>
                {current === item.id && (
                  <motion.div layoutId="student-nav-active"
                    className="absolute inset-0 rounded-lg bg-accent/15"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10 w-[18px] flex items-center justify-center flex-shrink-0">
                  <item.icon size={16} strokeWidth={2} />
                </span>
                <span className="relative z-10 truncate flex-1">{item.label}</span>
                {item.badge && (
                  <span className={cn('relative z-10 ml-auto text-[10.5px] font-black rounded', BADGE_STYLES[item.badgeColor ?? 'red'])} style={{ padding: '1px 5px' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </AppSidebarDrawer>
  )
}
