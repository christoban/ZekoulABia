'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, LayoutDashboard, GraduationCap, ClipboardCheck,
  Calendar, Landmark, Banknote, AlertTriangle, BookOpen,
  Compass, IdCard, ShieldAlert,
  Megaphone, MessageCircle,
  ScanSearch, Users, Settings, ChevronDown, ChevronRight,
  BarChart3, UserPlus, Award, RefreshCw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT, useLanguage } from '@/lib/i18n'
import { logoutUser } from '@/lib/userAuth'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import type { StaffSection, SessionUser } from '../_types'
import { getStaffDisplayTitle } from '../_types'

interface NavItem {
  id: StaffSection
  icon: LucideIcon
  label: string
  badge?: string
  badgeColor?: 'red' | 'amber' | 'green'
}

interface NavAccordionGroup {
  id: string
  label: string
  items: NavItem[]
}

interface Props {
  current: StaffSection
  onChange: (s: StaffSection) => void
  allowedSections: Set<StaffSection>
  sessionUser: SessionUser | null
  schoolName?: string
  logoUrl?: string | null
  badges?: Partial<Record<StaffSection, string>>
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const BADGE_STYLES = {
  red:   'bg-red-500/25 text-red-300',
  green: 'bg-green-500/20 text-green-300',
  amber: 'bg-amber-500/20 text-amber-300',
}

export default function StaffSidebar({ current, onChange, allowedSections, sessionUser, schoolName, logoUrl, badges = {}, mobileOpen = false, onMobileClose }: Props) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const { lang } = useLanguage()
  const displayRoleTitle = getStaffDisplayTitle(sessionUser, lang)
  const messagesNonLus = useUnreadMessagesCount()
  const can = (s: StaffSection) => allowedSections.has(s)

  // Admissions & Concours (Secrétaire / Bursar / Intendant)
  const admissionsItems: NavItem[] = []
  if (can('inscriptions')) {
    admissionsItems.push({
      id: 'inscriptions',
      icon: UserPlus,
      label: tnav('sidebar.inscriptions') ?? 'Inscriptions',
      badge: badges.inscriptions,
    })
  }
  if (can('concours')) {
    admissionsItems.push({
      id: 'concours',
      icon: Award,
      label: tnav('sidebar.concours') ?? "Concours d'entrée",
      badge: badges.concours,
    })
  }

  // Items quotidiens (Vie Scolaire & Services actifs)
  const vieScolaireItems: NavItem[] = []
  if (can('attendance'))       vieScolaireItems.push({ id: 'attendance',   icon: ClipboardCheck, label: tnav('sidebar.attendance'), badge: badges.attendance })
  if (can('discipline'))      vieScolaireItems.push({ id: 'discipline',  icon: AlertTriangle, label: tnav('sidebar.discipline') })
  if (can('suivi-eleves'))     vieScolaireItems.push({ id: 'suivi-eleves', icon: ShieldAlert, label: tnav('sidebar.suiviEleves') })
  if (can('timetable'))        vieScolaireItems.push({ id: 'timetable',    icon: Calendar, label: tnav('sidebar.timetable') })
  if (can('finance'))          vieScolaireItems.push({ id: 'finance',      icon: Banknote, label: tnav('sidebar.finance'), badge: badges.finance, badgeColor: 'red' })
  if (can('rapports'))        vieScolaireItems.push({ id: 'rapports',      icon: BarChart3, label: tnav('sidebar.rapports') ?? 'Rapports & Stats' })

  // Évaluations & Examens
  const evalItems: NavItem[] = []
  if (can('council'))          evalItems.push({ id: 'council', icon: GraduationCap, label: tnav('sidebar.council'), badge: badges.council, badgeColor: 'amber' })
  if (can('anonymat'))         evalItems.push({ id: 'anonymat', icon: ScanSearch, label: tnav('sidebar.anonymat') })

  // Pédagogie & Structure
  const pedagItems: NavItem[] = []
  if (can('eleves-affectations')) pedagItems.push({ id: 'eleves-affectations', icon: Users, label: tnav('sidebar.studentAssignments') ?? 'Affectations élèves' })
  if (can('departements'))     pedagItems.push({ id: 'departements', icon: Landmark, label: tnav('sidebar.departments') })
  if (can('orientation'))      pedagItems.push({ id: 'orientation', icon: Compass, label: tnav('sidebar.orientation') })
  if (can('library'))          pedagItems.push({ id: 'library', icon: BookOpen, label: tnav('sidebar.library') })

  // Communication
  const commItems: NavItem[] = []
  if (can('messagerie'))       commItems.push({ id: 'messagerie', icon: MessageCircle, label: tnav('sidebar.messagerie'), ...(messagesNonLus > 0 ? { badge: String(messagesNonLus), badgeColor: 'red' as const } : {}) })
  if (can('babillard'))        commItems.push({ id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard') })

  // Configuration technique (uniquement si permission de structure d'établissement)
  const hasConfigAccess = can('configuration')

  const accordionGroups: NavAccordionGroup[] = [
    ...(admissionsItems.length > 0 ? [{ id: 'admissions', label: 'Admissions & Concours', items: admissionsItems }] : []),
    ...(evalItems.length > 0 ? [{ id: 'evaluations', label: 'Évaluations & Conseils', items: evalItems }] : []),
    ...(pedagItems.length > 0 ? [{ id: 'pedagogie', label: 'Pédagogie & Structure', items: pedagItems }] : []),
    ...(commItems.length > 0 ? [{ id: 'communication', label: 'Communication', items: commItems }] : []),
  ]

  // Déterminer quel groupe d'accordéon doit être ouvert par défaut (celui contenant la section courante)
  const initialOpenState: Record<string, boolean> = {}
  for (const grp of accordionGroups) {
    initialOpenState[grp.id] = grp.items.some(it => it.id === current)
  }

  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(initialOpenState)

  const toggleAccordion = (grpId: string) => {
    setOpenAccordions(prev => ({ ...prev, [grpId]: !prev[grpId] }))
  }

  const userFallback = sessionUser?.nomComplet ?? tcommon('user.staffFallback')
  const initials = sessionUser
    ? (sessionUser.nomComplet ?? '').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : 'ST'

  const handleChange = (id: StaffSection) => { onChange(id); onMobileClose?.() }

  const sidebarBody = (
    <>
      {/* Bande déco camerounaise */}
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)' }} />

      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.07]" style={{ padding: '12px 12px' }}>
        <div className="w-7.5 h-7.5 rounded-[8px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--green))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
        <div>
          <div className="font-spectral text-[16px] font-bold text-white leading-tight">ZekoulABia</div>
          <div className="text-[11px] text-white/50 font-semibold truncate">{displayRoleTitle}</div>
        </div>
      </div>

      {/* École */}
      <div style={{ padding: '8px 10px 0' }}>
        <div className="bg-white/[0.06] border border-white/10 rounded-[8px]" style={{ padding: '8px 10px' }}>
          <div className="flex items-center gap-2.5">
            {logoUrl
              ? <img src={logoUrl} alt={schoolName ?? 'Logo'} className="w-6.5 h-6.5 rounded-[6px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-6.5 h-6.5 rounded-[6px] bg-gradient-to-br from-[var(--green)] to-[var(--blue)] flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">
                  {(schoolName ?? 'ET').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
            }
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold text-white truncate">{schoolName ?? tcommon('brand.fallbackSchool')}</div>
              <div className="text-[10.5px] text-white/35">2025–2026</div>
            </div>
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

        {/* Groupe Vie Scolaire & Suivi Quotidien */}
        {vieScolaireItems.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div className="text-[10px] font-black text-white/30 tracking-[1px] uppercase" style={{ padding: '6px 6px 2px' }}>
              Vie Scolaire & Suivi
            </div>
            {vieScolaireItems.map(item => (
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
                  <span className={cn('ml-auto text-[10.5px] font-black rounded', BADGE_STYLES[item.badgeColor ?? 'red'])} style={{ padding: '1px 5px' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Groupes Accordéons (Évaluations, Pédagogie, Communication, Finance) */}
        {accordionGroups.map(grp => {
          const isCurrentInGroup = grp.items.some(it => it.id === current)
          const isOpen = openAccordions[grp.id] !== undefined ? openAccordions[grp.id] : isCurrentInGroup
          return (
            <div key={grp.id} style={{ marginBottom: 4 }}>
              <button
                onClick={() => toggleAccordion(grp.id)}
                className={cn(
                  'w-full flex items-center justify-between text-[10px] font-black tracking-[0.8px] uppercase hover:text-white/75 transition-all border-none bg-transparent cursor-pointer font-nunito',
                  isCurrentInGroup ? 'text-amber-400/90 font-bold' : 'text-white/35'
                )}
                style={{ padding: '6px 6px 4px' }}
              >
                <span>{grp.label}</span>
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              {isOpen && (
                <div className="space-y-[2px] pl-1">
                  {grp.items.map(item => (
                    <button key={item.id} onClick={() => handleChange(item.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-r-md mb-[2px]',
                        'text-[12px] font-semibold transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                        current === item.id
                          ? 'bg-gradient-to-r from-amber-500/25 to-amber-500/10 text-amber-300 font-bold border-l-3 border-amber-400 shadow-sm shadow-amber-500/10'
                          : 'bg-transparent text-white/55 hover:bg-[var(--sidebar2)] hover:text-white/85 border-l-3 border-transparent'
                      )}
                      style={{ padding: '6px 8px' }}>
                      <span style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <item.icon size={15} strokeWidth={2} className={current === item.id ? 'text-amber-400' : ''} />
                      </span>
                      <span className="truncate flex-1">{item.label}</span>
                      {item.badge && (
                        <span className={cn('ml-auto text-[10.5px] font-black rounded', BADGE_STYLES[item.badgeColor ?? 'red'])} style={{ padding: '1px 5px' }}>
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

        {/* Section Configuration Établissement (Séparée & Proéminente en bas de nav) */}
        {hasConfigAccess && (
          <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {(() => {
              const isConfigActive = current === 'configuration' || ['import-eleves', 'classes', 'grille-horaire', 'affectations', 'cautions'].includes(current)
              return (
                <button
                  onClick={() => handleChange('configuration')}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-r-md transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                    isConfigActive
                      ? 'bg-gradient-to-r from-amber-500/25 to-amber-500/10 text-amber-300 font-bold border-l-3 border-amber-400 shadow-sm shadow-amber-500/10'
                      : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white border-l-3 border-transparent'
                  )}
                  style={{ padding: '8px 10px' }}
                >
                  <Settings size={16} className={cn('flex-shrink-0', isConfigActive ? 'text-amber-400' : 'text-blue-400')} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold leading-tight">Configuration</div>
                    <div className="text-[10px] text-white/40">Grilles, Rentrée, Classes</div>
                  </div>
                </button>
              )
            })()}
          </div>
        )}

        {/* Mon Compte */}
        <div style={{ marginTop: 8 }}>
          <div className="text-[10px] font-black text-white/30 tracking-[1px] uppercase" style={{ padding: '6px 6px 2px' }}>
            Mon compte
          </div>
          {can('mon-profil-rh') && (
            <button onClick={() => handleChange('mon-profil-rh')}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-r-md mb-[2px]',
                'text-[12px] font-semibold transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                current === 'mon-profil-rh'
                  ? 'bg-gradient-to-r from-amber-500/25 to-amber-500/10 text-amber-300 font-bold border-l-3 border-amber-400 shadow-sm shadow-amber-500/10'
                  : 'bg-transparent text-white/50 hover:bg-[var(--sidebar2)] hover:text-white/80 border-l-3 border-transparent'
              )}
              style={{ padding: '6px 8px' }}>
              <span style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IdCard size={15} strokeWidth={2} className={current === 'mon-profil-rh' ? 'text-amber-400' : ''} />
              </span>
              <span className="truncate flex-1">{tnav('sidebar.monProfilRH')}</span>
            </button>
          )}
          {can('sync-offline') && (
            <button onClick={() => handleChange('sync-offline')}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-r-md mb-[2px]',
                'text-[12px] font-semibold transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                current === 'sync-offline'
                  ? 'bg-gradient-to-r from-amber-500/25 to-amber-500/10 text-amber-300 font-bold border-l-3 border-amber-400 shadow-sm shadow-amber-500/10'
                  : 'bg-transparent text-white/50 hover:bg-[var(--sidebar2)] hover:text-white/80 border-l-3 border-transparent'
              )}
              style={{ padding: '6px 8px' }}>
              <span style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RefreshCw size={15} strokeWidth={2} className={current === 'sync-offline' ? 'text-amber-400' : ''} />
              </span>
              <span className="truncate flex-1">{tnav('sidebar.syncOffline') ?? 'Synchronisation hors-ligne'}</span>
            </button>
          )}
        </div>
        </nav>
        <div className="md:hidden" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, background: 'linear-gradient(0deg,var(--sidebar),transparent)', pointerEvents: 'none' }} />
      </div>

      {/* User — desktop uniquement (comme AdminSidebar) */}
      <div className="hidden md:block border-t border-white/[0.07]" style={{ padding: '9px 12px', flexShrink: 0 }}>
        <div className="flex items-center gap-2.5 rounded-[8px] hover:bg-white/[0.06]" style={{ padding: '6px 8px' }}>
          <div className="w-7 h-7 rounded-[6px] bg-gradient-to-br from-[var(--teal)] to-[var(--green)] flex items-center justify-center text-white font-black text-[11px] flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-white truncate">{userFallback}</div>
            <div className="text-[10px] text-white/35">{displayRoleTitle}</div>
          </div>
          <button onClick={logoutUser} title={tcommon('user.logoutTitle')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', flexShrink: 0, padding: 3, borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.8)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}>
            <LogOut size={14} />
          </button>
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

      {/* Mobile — tiroir en overlay, glisse depuis la gauche (comme AdminSidebar) */}
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

