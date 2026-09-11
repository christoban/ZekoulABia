'use client'
import { motion } from 'framer-motion'
import { LogOut, LayoutDashboard, FileText, ScrollText, Calendar, ClipboardCheck, BookOpen, HeartPulse, X, Megaphone, MessageCircle, BarChart3 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
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
  red:   'bg-red-500/25 text-red-300',
  green: 'bg-green-500/20 text-green-300',
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

  const NAV: NavGroup[] = [
    {
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: tnav('sidebar.dashboard') },
      ]
    },
    {
      label: tnav('group.results'),
      items: [
        { id: 'grades',    icon: FileText, label: tnav('sidebar.myGrades') },
        { id: 'bulletins', icon: ScrollText, label: tnav('sidebar.bulletins') },
        { id: 'health-tracking', icon: HeartPulse, label: tnav('sidebar.myHealthTracking') },
        { id: 'academic-profile', icon: BarChart3, label: tnav('sidebar.academicProfile') },
      ]
    },
    {
      label: tnav('group.schoolAgenda'),
      items: [
        { id: 'timetable',  icon: Calendar, label: tnav('sidebar.timetable') },
        { id: 'attendance', icon: ClipboardCheck, label: tnav('sidebar.myAttendance') },
      ]
    },
    // notifications retiré — redondant avec la cloche (permanente sur tous les écrans), qui
    // offre désormais un lien « Voir tout » vers cette même page.
    {
      label: tnav('group.services'),
      items: [
        { id: 'library', icon: BookOpen, label: tnav('sidebar.myLibrary') },
        { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard') },
        { id: 'messagerie', icon: MessageCircle, label: tnav('sidebar.messagerie'), ...(messagesNonLus > 0 ? { badge: String(messagesNonLus), badgeColor: 'red' as const } : {}) },
      ]
    },
  ]

  const displayName = schoolName || tcommon('brand.fallbackSchool')
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
  const className = user?.studentProfile?.class?.name || ''

  const handleChange = (id: StudentSection) => { onChange(id); onMobileClose?.() }

  const sidebarBody = (
    <>
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)' }} />

      <div className="flex items-center gap-2 border-b border-white/[0.07]" style={{ padding: '12px 12px' }}>
        <div className="w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--green))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
        <div>
          <div className="font-spectral text-[15px] font-bold text-white leading-tight">ZekoulABia</div>
          <div className="text-[10px] text-white/35 font-semibold">{tcommon('brand.roleStudent')}</div>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '8px 10px 0' }}>
        <div className="bg-white/[0.06] border border-white/10 rounded-[8px] mb-2" style={{ padding: '8px 10px' }}>
          <div className="flex items-center gap-[8px]">
            {logoUrl
              ? <img src={logoUrl} alt={displayName} className="w-6 h-6 rounded-[6px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-[var(--green)] to-[var(--blue)] flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">{initials}</div>
            }
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-white truncate">{displayName}</div>
              <div className="text-[10px] text-white/35">{tcommon('brand.roleStudent')}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-1 py-1">
          {NAV.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="text-[9px] font-black text-white/30 tracking-[1px] uppercase" style={{ padding: '6px 0 0 0' }}>
                  {group.label}
                </div>
            )}
              {group.items.map(item => (
                <button key={item.id} onClick={() => handleChange(item.id)}
                  className={cn(
                    'relative w-full flex items-center gap-2 rounded-lg mb-[1px]',
                    'text-[11px] font-semibold text-left border-none cursor-pointer font-nunito',
                    current === item.id
                      ? 'text-white'
                      : 'text-white/52 hover:bg-[var(--sidebar2)] hover:text-white/82'
                  )}
                  style={{ padding: '5px 8px' }}>
                  {current === item.id && (
                    <motion.div layoutId="student-nav-active"
                      className="absolute inset-0 rounded-lg" style={{ background: 'var(--sidebar-active)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                  )}
                  <span className="relative z-10 w-[16px] flex items-center justify-center flex-shrink-0">
                    <item.icon size={15} strokeWidth={2} />
                  </span>
                  <span className="relative z-10 truncate flex-1">{item.label}</span>
                  {item.badge && (
                    <span className={cn('relative z-10 ml-auto text-[10px] font-black rounded', BADGE_STYLES[item.badgeColor ?? 'red'])} style={{ padding: '1px 5px' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/[0.07]" style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><ThemeToggle /></div>
        <div className="flex items-center gap-2 rounded-[8px] hover:bg-white/[0.06]" style={{ padding: '6px 8px' }}>
          <div className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-[var(--purple)] to-[var(--blue)] flex items-center justify-center text-white font-black text-[10px] flex-shrink-0">
            {user ? (user.firstName[0] || '') + (user.lastName[0] || '') : '??'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-white truncate">{user ? `${user.firstName} ${user.lastName}` : tcommon('user.loading')}</div>
            <div className="text-[9px] text-white/35">{tcommon('user.studentFallback')}{className ? ` · ${className}` : ''}</div>
          </div>
          {onLogout && (
            <button onClick={onLogout} title={tcommon('user.logoutTitle')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', flexShrink: 0, padding: 3, borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.8)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}>
              <LogOut size={13} />
            </button>
          )}
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
