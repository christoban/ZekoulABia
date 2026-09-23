'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, LayoutDashboard, Users, School, BookOpen, ClipboardCheck, FileText,
  ScrollText, Calendar, GraduationCap, NotebookPen, Briefcase, CalendarDays,
  Smartphone, IdCard, Wallet, Banknote, ClipboardEdit, UserPlus, BarChart3, ClipboardList,
  Globe, Languages, Bot, Megaphone, Settings, CalendarClock, X, ArrowRightLeft, Trash2,
  MessageCircle, ListChecks, ChevronDown, ChevronRight,
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
  id: string
  label?: string
  items: NavItem[]
}

const BADGE_STYLES = {
  red:   'bg-red-500/25 text-red-300',
  green: 'bg-success/20 text-success',
  amber: 'bg-amber-500/20 text-amber-300',
}

const DEFAULT_OPEN_GROUPS: Record<string, boolean> = {
  admin: true,
  admissions: true,
  pedagogy: false,
  pilotage: false,
  communication: false,
  config: false,
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
   * undefined tant que /api/v2/school/me n'a pas répondu. */
  isPrimaire?: boolean | null
  /** Tiroir mobile (< 768px) — sidebar fixe cachée, remplacée par cet overlay contrôlé depuis page.tsx. */
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function AdminSidebar({
  current,
  onChange,
  schoolName,
  logoUrl,
  badges = {},
  sessionUser,
  onLogout,
  activeEventTypes = [],
  hasActiveEntranceExam = false,
  hasActivePebs = false,
  hasPendingGroupTransfers = false,
  isPrimaire,
  mobileOpen = false,
  onMobileClose,
}: Props) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const messagesNonLus = useUnreadMessagesCount()
  const displayName = schoolName || tcommon('brand.fallbackSchool')
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

  const userDisplayName = sessionUser?.nomComplet ?? sessionUser?.firstName ?? tcommon('user.fallbackName')
  const userInitials = userDisplayName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(DEFAULT_OPEN_GROUPS)

  // Synchroniser le localStorage uniquement après le mount client pour éviter les erreurs d'hydratation SSR
  useEffect(() => {
    try {
      const saved = localStorage.getItem('zekoulabia.admin.nav.groups')
      if (saved) {
        setOpenGroups(prev => ({ ...prev, ...JSON.parse(saved) }))
      }
    } catch {}
  }, [])

  const NAV: NavSection[] = [
    {
      id: 'admin',
      label: tnav('group.admin') ?? 'Administration & Comptes',
      items: [
        { id: 'users', icon: Users, label: tnav('sidebar.users'), badge: badges.users, badgeColor: 'green' },
      ],
    },
    {
      id: 'admissions',
      label: tnav('group.admissions') ?? 'Admissions & Concours',
      items: [
        { id: 'eleve-onboarding', icon: UserPlus, label: tnav('sidebar.eleveOnboarding') ?? 'Validation des inscriptions', badge: badges['eleve-onboarding'], badgeColor: 'amber' },
        ...(hasActiveEntranceExam ? [{ id: 'entrance-exams' as const, icon: ClipboardEdit, label: tnav('sidebar.entranceExams') ?? 'Concours' }] : []),
      ],
    },
    {
      id: 'pedagogy',
      label: tnav('group.pedagogie') ?? 'Évaluations & Conseils',
      items: [
        { id: 'grades', icon: FileText, label: tnav('sidebar.grades'), badge: badges.grades, badgeColor: 'red' },
        { id: 'bulletins', icon: ScrollText, label: tnav('sidebar.bulletins') },
        { id: 'council', icon: GraduationCap, label: tnav('sidebar.council') },
      ],
    },
    {
      id: 'pilotage',
      label: tnav('group.pilotage') ?? 'Pilotage & Statistiques',
      items: [
        { id: 'finance', icon: Banknote, label: tnav('sidebar.finance'), badge: badges.finance, badgeColor: 'amber' },
        { id: 'statistics', icon: BarChart3, label: tnav('sidebar.statistics') },
        { id: 'ministerial-stats', icon: ClipboardList, label: tnav('sidebar.ministerialStats') ?? 'Statistiques Ministérielles' },
        { id: 'rh', icon: Briefcase, label: tnav('sidebar.rh') },
        { id: 'school-payments', icon: Wallet, label: tnav('sidebar.schoolPayments') },
      ],
    },
    {
      id: 'communication',
      label: tnav('group.communication') ?? 'Communication & Vie Scolaire',
      items: [
        { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard') },
        { id: 'academic-events', icon: CalendarClock, label: tnav('sidebar.academicEvents') },
        ...(hasActivePebs ? [{ id: 'pebs-exams' as const, icon: Globe, label: tnav('sidebar.pebsExams') }] : []),
        ...(hasPendingGroupTransfers ? [{ id: 'group-transfers' as const, icon: ArrowRightLeft, label: tnav('sidebar.groupTransfers') }] : []),
        ...(activeEventTypes.includes('CHOIX_LV2') ? [{ id: 'lv2-choice' as const, icon: Languages, label: tnav('sidebar.lv2Choice') }] : []),
      ],
    },
  ]

  // Ouvrir UNIQUEMENT l'accordéon contenant la section courante
  useEffect(() => {
    const activeSectionGroup = NAV.find(section => section.items.some(item => item.id === current))
    if (activeSectionGroup?.id && !openGroups[activeSectionGroup.id]) {
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

  const isConfigActive = ['settings', 'matricules', 'corbeille'].includes(current)

  const sidebarBody = (
    <>
      {/* Bande déco */}
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)' }}
      />

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-3 border-b border-white/[0.07]" style={{ flexShrink: 0 }}>
        <div className="w-7.5 h-7.5 rounded-[8px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--accent))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
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
              : <div className="w-6.5 h-6.5 rounded-[6px] bg-gradient-to-br from-[var(--primary)] to-[var(--blue)] flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">{initials}</div>
            }
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold text-white truncate">{displayName}</div>
              <div className="text-[10.5px] text-white/35">{tcommon('brand.roleAdmin')}</div>
            </div>
          </div>
        </div>

        {/* Nav — wrapper relatif pour le fondu de défilement */}
        <div className="relative" style={{ minHeight: 0, flex: 1 }}>
          <nav className="overflow-y-auto px-2 pt-0 pb-3 h-full" style={{ minHeight: 0 }}>
            {/* Dashboard principal */}
            <button onClick={() => handleChange('dashboard')}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-r-md mb-[4px]',
                'text-[12.5px] font-bold transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                current === 'dashboard'
                  ? 'bg-gradient-to-r from-amber-500/25 to-amber-500/10 text-amber-300 border-l-3 border-amber-400 shadow-sm shadow-amber-500/10'
                  : 'bg-transparent text-white/70 hover:bg-[var(--sidebar2)] hover:text-white border-l-3 border-transparent'
              )}
              style={{ padding: '7px 8px' }}>
              <span style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LayoutDashboard size={16} strokeWidth={2} className={current === 'dashboard' ? 'text-amber-400' : ''} />
              </span>
              <span className="truncate flex-1">{tnav('sidebar.dashboard')}</span>
            </button>

            {/* Hub Hero Card : Organisation & Supervision Pédagogique */}
            <button
              onClick={() => handleChange('org-pedagogy')}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-xl my-2.5 p-2.5 transition-all text-left border cursor-pointer font-nunito',
                current === 'org-pedagogy'
                  ? 'bg-gradient-to-r from-amber-500/30 via-primary/25 to-primary/20 text-amber-300 border-amber-400/80 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/30'
                  : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/90 border-white/15'
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/35 to-primary/35 text-amber-300 flex items-center justify-center flex-shrink-0 border border-amber-500/40 shadow-sm">
                <School size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-extrabold truncate text-white">Supervision Pédagogique</span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-400/40 tracking-wider">HUB</span>
                </div>
                <div className="text-[10px] text-white/60 truncate font-semibold mt-0.5">Classes, programmes & inscriptions</div>
              </div>
            </button>

            {/* Vie Scolaire & Suivi Quotidien */}
            <div style={{ marginBottom: 6 }}>
              <div className="text-[10px] font-black text-white/30 tracking-[1px] uppercase" style={{ padding: '6px 6px 2px' }}>
                Vie Scolaire & Suivi
              </div>
              {(
                [
                  { id: 'attendance' as const, icon: ClipboardCheck, label: tnav('sidebar.attendance') },
                  { id: 'messagerie' as const, icon: MessageCircle, label: tnav('sidebar.messagerie'), ...(messagesNonLus > 0 ? { badge: String(messagesNonLus), badgeColor: 'red' as const } : {}) },
                  { id: 'ai' as const, icon: Bot, label: tnav('sidebar.ai') },
                ] as NavItem[]
              ).map(item => (
                <button key={item.id} onClick={() => handleChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-r-md mb-[2px]',
                    'text-[12px] font-semibold transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                    current === item.id
                      ? 'bg-gradient-to-r from-amber-500/25 to-amber-500/10 text-amber-300 font-bold border-l-3 border-amber-400 shadow-sm shadow-amber-500/10'
                      : 'bg-transparent text-white/60 hover:bg-[var(--sidebar2)] hover:text-white/90 border-l-3 border-transparent'
                  )}
                  style={{ padding: '6px 8px' }}>
                  <span style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <item.icon size={16} strokeWidth={2} className={current === item.id ? 'text-amber-400' : ''} />
                  </span>
                  <span className="truncate flex-1">{item.label}</span>
                  {item.badge && (
                    <span className={cn('ml-auto text-[10.5px] font-black rounded px-1.5 py-0.5', BADGE_STYLES[item.badgeColor ?? 'green'])}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Accordéons compacts */}
            {NAV.map((section) => {
              const groupId = section.id
              const isOpen = !!openGroups[groupId]
              const hasActiveItem = section.items.some(i => i.id === current)

              return (
                <div key={groupId} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupId)}
                    className={cn(
                      'w-full flex items-center justify-between text-[10px] font-black tracking-[0.5px] uppercase pt-2 px-1.5 pb-1 cursor-pointer transition-colors border-none bg-transparent font-nunito whitespace-nowrap',
                      hasActiveItem ? 'text-amber-400 font-bold' : 'text-white/35 hover:text-white/60'
                    )}
                  >
                    <span className="truncate flex-1 text-left">{section.label}</span>
                    {isOpen ? <ChevronDown size={13} className={hasActiveItem ? 'text-amber-400 flex-shrink-0 ml-1' : 'text-white/40 flex-shrink-0 ml-1'} /> : <ChevronRight size={13} className={hasActiveItem ? 'text-amber-400 flex-shrink-0 ml-1' : 'text-white/40 flex-shrink-0 ml-1'} />}
                  </button>

                  {isOpen && (
                    <div className="space-y-[2px] mt-0.5 pl-1">
                      {section.items.map(item => (
                        <button key={item.id} onClick={() => handleChange(item.id)}
                          className={cn(
                            'relative w-full flex items-center gap-2.5 rounded-r-md mb-[2px]',
                            'text-[12px] text-left border-none cursor-pointer font-nunito',
                            'py-1.5 px-2 transition-all',
                            current === item.id
                              ? 'text-amber-300 font-bold bg-gradient-to-r from-amber-500/25 to-amber-500/10 border-l-3 border-amber-400 shadow-sm shadow-amber-500/10'
                              : 'text-white/60 font-semibold hover:bg-[var(--sidebar2)] hover:text-white/90 border-l-3 border-transparent'
                          )}>
                          <span className="relative z-10 w-[18px] flex items-center justify-center flex-shrink-0">
                            <item.icon size={15} strokeWidth={2} className={current === item.id ? 'text-amber-400' : ''} />
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

            {/* Section Configuration Établissement (Pied de nav) */}
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={() => handleChange('settings')}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-lg transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                  isConfigActive
                    ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                    : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white border border-white/10'
                )}
                style={{ padding: '8px 10px' }}
              >
                <Settings size={16} className="text-blue-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold leading-tight">Configuration</div>
                  <div className="text-[10px] text-white/40">Rentrée, Paramètres, Matricules</div>
                </div>
              </button>

              {/* Sous-pills quand on est en mode Configuration */}
              {isConfigActive && (
                <div className="mt-1.5 space-y-[2px] pl-1.5 border-l-2 border-blue-500/40 ml-2">
                  {[
                    { id: 'settings' as const, label: tnav('sidebar.settings') },
                    { id: 'matricules' as const, label: tnav('sidebar.matricules') },
                    { id: 'corbeille' as const, label: tnav('sidebar.corbeille') },
                  ].map(sub => (
                    <button key={sub.id} onClick={() => handleChange(sub.id)}
                      className={cn(
                        'w-full flex items-center text-[11.5px] font-semibold rounded py-1 px-2 text-left border-none cursor-pointer font-nunito',
                        current === sub.id ? 'text-blue-300 font-bold bg-blue-500/20' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                      )}>
                      <span className="truncate">{sub.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
      <aside className="hidden md:flex w-[250px] min-w-[250px] flex-shrink-0 relative" style={{ background: 'var(--sidebar)', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {sidebarBody}
      </aside>

      {/* Mobile — tiroir en overlay, glisse depuis la gauche (comme Gmail), ouvert/fermé depuis page.tsx */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <motion.div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onMobileClose}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} />
            <motion.aside className="absolute left-0 top-0 h-full w-[85vw] max-w-[250px] flex flex-col relative" style={{ background: 'var(--sidebar)', overflow: 'hidden' }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}>
              {sidebarBody}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
