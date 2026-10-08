'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, LayoutDashboard, School, ClipboardCheck, FileText, Calendar,
  NotebookPen, FolderOpen, IdCard, ClipboardList, PenLine, Target, RefreshCw,
  AlertTriangle, X, ListChecks, Megaphone, MessageCircle,
  ScanSearch, Camera,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import ChangeAvatarModal from '@/components/ChangeAvatarModal'
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
function buildNav(user: UserInfo | null | undefined, pendingGrades: number | undefined, messagesNonLus: number, tnav: ReturnType<typeof useT>, tcommon: ReturnType<typeof useT>): NavGroup[] {
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
  const displayName = schoolName || tcommon('brand.fallbackSchool')
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(user?.avatarUrl ?? null)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)

  useEffect(() => {
    if (user?.avatarUrl !== undefined) {
      setCurrentAvatar(user.avatarUrl)
    }
  }, [user?.avatarUrl])

  useEffect(() => {
    const handleUserUpdated = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.avatarUrl !== undefined) {
        setCurrentAvatar(customEvent.detail.avatarUrl)
      }
    }
    window.addEventListener('zekoulabia:user-updated', handleUserUpdated)
    return () => window.removeEventListener('zekoulabia:user-updated', handleUserUpdated)
  }, [])

  const userDisplayName = user ? `${user.firstName} ${user.lastName}` : tcommon('user.loading')
  const userInitials = user ? (user.firstName[0] || '') + (user.lastName[0] || '') : '??'

  const nav = buildNav(user, pendingGrades, messagesNonLus, tnav, tcommon)
  const handleChange = (id: TeacherSection) => { onChange(id); onMobileClose?.() }

  const sidebarBody = (
    <>
      {/* Bande déco */}
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)' }}
      />

      {/* Brand */}
      <div className="flex items-center justify-between border-b border-white/[0.07]" style={{ padding: '12px 12px' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7.5 h-7.5 rounded-[8px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--accent))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
          <div>
            <div className="font-spectral text-[16px] font-bold text-white leading-tight">ZekoulABia</div>
            <div className="text-[11px] text-white/35 font-semibold">{tcommon('brand.roleTeacher')}</div>
          </div>
        </div>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
            aria-label="Fermer le menu"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '8px 10px' }}>
        {/* École pill */}
        <div className="bg-white/[0.06] border border-white/10 rounded-[8px] mb-2" style={{ padding: '8px 10px' }}>
          <div className="flex items-center gap-2.5">
            {logoUrl
              ? <img src={logoUrl} alt={displayName} className="w-6.5 h-6.5 rounded-[6px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-6.5 h-6.5 rounded-[6px] bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">{initials}</div>
            }
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold text-white truncate">{displayName}</div>
              <div className="text-[10.5px] text-white/35">{tcommon('brand.roleTeacher')}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-1 py-1">
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
      </div>

      {/* User */}
      <div className="hidden md:block border-t border-white/[0.07]" style={{ padding: '8px 10px' }}>
        <div className="flex items-center gap-2.5 rounded-[8px] hover:bg-white/[0.06] transition-colors" style={{ padding: '6px 8px' }}>
          <button
            type="button"
            onClick={() => setAvatarModalOpen(true)}
            title="Modifier ma photo de profil"
            className="relative group w-8 h-8 rounded-full overflow-hidden border border-white/20 flex-shrink-0 cursor-pointer p-0 bg-transparent flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={userDisplayName}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] flex items-center justify-center text-white font-black text-[11px]">
                {userInitials}
              </div>
            )}
            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
              <Camera size={13} className="text-white" />
            </div>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-white truncate">{userDisplayName}</div>
            <div className="text-[10px] text-white/40 truncate">
              {user?.role || tcommon('user.teacherFallback')}
            </div>
          </div>
          {onLogout && (
            <button onClick={onLogout} title={tcommon('user.logoutTitle')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', flexShrink: 0, padding: 3, borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.8)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}>
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      <aside className="hidden md:flex w-[250px] min-w-[250px] flex-col h-screen flex-shrink-0 relative overflow-hidden" style={{ background: 'var(--sidebar)' }}>
        {sidebarBody}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <motion.div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onMobileClose}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} />
            <motion.aside className="absolute left-0 top-0 h-full w-[85vw] max-w-[250px] flex flex-col relative overflow-hidden" style={{ background: 'var(--sidebar)' }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}>
              {sidebarBody}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Changement Photo de Profil */}
      {avatarModalOpen && (
        <ChangeAvatarModal
          currentAvatarUrl={currentAvatar}
          userName={userDisplayName}
          onClose={() => setAvatarModalOpen(false)}
          onSuccess={(url) => setCurrentAvatar(url)}
          onToast={() => { }}
        />
      )}
    </>
  )
}
