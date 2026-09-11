'use client'
import { motion } from 'framer-motion'
import {
  LogOut, LayoutDashboard, School, ClipboardCheck, FileText, Calendar,
  NotebookPen, FolderOpen, IdCard, ClipboardList, PenLine, Target, RefreshCw,
  AlertTriangle, X, ListChecks, Megaphone, MessageCircle,
  ScanSearch,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
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

function buildNav(user: UserInfo | null | undefined, pendingGrades: number | undefined, messagesNonLus: number, tnav: ReturnType<typeof useT>, tcommon: ReturnType<typeof useT>): NavGroup[] {
  const groups: NavGroup[] = [
    {
      items: [{ id: 'dashboard', icon: LayoutDashboard, label: tnav('sidebar.dashboard') }],
    },
{
        label: tnav('group.academic'),
        items: [
          { id: 'classes',    icon: School, label: tnav('sidebar.myClasses') },
          { id: 'attendance', icon: ClipboardCheck, label: tnav('sidebar.attendance') },
          { id: 'grades',     icon: FileText, label: tnav('sidebar.grades'), ...(pendingGrades ? { badge: String(pendingGrades), badgeColor: 'red' as const } : {}) },
          { id: 'timetable',  icon: Calendar, label: tnav('sidebar.timetable') },
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
      label: tnav('group.ressources'),
      items: [{ id: 'resources', icon: FolderOpen, label: tnav('sidebar.pedagogicalResources') }],
    },
    {
      label: tnav('group.communication'),
      items: [
        { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard') },
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
    const cls = ppClasses[0]!
    groups.push({
      label: tnav('group.pp'),
      items: [
        { id: 'pp-classe',        icon: ClipboardList, label: `${tnav('sidebar.myClass')} · ${cls.name}` },
        { id: 'pp-appreciations', icon: PenLine,  label: tnav('sidebar.appreciations') },
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
  red:   'bg-red-500/25 text-red-300',
  green: 'bg-green-500/20 text-green-300',
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
  const displayName = schoolName || tcommon('brand.fallbackSchool')
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
  const nav = buildNav(user, pendingGrades, messagesNonLus, tnav, tcommon)
  const handleChange = (id: TeacherSection) => { onChange(id); onMobileClose?.() }

  const sidebarBody = (
    <>
      {/* Bande déco */}
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)' }}
      />

      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-white/[0.07]" style={{ padding: '12px 12px' }}>
        <div className="w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--green))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
        <div>
          <div className="font-spectral text-[15px] font-bold text-white leading-tight">ZekoulABia</div>
          <div className="text-[10px] text-white/35 font-semibold">{tcommon('brand.roleTeacher')}</div>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '8px 10px' }}>
        {/* École pill */}
        <div className="bg-white/[0.06] border border-white/10 rounded-[8px] mb-2" style={{ padding: '8px 10px' }}>
          <div className="flex items-center gap-2">
            {logoUrl
              ? <img src={logoUrl} alt={displayName} className="w-6 h-6 rounded-[6px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-[var(--green)] to-[var(--blue)] flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">{initials}</div>
            }
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-white truncate">{displayName}</div>
              <div className="text-[10px] text-white/35">{tcommon('brand.roleTeacher')}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-1 py-1">
          {nav.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="text-[9px] font-black text-white/30 tracking-[1px] uppercase" style={{ padding: '6px 0 2px 0' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => (
                <button key={`${gi}-${item.id}`} onClick={() => handleChange(item.id)}
                  className={cn(
                    'relative w-full flex items-center gap-2 rounded-md mb-[1px]',
                    'text-[11px] font-semibold text-left border-none cursor-pointer font-nunito',
                    current === item.id
                      ? 'text-white'
                      : 'text-white/52 hover:bg-[var(--sidebar2)] hover:text-white/82'
                  )}
                  style={{ padding: '5px 8px' }}>
                  {current === item.id && (
                    <motion.div layoutId="teacher-nav-active"
                      className="absolute inset-0 rounded-md" style={{ background: 'var(--sidebar-active)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                  )}
                  <span className="relative z-10 w-[16px] flex items-center justify-center flex-shrink-0">
                    <item.icon size={15} strokeWidth={2} />
                  </span>
                  <span className="relative z-10 truncate flex-1">{item.label}</span>
                  {item.badge && item.badgeColor && (
                    <span className={cn('relative z-10 ml-auto text-[10px] font-black rounded', BADGE_STYLES[item.badgeColor])} style={{ padding: '1px 5px' }}>
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
              <div className="text-[9px] font-black text-white/30 tracking-[1px] uppercase" style={{ padding: '6px 0 2px 0' }}>
                {tnav('sidebar.sync')}
              </div>
              <button onClick={() => handleChange('sync')}
                className={cn(
                  'relative w-full flex items-center gap-2 rounded-md mb-[1px]',
                  'text-[11px] font-semibold text-left border-none cursor-pointer font-nunito',
                  current === 'sync' ? 'text-white' : 'text-white/52 hover:bg-[var(--sidebar2)] hover:text-white/82'
                )}
                style={{ padding: '5px 8px' }}>
                {current === 'sync' && (
                  <motion.div layoutId="teacher-nav-active"
                    className="absolute inset-0 rounded-md" style={{ background: 'var(--sidebar-active)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10 w-[16px] flex items-center justify-center flex-shrink-0">
                  <RefreshCw size={15} strokeWidth={2} />
                </span>
                <span className="relative z-10 truncate flex-1">{tnav('sidebar.sync')}</span>
                <span className={cn('relative z-10 ml-auto text-[10px] font-black rounded', BADGE_STYLES.amber)} style={{ padding: '1px 5px' }}>
                  {pendingCount}
                </span>
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* User */}
      <div className="border-t border-white/[0.07]" style={{ padding: '8px 10px' }}>
        <div className="flex items-center gap-2 rounded-[8px] hover:bg-white/[0.06]" style={{ padding: '6px 8px' }}>
          <div className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] flex items-center justify-center text-white font-black text-[10px] flex-shrink-0">
            {user ? (user.firstName[0] || '') + (user.lastName[0] || '') : '??'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-white truncate">{user ? `${user.firstName} ${user.lastName}` : tcommon('user.loading')}</div>
            <div className="text-[9px] text-white/35 truncate">{user?.role || tcommon('user.teacherFallback')}{user?.teacherProfile?.teacherSubjects?.length ? ` · ${user.teacherProfile.teacherSubjects.map(s => s.subject.name).join(', ')}` : ''}</div>
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
