'use client'
import {
  LogOut, LayoutDashboard, GraduationCap, FileText, ClipboardCheck, Clock,
  Link2, Calendar, Landmark, Smartphone, Lock, AlertTriangle, BookOpen,
  Compass, IdCard, HandCoins, X, ShieldAlert,
  RefreshCw, Megaphone, MessageCircle, ShieldCheck,
  ScanSearch,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { logoutUser } from '@/lib/userAuth'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import type { StaffSection, SessionUser } from '../_types'

interface NavItem {
  id: StaffSection
  icon: LucideIcon
  label: string
  badge?: string
  badgeColor?: 'red' | 'amber' | 'green'
}

interface NavGroup {
  label?: string
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
  const messagesNonLus = useUnreadMessagesCount()
  const can = (s: StaffSection) => allowedSections.has(s)

  const supervisionItems: NavItem[] = []
  if (can('council'))          supervisionItems.push({ id: 'council',          icon: GraduationCap, label: tnav('sidebar.council'),         badge: badges.council,   badgeColor: 'amber' })
  if (can('grades'))           supervisionItems.push({ id: 'grades',           icon: FileText, label: tnav('sidebar.gradeValidation'), badge: badges.grades,    badgeColor: 'red'   })
  if (can('anonymat'))         supervisionItems.push({ id: 'anonymat',         icon: ScanSearch, label: tnav('sidebar.anonymat') })
  if (can('suivi-eleves'))     supervisionItems.push({ id: 'suivi-eleves',     icon: ShieldAlert, label: tnav('sidebar.suiviEleves') })
  if (can('attendance'))       supervisionItems.push({ id: 'attendance',       icon: ClipboardCheck, label: tnav('sidebar.attendance'),      badge: badges.attendance })
  if (can('grille-horaire'))   supervisionItems.push({ id: 'grille-horaire',   icon: Clock, label: tnav('sidebar.scheduleGrid') })
  if (can('affectations'))     supervisionItems.push({ id: 'affectations',     icon: Link2, label: tnav('sidebar.assignments') })
  if (can('timetable'))        supervisionItems.push({ id: 'timetable',        icon: Calendar, label: tnav('sidebar.timetable') })
  if (can('departements'))     supervisionItems.push({ id: 'departements',     icon: Landmark, label: tnav('sidebar.departments') })
  if (can('moderation-messagerie')) supervisionItems.push({ id: 'moderation-messagerie', icon: ShieldCheck, label: tnav('sidebar.moderationMessagerie') })

  const servicesItems: NavItem[] = []
  if (can('finance'))     servicesItems.push({ id: 'finance',     icon: Smartphone, label: tnav('sidebar.finance'),    badge: badges.finance,  badgeColor: 'red' })
  if (can('apee'))        servicesItems.push({ id: 'apee',        icon: HandCoins, label: tnav('sidebar.apee') })
  if (can('cautions'))    servicesItems.push({ id: 'cautions',    icon: Lock, label: tnav('sidebar.cautionMoney') })
  if (can('discipline'))  servicesItems.push({ id: 'discipline',  icon: AlertTriangle, label: tnav('sidebar.discipline') })
  if (can('library'))     servicesItems.push({ id: 'library',     icon: BookOpen, label: tnav('sidebar.library') })
  if (can('orientation')) servicesItems.push({ id: 'orientation', icon: Compass, label: tnav('sidebar.orientation') })

  const navGroups: NavGroup[] = [
    { items: [{ id: 'dashboard', icon: LayoutDashboard, label: tnav('sidebar.dashboard') }] },
    ...(supervisionItems.length > 0 ? [{ label: tnav('group.supervision'), items: supervisionItems }] : []),
    ...(servicesItems.length > 0    ? [{ label: tnav('group.services'),    items: servicesItems    }] : []),
    // notifications retiré de la sidebar — redondant avec la cloche (permanente sur tous les
    // écrans), qui offre désormais un lien « Voir tout » vers cette même page.
    { label: tnav('group.moncompte'), items: [
      { id: 'sync-offline', icon: RefreshCw, label: tnav('sidebar.syncOffline') },
      { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard') },
      { id: 'messagerie', icon: MessageCircle, label: tnav('sidebar.messagerie'), ...(messagesNonLus > 0 ? { badge: String(messagesNonLus), badgeColor: 'red' as const } : {}) },
      { id: 'mon-profil-rh', icon: IdCard, label: tnav('sidebar.monProfilRH') },
    ] },
  ]

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
      <div className="flex items-center gap-2 border-b border-white/[0.07]" style={{ padding: '12px 12px' }}>
        <div className="w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--green))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
        <div>
          <div className="font-spectral text-[15px] font-bold text-white leading-tight">ZekoulABia</div>
          <div className="text-[10px] text-white/35 font-semibold">{tcommon('brand.roleStaff')}</div>
        </div>
      </div>

      {/* École */}
      <div style={{ padding: '8px 10px 0' }}>
        <div className="bg-white/[0.06] border border-white/10 rounded-[8px]" style={{ padding: '8px 10px' }}>
          <div className="flex items-center gap-2">
            {logoUrl
              ? <img src={logoUrl} alt={schoolName ?? 'Logo'} className="w-6 h-6 rounded-[6px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-[var(--green)] to-[var(--blue)] flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
                  {(schoolName ?? 'ET').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
            }
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-white truncate">{schoolName ?? tcommon('brand.fallbackSchool')}</div>
              <div className="text-[10px] text-white/35">2025–2026</div>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '6px 6px' }}>
        {navGroups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 2 }}>
            {group.label && (
              <div className="text-[9px] font-black text-white/30 tracking-[1px] uppercase" style={{ padding: '6px 6px 2px' }}>
                {group.label}
              </div>
            )}
            {group.items.map(item => (
              <button key={item.id} onClick={() => handleChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-md mb-[1px]',
                  'text-[11px] font-semibold transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                    current === item.id
                      ? 'bg-[var(--sidebar-active)] text-white'
                      : 'bg-transparent text-white/50 hover:bg-[var(--sidebar2)] hover:text-white/80'
                )}
                style={{ padding: '5px 8px' }}>
                <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <item.icon size={15} strokeWidth={2} />
                </span>
                <span className="truncate flex-1">{item.label}</span>
                {item.badge && (
                  <span className={cn('ml-auto text-[10px] font-black rounded', BADGE_STYLES[item.badgeColor ?? 'red'])} style={{ padding: '1px 5px' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/[0.07]" style={{ padding: '8px 10px' }}>
        <div className="flex items-center gap-2 rounded-[8px] hover:bg-white/[0.06] cursor-pointer" style={{ padding: '6px 8px' }}>
          <div className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-[var(--teal)] to-[var(--green)] flex items-center justify-center text-white font-black text-[10px] flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-white truncate">{userFallback}</div>
            <div className="text-[9px] text-white/35">Staff</div>
          </div>
          <button onClick={logoutUser} title={tcommon('user.logoutTitle')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 3, borderRadius: 4, flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.8)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}>
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <aside className="hidden md:flex w-[200px] min-w-[200px] flex-col h-screen flex-shrink-0 relative overflow-hidden" style={{ background: 'var(--sidebar)' }}>
        {sidebarBody}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onMobileClose} />
          <aside className="absolute left-0 top-0 h-full w-[85vw] max-w-[200px] flex flex-col relative overflow-hidden" style={{ background: 'var(--sidebar)' }}>
            <button onClick={onMobileClose} aria-label="Fermer"
              className="absolute z-20" style={{ top: 10, right: 10, width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={13} color="white" />
            </button>
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  )
}
