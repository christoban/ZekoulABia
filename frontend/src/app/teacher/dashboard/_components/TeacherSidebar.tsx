'use client'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, School, ClipboardCheck, FileText, Calendar,
  NotebookPen, FolderOpen, IdCard, ClipboardList, PenLine, Target, RefreshCw,
  AlertTriangle, ListChecks, Megaphone, MessageCircle,
  ScanSearch,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import { useUnreadBabillardCount } from '@/hooks/useUnreadBabillardCount'
import { AppSidebarDrawer } from '@/components/shell/AppSidebarDrawer'
import type { TeacherSection, UserInfo } from '../_types'

interface NavItem {
  id: TeacherSection
  icon: LucideIcon
  label: string
  badge?: string
  badgeColor?: 'red' | 'green' | 'amber'
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

// ==========================================================================
// CONFIGURATION DU MENU DE NAVIGATION (BARRE LATÉRALE ENSEIGNANT)
// Pour ajouter, retirer ou modifier un onglet du menu enseignant :
// - Modifiez les groupes ci-dessous ('classes', 'grades', 'attendance', etc.)
// - 'id'   : identifiant de l'écran (TeacherSection dans '../_types.ts')
// - 'icon' : icône importée de lucide-react
// - 'label': titre affiché dans le menu
// ==========================================================================
function buildNav(user: UserInfo | null | undefined, pendingGrades: number | undefined, messagesNonLus: number, babillardNonLus: number, tnav: ReturnType<typeof useT>, tcommon: ReturnType<typeof useT>): NavGroup[] {
  const groups: NavGroup[] = [
    {
      items: [{ id: 'dashboard', icon: LayoutDashboard, label: tnav('sidebar.dashboard') }],
    },
    {
      label: tnav('group.academic'),
      items: [
        { id: 'classes', icon: School, label: tnav('sidebar.myClasses') },
        { id: 'attendance', icon: ClipboardCheck, label: tnav('sidebar.attendance') },
        { id: 'grades', icon: FileText, label: tnav('sidebar.grades'), ...(pendingGrades ? { badge: String(pendingGrades), badgeColor: 'red' as const } : {}) },
        { id: 'timetable', icon: Calendar, label: tnav('sidebar.timetable') },
        { id: 'correction-anonyme', icon: ScanSearch, label: tnav('sidebar.correctionAnonyme') },
      ],
    },
    {
      label: tnav('group.pedagogie'),
      items: [
        { id: 'cahier-de-texte', icon: NotebookPen, label: tnav('sidebar.cahierDeTexte') },
        { id: 'at-risk', icon: AlertTriangle, label: tnav('sidebar.atRiskStudents') },
        { id: 'mon-suivi', icon: ListChecks, label: tnav('sidebar.monSuivi') },
      ],
    },
    {
      label: tnav('group.communication'),
      items: [
        { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard'), ...(babillardNonLus > 0 ? { badge: String(babillardNonLus), badgeColor: 'amber' as const } : {}) },
        { id: 'carnet-liaison', icon: NotebookPen, label: tnav('sidebar.carnetLiaison') },
        { id: 'messagerie', icon: MessageCircle, label: tnav('sidebar.messagerie'), ...(messagesNonLus > 0 ? { badge: String(messagesNonLus), badgeColor: 'red' as const } : {}) },
      ],
    },
    // notifications retiré de la sidebar — redondant avec la cloche (permanente sur tous les
    // écrans), qui offre désormais un lien « Voir tout » vers cette même page.
    {
      label: tnav('group.moncompte'),
      items: [
        { id: 'mon-profil-rh', icon: IdCard, label: tnav('sidebar.monProfilRH') },
      ],
    },
  ]

  const ppClasses = user?.classesProfessorPrincipal ?? []
  if (ppClasses.length > 0) {
    const classLabel = ppClasses.length === 1
      ? `${tnav('sidebar.myClass')} · ${ppClasses[0]!.name}`
      : `${tnav('sidebar.myClass')} (${ppClasses.length})`
    groups.push({
      label: tnav('group.pp'),
      items: [
        { id: 'pp-classe', icon: ClipboardList, label: classLabel },
        { id: 'pp-appreciations', icon: PenLine, label: tnav('sidebar.appreciations') },
      ],
    })
  }

  const depts = user?.headedDepartments ?? []
  if (depts.length > 0) {
    groups.push({
      label: tnav('group.ap'),
      items: depts.map(d => ({ id: 'ap-departement' as TeacherSection, icon: Target, label: d.name })),
    })
  }

  return groups
}

const BADGE_STYLES = {
  red: 'bg-red-500/25 text-red-300',
  green: 'bg-success/20 text-success',
  amber: 'bg-amber-500/20 text-amber-300',
}

export default function TeacherSidebar({
  current, onChange, schoolName, logoUrl, onLogout, user, pendingGrades, pendingCount, mobileOpen = false, onMobileClose,
}: {
  current: TeacherSection
  onChange: (s: TeacherSection) => void
  schoolName?: string
  logoUrl?: string | null
  onLogout?: () => void
  user?: UserInfo | null
  pendingGrades?: number
  pendingCount?: number
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const messagesNonLus = useUnreadMessagesCount()
  const babillardNonLus = useUnreadBabillardCount()
  const userDisplayName = user ? `${user.firstName} ${user.lastName}` : tcommon('user.loading')
  const userInitials = user ? (user.firstName[0] || '') + (user.lastName[0] || '') : '??'

  const nav = buildNav(user, pendingGrades, messagesNonLus, babillardNonLus, tnav, tcommon)
  const handleChange = (id: TeacherSection) => { onChange(id); onMobileClose?.() }

  return (
    <AppSidebarDrawer
      roleBrandLabel={tcommon('brand.roleTeacher')}
      schoolName={schoolName}
      schoolLogoUrl={logoUrl}
      userDisplayName={userDisplayName}
      userInitials={userInitials}
      userSubtitle={user?.role || tcommon('user.teacherFallback')}
      userAvatarUrl={user?.avatarUrl}
      userAvatarGradient="from-[var(--blue)] to-[var(--purple)]"
      onLogout={onLogout}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
    >
      <nav className="h-full overflow-y-auto px-1 py-1">
        {nav.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="text-[10px] font-black text-white/35 tracking-[1px] uppercase" style={{ padding: '6px 0 2px 0' }}>
                {group.label}
              </div>
            )}
            {group.items.map(item => (
              <button key={`${gi}-${item.id}`} onClick={() => handleChange(item.id)}
                className={cn(
                  'relative w-full flex items-center gap-2.5 rounded-md mb-[2px]',
                  'text-[12px] font-semibold text-left border-none cursor-pointer font-nunito',
                  current === item.id
                    ? 'text-accent'
                    : 'text-white/55 hover:bg-[var(--sidebar2)] hover:text-white/85'
                )}
                style={{ padding: '6px 8px' }}>
                {current === item.id && (
                  <motion.div layoutId="teacher-nav-active"
                    className="absolute inset-0 rounded-md bg-accent/15"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10 w-[18px] flex items-center justify-center flex-shrink-0">
                  <item.icon size={16} strokeWidth={2} />
                </span>
                <span className="relative z-10 truncate flex-1">{item.label}</span>
                {item.badge && item.badgeColor && (
                  <span className={cn('relative z-10 ml-auto text-[10.5px] font-black rounded', BADGE_STYLES[item.badgeColor])} style={{ padding: '1px 5px' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}

        {/* Synchronisation */}
        {pendingCount != null && pendingCount > 0 && (
          <div>
            <div className="text-[10px] font-black text-white/35 tracking-[1px] uppercase" style={{ padding: '6px 0 2px 0' }}>
              {tnav('sidebar.sync')}
            </div>
            <button onClick={() => handleChange('sync')}
              className={cn(
                'relative w-full flex items-center gap-2.5 rounded-md mb-[2px]',
                'text-[12px] font-semibold text-left border-none cursor-pointer font-nunito',
                current === 'sync' ? 'text-accent' : 'text-white/55 hover:bg-[var(--sidebar2)] hover:text-white/85'
              )}
              style={{ padding: '6px 8px' }}>
              {current === 'sync' && (
                <motion.div layoutId="teacher-nav-active"
                  className="absolute inset-0 rounded-md bg-accent/15"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
              )}
              <span className="relative z-10 w-[18px] flex items-center justify-center flex-shrink-0">
                <RefreshCw size={16} strokeWidth={2} />
              </span>
              <span className="relative z-10 truncate flex-1">{tnav('sidebar.sync')}</span>
              <span className={cn('relative z-10 ml-auto text-[10.5px] font-black rounded', BADGE_STYLES.amber)} style={{ padding: '1px 5px' }}>
                {pendingCount}
              </span>
            </button>
          </div>
        )}
      </nav>
    </AppSidebarDrawer>
  )
}
