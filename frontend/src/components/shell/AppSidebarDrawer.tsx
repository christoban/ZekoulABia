'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, LogOut, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import ChangeAvatarModal from '@/components/ChangeAvatarModal'

interface AppSidebarDrawerProps {
  roleBrandLabel: string
  schoolName?: string
  schoolSubtitle?: string
  schoolLogoUrl?: string | null
  schoolInitialsFallback?: string
  userDisplayName: string
  userInitials: string
  userSubtitle: string
  userAvatarUrl?: string | null
  userAvatarGradient?: string
  onLogout?: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
  showScrollFade?: boolean
  children: ReactNode
}

export function AppSidebarDrawer({
  roleBrandLabel,
  schoolName,
  schoolSubtitle,
  schoolLogoUrl,
  schoolInitialsFallback = 'ET',
  userDisplayName,
  userInitials,
  userSubtitle,
  userAvatarUrl,
  userAvatarGradient = 'from-[var(--primary)] to-[var(--accent)]',
  onLogout,
  mobileOpen = false,
  onMobileClose,
  showScrollFade = false,
  children,
}: AppSidebarDrawerProps) {
  const tcommon = useT('common')
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(userAvatarUrl ?? null)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)

  useEffect(() => {
    if (userAvatarUrl !== undefined) setCurrentAvatar(userAvatarUrl)
  }, [userAvatarUrl])

  useEffect(() => {
    const handleUserUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ avatarUrl?: string | null }>).detail
      if (detail && 'avatarUrl' in detail) {
        setCurrentAvatar(detail.avatarUrl ?? null)
      }
    }
    window.addEventListener('zekoulabia:user-updated', handleUserUpdated)
    return () => window.removeEventListener('zekoulabia:user-updated', handleUserUpdated)
  }, [])

  const displaySchoolName = schoolName || tcommon('brand.fallbackSchool')
  const schoolInitials =
    displaySchoolName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || schoolInitialsFallback

  const sidebarBody = (
    <>
      <div
        className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{
          background:
            'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)',
        }}
      />

      <div className="flex items-center justify-between border-b border-white/[0.07]" style={{ padding: '12px 12px', flexShrink: 0 }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7.5 h-7.5 rounded-[8px] flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg,var(--amber),var(--accent))' }}
          >
            <img src="/logo.svg" alt="ZekoulABia" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
          </div>
          <div className="min-w-0">
            <div className="font-spectral text-[16px] font-bold text-white leading-tight truncate">ZekoulABia</div>
            <div className="text-[11px] text-white/35 font-semibold truncate">{roleBrandLabel}</div>
          </div>
        </div>
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Fermer le menu"
            className="md:hidden ml-auto flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white border-0 cursor-pointer transition-all active:scale-90"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '8px 10px 0', minHeight: 0 }}>
        <div className="bg-white/[0.06] border border-white/10 rounded-[8px] mb-2" style={{ padding: '8px 10px', flexShrink: 0 }}>
          <div className="flex items-center gap-2.5">
            {schoolLogoUrl ? (
              <img src={schoolLogoUrl} alt={displaySchoolName} className="w-6.5 h-6.5 rounded-[6px] flex-shrink-0" style={{ objectFit: 'cover' }} />
            ) : (
              <div className="w-6.5 h-6.5 rounded-[6px] bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">
                {schoolInitials}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold text-white truncate">{displaySchoolName}</div>
              <div className="text-[10.5px] text-white/35 truncate">{schoolSubtitle ?? roleBrandLabel}</div>
            </div>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {children}
          {showScrollFade && (
            <div
              className="md:hidden"
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, background: 'linear-gradient(0deg,var(--sidebar),transparent)', pointerEvents: 'none' }}
            />
          )}
        </div>
      </div>

      <div className="hidden md:block border-t border-white/[0.07]" style={{ padding: '8px 10px', flexShrink: 0 }}>
        <div className="flex items-center gap-2.5 rounded-[8px] hover:bg-white/[0.06] transition-colors" style={{ padding: '6px 8px' }}>
          <button
            type="button"
            onClick={() => setAvatarModalOpen(true)}
            title="Modifier ma photo de profil"
            className="relative group w-8 h-8 rounded-full overflow-hidden border border-white/20 flex-shrink-0 cursor-pointer p-0 bg-transparent flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {currentAvatar ? (
              <img src={currentAvatar} alt={userDisplayName} className="w-full h-full object-cover rounded-full" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${userAvatarGradient} flex items-center justify-center text-white font-black text-[11px]`}>
                {userInitials}
              </div>
            )}
            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
              <Camera size={13} className="text-white" />
            </div>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-white truncate">{userDisplayName}</div>
            <div className="text-[10px] text-white/40 truncate">{userSubtitle}</div>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title={tcommon('user.logoutTitle')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', flexShrink: 0, padding: 3, borderRadius: 4 }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.8)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'
              }}
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      <aside
        className="hidden md:flex w-[250px] min-w-[250px] flex-col h-screen flex-shrink-0 relative overflow-hidden"
        style={{ background: 'var(--sidebar)' }}
      >
        {sidebarBody}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <motion.div
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={onMobileClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            />
            <motion.aside
              className="absolute left-0 top-0 h-full w-[85vw] max-w-[250px] flex flex-col relative overflow-hidden"
              style={{ background: 'var(--sidebar)' }}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
            >
              {sidebarBody}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {avatarModalOpen && (
        <ChangeAvatarModal
          currentAvatarUrl={currentAvatar}
          userName={userDisplayName}
          onClose={() => setAvatarModalOpen(false)}
          onSuccess={(url) => setCurrentAvatar(url)}
          onToast={() => {}}
        />
      )}
    </>
  )
}

