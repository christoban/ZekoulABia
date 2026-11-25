'use client'
import { motion } from 'framer-motion'
import { Users, FileText, ClipboardCheck, Calendar, Smartphone, BookOpen, Settings, HandCoins, Megaphone, MessageCircle, BookMarked, FileCheck, HeartPulse, TrendingUp, User, NotebookPen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import { useUnreadBabillardCount } from '@/hooks/useUnreadBabillardCount'
import { AppSidebarDrawer } from '@/components/shell/AppSidebarDrawer'
import type { ParentSection } from '../_types'

interface NavItem {
  id: ParentSection
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

interface UserInfo { id: string; firstName: string; lastName: string; role: string; avatarUrl?: string | null }
interface SchoolInfo { name: string; logoUrl: string | null }

export default function ParentSidebar({ current, onChange, onLogout, user, school, mobileOpen = false, onMobileClose }: {
  current: ParentSection
  onChange: (s: ParentSection) => void
  onLogout?: () => void
  user?: UserInfo | null
  school?: SchoolInfo | null
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const messagesNonLus = useUnreadMessagesCount()
  const babillardNonLus = useUnreadBabillardCount()

  // ==========================================================================
  // CONFIGURATION DU MENU DE NAVIGATION (BARRE LATÉRALE PARENT)
  // Pour ajouter, retirer ou modifier un onglet du menu parent :
  // - Modifiez les groupes ci-dessous ('children', 'grades', 'payments', etc.)
  // - 'id'   : identifiant de l'écran (ParentSection dans '../_types.ts')
  // - 'icon' : icône importée de lucide-react
  // - 'label': titre affiché dans le menu
  // ==========================================================================
  const NAV_GROUPS: NavGroup[] = [
    {
      items: [
        { id: 'children', icon: Users, label: tnav('sidebar.myChildren') },
        { id: 'child-profile', icon: User, label: tnav('sidebar.parent_childProfile') },
      ]
    },
    {
      label: tnav('group.academic'),
      items: [
        { id: 'grades', icon: FileText, label: tnav('sidebar.grades') },
        { id: 'academic-profile', icon: TrendingUp, label: tnav('sidebar.parent_academicProfile') },
        { id: 'health-tracking', icon: HeartPulse, label: tnav('sidebar.parent_healthTracking') },
        { id: 'attendance', icon: ClipboardCheck, label: tnav('sidebar.attendance') },
        { id: 'homework', icon: BookMarked, label: tnav('sidebar.parent_homework') },
        { id: 'timetable', icon: Calendar, label: tnav('sidebar.timetable') },
        { id: 'documents', icon: FileCheck, label: tnav('sidebar.parent_documents') },
      ]
    },
    {
      label: tnav('group.services'),
      items: [
        { id: 'payments', icon: Smartphone, label: tnav('sidebar.payments') },
        { id: 'apee', icon: HandCoins, label: tnav('sidebar.apee') },
        { id: 'library', icon: BookOpen, label: tnav('sidebar.readings') },
        { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard'), ...(babillardNonLus > 0 ? { badge: String(babillardNonLus), badgeColor: 'amber' as const } : {}) },
        { id: 'carnet-liaison', icon: NotebookPen, label: tnav('sidebar.carnetLiaison') },
        { id: 'messagerie', icon: MessageCircle, label: tnav('sidebar.messagerie'), ...(messagesNonLus > 0 ? { badge: String(messagesNonLus), badgeColor: 'red' as const } : {}) },
        // notifications retiré — redondant avec la cloche (permanente sur tous les écrans),
        // qui offre désormais un lien « Voir tout » vers cette même page.
        { id: 'settings', icon: Settings, label: tnav('sidebar.settings') },
      ]
    },
  ]

  const userDisplayName = user ? `${user.firstName} ${user.lastName}` : tcommon('user.loading')
  const userInitials = user ? (user.firstName[0] ?? '') + (user.lastName[0] ?? '') : tcommon('brand.fallbackInitials')

  const handleChange = (id: ParentSection) => { onChange(id); onMobileClose?.() }

  return (
    <AppSidebarDrawer
      roleBrandLabel={tcommon('brand.roleParent')}
      schoolName={school?.name}
      schoolLogoUrl={school?.logoUrl}
      schoolInitialsFallback={tcommon('brand.fallbackInitials')}
      userDisplayName={userDisplayName}
      userInitials={userInitials}
      userSubtitle={tcommon('user.parentFallback')}
      userAvatarUrl={user?.avatarUrl}
      userAvatarGradient="from-[var(--amber)] to-[var(--orange)]"
      onLogout={onLogout}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
    >
      <nav className="h-full overflow-y-auto px-1 py-1">
        {NAV_GROUPS.map((group, gi) => (
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
                  <motion.div layoutId="parent-nav-active"
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
