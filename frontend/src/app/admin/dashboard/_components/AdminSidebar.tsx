'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, LayoutDashboard, Users, School, BookOpen, ClipboardCheck, FileText,
  ScrollText, Calendar, GraduationCap, NotebookPen, Briefcase, CalendarDays,
  Smartphone, IdCard, Wallet, ClipboardEdit, UserPlus, BarChart3, ClipboardList,
  Globe, Languages, Bot, Megaphone, Settings, CalendarClock, X, ArrowRightLeft, Trash2,
  RefreshCw, MessageCircle, ListChecks, ChevronDown, ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import type { AdminSection } from '../_types'

interface NavItem {
  id: AdminSection
  icon: LucideIcon
  label: string
  badge?: string
  badgeColor?: 'red' | 'green' | 'amber'
}

interface NavSection {
  id?: string
  label?: string
  items: NavItem[]
}

const BADGE_STYLES = {
  red:   'bg-red-500/25 text-red-300',
  green: 'bg-green-500/20 text-green-300',
  amber: 'bg-amber-500/20 text-amber-300',
}

const DEFAULT_OPEN_GROUPS: Record<string, boolean> = {
  direction: true,
  org: false,
  supervision: false,
  pilotage: true,
  communication: false,
  system: false,
}

interface SessionUser {
  nomComplet?: string
  firstName?: string
  role?: string
}

interface Props {
  current: AdminSection
  onChange: (s: AdminSection) => void
  schoolName?: string
  logoUrl?: string | null
  badges?: Partial<Record<AdminSection, string>>
  sessionUser?: SessionUser | null
  onLogout?: () => void
  /** Types d'AcademicEvent actuellement actifs — masque les menus de fonctionnalités
   * événementielles (ex. 'lv2-choice') tant que la fonctionnalité réelle n'est pas ouverte. */
  activeEventTypes?: string[]
  /** Concours 6e / PEBS : pas de AcademicEvent dédié, gaté directement sur le statut réel de la
   * session (EntranceExamSession/PebsExamSession != CLOSED|APPLIED). */
  hasActiveEntranceExam?: boolean
  hasActivePebs?: boolean
  /** Transferts entrants du groupe scolaire en attente de validation — masqué tant qu'aucune
   * demande PENDING_TARGET_ADMIN ne cible cette école (même principe que entrance-exams/pebs). */
  hasPendingGroupTransfers?: boolean
  /** Type d'établissement (School.templateCode → getTemplateMeta().isPrimaire) — pilote
   * l'affichage de Statistiques MINESEC (secondaire) vs MINEDUB (maternelle/primaire).
   * undefined tant que /api/v2/school/me n'a pas répondu : les deux restent visibles le temps
   * du chargement plutôt que de risquer de tout masquer. */
  isPrimaire?: boolean | null
  /** Tiroir mobile (< 768px) — sidebar fixe cachée, remplacée par cet overlay contrôlé depuis page.tsx. */
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function AdminSidebar({ current, onChange, schoolName, logoUrl, badges = {}, sessionUser, onLogout, activeEventTypes = [], hasActiveEntranceExam = false, hasActivePebs = false, hasPendingGroupTransfers = false, isPrimaire, mobileOpen = false, onMobileClose }: Props) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const messagesNonLus = useUnreadMessagesCount()
  const displayName = schoolName || tcommon('brand.fallbackSchool')
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

  const userDisplayName = sessionUser?.nomComplet ?? sessionUser?.firstName ?? tcommon('user.fallbackName')
  const userInitials = userDisplayName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return DEFAULT_OPEN_GROUPS
    try {
      const saved = localStorage.getItem('zekoulabia.admin.nav.groups')
      return saved ? { ...DEFAULT_OPEN_GROUPS, ...JSON.parse(saved) } : DEFAULT_OPEN_GROUPS
    } catch {
      return DEFAULT_OPEN_GROUPS
    }
  })

  const NAV: NavSection[] = [
    {
      id: 'root',
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: tnav('sidebar.dashboard') },
      ],
    },
    {
      id: 'direction',
      label: tnav('group.direction') ?? 'Direction',
      items: [
        { id: 'academic-year', icon: CalendarDays, label: tnav('sidebar.academicYear') },
        { id: 'academic-events', icon: CalendarClock, label: tnav('sidebar.academicEvents') },
        { id: 'settings', icon: Settings, label: tnav('sidebar.settings') },
      ],
    },
    {
      id: 'org',
      label: tnav('group.orgPedagogy') ?? 'Organisation pédagogique',
      items: [
        { id: 'org-pedagogy', icon: School, label: tnav('sidebar.orgPedagogy') ?? 'Organisation pédagogique' },
        { id: 'users', icon: Users, label: tnav('sidebar.users'), badge: badges.users, badgeColor: 'green' },
        { id: 'classes', icon: School, label: tnav('sidebar.classes'), badge: badges.classes, badgeColor: 'green' },
        { id: 'subjects', icon: BookOpen, label: tnav('sidebar.subjects') },
        { id: 'timetable', icon: Calendar, label: tnav('sidebar.timetable') },
        { id: 'eleve-onboarding', icon: UserPlus, label: tnav('sidebar.eleveOnboarding') },
      ],
    },
    {
      id: 'supervision',
      label: tnav('group.supervision') ?? 'Supervision',
      items: [
        { id: 'attendance', icon: ClipboardCheck, label: tnav('sidebar.attendance') },
        { id: 'grades', icon: FileText, label: tnav('sidebar.grades'), badge: badges.grades, badgeColor: 'red' },
        { id: 'bulletins', icon: ScrollText, label: tnav('sidebar.bulletins') },
        { id: 'bulletin-validation', icon: ClipboardCheck, label: tnav('sidebar.bulletinValidation') },
        { id: 'council', icon: GraduationCap, label: tnav('sidebar.council') },
        { id: 'pedagogie', icon: NotebookPen, label: tnav('sidebar.pedagogie') },
      ],
    },
    {
      id: 'pilotage',
      label: tnav('group.pilotage') ?? 'Pilotage',
      items: [
        { id: 'finance', icon: Smartphone, label: tnav('sidebar.finance'), badge: badges.finance, badgeColor: 'amber' },
        { id: 'school-payments', icon: Wallet, label: tnav('sidebar.schoolPayments') },
        { id: 'matricules', icon: IdCard, label: tnav('sidebar.matricules') },
        { id: 'rh', icon: Briefcase, label: tnav('sidebar.rh') },
        { id: 'tasks', icon: ListChecks, label: tnav('sidebar.tasks') },
        { id: 'statistics', icon: BarChart3, label: tnav('sidebar.statistics') },
        { id: 'ai', icon: Bot, label: tnav('sidebar.ai') },
        ...(isPrimaire !== true ? [{ id: 'minesec-stats' as const, icon: BarChart3, label: tnav('sidebar.minesecStats') }] : []),
        ...(isPrimaire !== false ? [{ id: 'minedub-stats' as const, icon: ClipboardList, label: tnav('sidebar.minedubStats') }] : []),
      ],
    },
    {
      id: 'communication',
      label: tnav('group.communication') ?? 'Communication',
      items: [
        { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard') },
        { id: 'messagerie', icon: MessageCircle, label: tnav('sidebar.messagerie'), ...(messagesNonLus > 0 ? { badge: String(messagesNonLus), badgeColor: 'red' as const } : {}) },
        { id: 'communications', icon: Megaphone, label: tnav('sidebar.communications') },
      ],
    },
    {
      id: 'system',
      label: tnav('group.system') ?? 'Système',
      items: [
        { id: 'sync-offline', icon: RefreshCw, label: tnav('sidebar.syncOffline') },
        { id: 'corbeille', icon: Trash2, label: tnav('sidebar.corbeille') },
        ...(hasActiveEntranceExam ? [{ id: 'entrance-exams' as const, icon: ClipboardEdit, label: tnav('sidebar.entranceExams') }] : []),
        ...(hasActivePebs ? [{ id: 'pebs-exams' as const, icon: Globe, label: tnav('sidebar.pebsExams') }] : []),
        ...(hasPendingGroupTransfers ? [{ id: 'group-transfers' as const, icon: ArrowRightLeft, label: tnav('sidebar.groupTransfers') }] : []),
        ...(activeEventTypes.includes('CHOIX_LV2') ? [{ id: 'lv2-choice' as const, icon: Languages, label: tnav('sidebar.lv2Choice') }] : []),
      ],
    },
  ]

  // Forcer l'ouverture du groupe contenant la section active si elle est fermée
  useEffect(() => {
    const activeSectionGroup = NAV.find(section => section.items.some(item => item.id === current))
    if (activeSectionGroup?.id && activeSectionGroup.id !== 'root' && !openGroups[activeSectionGroup.id]) {
      setOpenGroups(prev => {
        const next = { ...prev, [activeSectionGroup.id!]: true }
        try { localStorage.setItem('zekoulabia.admin.nav.groups', JSON.stringify(next)) } catch {}
        return next
      })
    }
  }, [current])

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] }
      try { localStorage.setItem('zekoulabia.admin.nav.groups', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const handleChange = (id: AdminSection) => { onChange(id); onMobileClose?.() }

  const sidebarBody = (
    <>
      {/* Bande déco */}
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)' }}
      />

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-3 border-b border-white/[0.07]" style={{ flexShrink: 0 }}>
        <div className="w-7.5 h-7.5 rounded-[8px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--green))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-spectral text-[16px] font-bold text-white leading-tight truncate">ZekoulABia</div>
          <div className="text-[11px] text-white/35 font-semibold truncate">{tcommon('brand.roleAdmin')}</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:px-2 md:gap-2" style={{ flex: 1, minHeight: 0 }}>
        {/* École pill */}
        <div className="mx-2 my-1 bg-white/[0.06] border border-white/10 rounded-[8px] p-2.5" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-2.5">
            {logoUrl
              ? <img src={logoUrl} alt={displayName} className="w-6.5 h-6.5 rounded-[6px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-6.5 h-6.5 rounded-[6px] bg-gradient-to-br from-[var(--green)] to-[var(--blue)] flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">{initials}</div>
            }
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold text-white truncate">{displayName}</div>
              <div className="text-[10.5px] text-white/35">{tcommon('brand.roleAdmin')}</div>
            </div>
          </div>
        </div>

        {/* Nav — wrapper relatif pour le fondu de defilement */}
        <div className="relative" style={{ minHeight: 0, flex: 1 }}>
          <nav className="overflow-y-auto px-2 pt-0 pb-3 h-full" style={{ minHeight: 0 }}>
            {NAV.map((section, si) => {
              const groupId = section.id || `group-${si}`
              const isOpen = groupId === 'root' || !!openGroups[groupId]
              const hasActiveItem = section.items.some(i => i.id === current)

              return (
                <div key={groupId} className="mb-1">
                  {section.label && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupId)}
                      className={cn(
                        'w-full flex items-center justify-between text-[10px] font-black tracking-[1px] uppercase pt-2.5 px-1.5 pb-1 cursor-pointer transition-colors border-none bg-transparent',
                        hasActiveItem ? 'text-amber-400/90' : 'text-white/35 hover:text-white/60'
                      )}
                    >
                      <span>{section.label}</span>
                      {isOpen ? <ChevronDown size={13} className="text-white/40" /> : <ChevronRight size={13} className="text-white/40" />}
                    </button>
                  )}

                  {isOpen && (
                    <div className="space-y-[2px] mt-0.5">
                      {section.items.map(item => (
                        <button key={item.id} onClick={() => handleChange(item.id)}
                          className={cn(
                            'relative w-full flex items-center gap-2.5 rounded-md mb-[2px]',
                            'text-[12px] font-semibold text-left border-none cursor-pointer font-nunito',
                            'py-2 px-2.5 transition-colors',
                            current === item.id
                              ? 'text-white'
                              : 'text-white/55 hover:bg-[var(--sidebar2)] hover:text-white/85'
                          )}>
                          {current === item.id && (
                            <motion.div layoutId="admin-nav-active"
                              className="absolute inset-0 rounded-md"
                              style={{ background: 'var(--sidebar-active)' }}
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                          )}
                          <span className="relative z-10 w-[18px] flex items-center justify-center flex-shrink-0">
                            <item.icon size={16} strokeWidth={2} />
                          </span>
                          <span className="relative z-10 truncate flex-1">{item.label}</span>
                          {item.badge && (
                            <span className={cn('relative z-10 ml-auto text-[10.5px] font-black rounded px-1.5 py-0.5', BADGE_STYLES[item.badgeColor ?? 'green'])}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
          <div className="md:hidden" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, background: 'linear-gradient(0deg,var(--sidebar),transparent)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* User */}
      <div className="hidden md:block border-t border-white/[0.07]" style={{ padding: '9px 12px', flexShrink: 0 }}>
        <div className="flex items-center gap-2.5 rounded-[8px] hover:bg-white/[0.06]" style={{ padding: '6px 8px' }}>
          <div className="w-7 h-7 rounded-[6px] bg-gradient-to-br from-[var(--amber)] to-[var(--red)] flex items-center justify-center text-white font-black text-[11px] flex-shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-white truncate">{userDisplayName}</div>
            <div className="text-[10px] text-white/35">{tcommon('user.roleLabel')}</div>
          </div>
          {onLogout && (
            <button onClick={onLogout} title={tcommon('user.logoutTitle')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', flexShrink: 0, padding: 3, borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.8)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.3)'}>
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop — sidebar statique, fait partie du flux flex normal */}
      <aside className="hidden md:flex w-[225px] min-w-[225px] flex-shrink-0 relative" style={{ background: 'var(--sidebar)', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {sidebarBody}
      </aside>

      {/* Mobile — tiroir en overlay, glisse depuis la gauche (comme Gmail), ouvert/fermé depuis page.tsx */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <motion.div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onMobileClose}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} />
            <motion.aside className="absolute left-0 top-0 h-full w-[85vw] max-w-[225px] flex flex-col relative" style={{ background: 'var(--sidebar)', overflow: 'hidden' }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}>
              {sidebarBody}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
