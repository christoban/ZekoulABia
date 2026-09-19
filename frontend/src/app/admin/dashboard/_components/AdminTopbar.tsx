'use client'
import { useState, useEffect, useRef } from 'react'
import { KeyRound, MoreVertical, Bell, Menu, Sun, Moon, LogOut } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useTheme } from 'next-themes'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/NotificationBell'
import OfflineSyncButtonPopover from '@/components/OfflineSyncButtonPopover'
import { useNotifications } from '@/hooks/NotificationContext'
import CalendarTopbarButton from '@/components/CalendarTopbarButton'

interface SessionUser {
  nomComplet?: string
  firstName?: string
  role?: string
}

interface Props {
  title: string
  onNavigate?: (section: string) => void
  onChangePassword?: () => void
  onMenuClick?: () => void
  sessionUser?: SessionUser | null
  onLogout?: () => void
}

export default function AdminTopbar({ title, onNavigate, onChangePassword, onMenuClick, sessionUser, onLogout }: Props) {
  const t = useT('admin')
  const tcommon = useT('common')

  const { theme, setTheme, resolvedTheme } = useTheme()
  const { recentNotifications, unreadCount, markAsRead, registerSeen } = useNotifications()

  // Reproduction exacte de la maquette (Admin Mobile - ZekoulABia.dc.html) :
  // Topbar h=56px sur mobile (48px sur desktop), boutons kebab + notification + menu
  // transparents (pas de bordure), panneau notifications + panneau "..." (theme/mot de passe)
  const [notifOpen, setNotifOpen] = useState(false)
  const [kebabOpen, setKebabOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const kebabRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const toggleNotif = () => {
    if (!notifOpen) registerSeen()
    setNotifOpen(o => !o)
    setKebabOpen(false)
    setProfileOpen(false)
  }

  const toggleKebab = () => {
    setKebabOpen(o => !o)
    setNotifOpen(false)
    setProfileOpen(false)
  }

  const toggleProfile = () => {
    setProfileOpen(o => !o)
    setNotifOpen(false)
    setKebabOpen(false)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setKebabOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Initials utilisateur pour l'avatar mobile (maquette : cercle 34px avec initiales)
  const userDisplayName = sessionUser?.nomComplet || sessionUser?.firstName || tcommon('user.fallbackName')
  const userInitials = userDisplayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase())
    .join('') || 'AD'

  const isDark = resolvedTheme === 'dark'

  return (
    <header
      className="px-3 py-[8px] gap-1.5 md:gap-[10px] md:px-[20px] md:h-[48px] md:border-b-[1px] md:border-[var(--border)]"
      style={{ background: 'var(--surface)', display: 'flex', alignItems: 'center', flexShrink: 0, position: 'relative', boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}
    >
      {/* Hamburger — sous md uniquement */}
      {onMenuClick && (
        <button onClick={onMenuClick} aria-label="Menu" className="md:hidden"
          style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
          <Menu size={22} color="var(--text)" strokeWidth={2} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="text-[16px] md:text-[18px] truncate" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
          {title}
        </div>
      </div>

      {/* Bouton calendrier unifié (Mobile, Tablette, Desktop) */}
      <CalendarTopbarButton />

      {/* Notifications — mobile : cercle 40px + pastille + panneau responsive */}
      <div ref={notifRef} className="relative md:hidden flex-shrink-0">
        <button onClick={toggleNotif} aria-label={t('topbar.notifications')}
          style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}>
          <Bell size={21} color="var(--text)" strokeWidth={2} />
          {unreadCount > 0 && (
            <div style={{ position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', border: '1.5px solid var(--surface)' }} />
          )}
        </button>
        {notifOpen && (
          <div className="fixed inset-x-3 top-[54px] max-w-[340px] ml-auto sm:absolute sm:inset-auto sm:top-12 sm:right-0 sm:w-[320px] max-h-[380px] overflow-y-auto bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] p-2.5 z-50 animate-fade-in font-nunito">
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-[var(--border)]">
              <span className="text-[13.5px] font-bold text-[var(--text)]">{t('topbar.notifications')}</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">
                  {unreadCount} {t('topbar.unread') || 'non lue(s)'}
                </span>
              )}
            </div>
            {recentNotifications.length === 0 ? (
              <div className="py-7 text-center text-[var(--text3)] text-xs font-medium">{t('topbar.no_notifications')}</div>
            ) : (
              <div className="divide-y divide-[var(--border)]/40 my-1">
                {[...recentNotifications].sort((a, b) => Number(a.isRead) - Number(b.isRead)).slice(0, 8).map(n => (
                  <div key={n.id} onClick={() => !n.isRead && markAsRead(n.id)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-colors ${n.isRead ? 'hover:bg-[var(--bg2)]' : 'bg-blue-500/5 hover:bg-blue-500/15'}`}>
                    <div className="mt-1 flex-shrink-0">
                      {!n.isRead ? (
                        <div className="w-2 h-2 rounded-full bg-[var(--green)]" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-transparent" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-[var(--text)] leading-snug">{n.title}</div>
                      <div className="text-[12px] text-[var(--text2)] leading-relaxed mt-0.5 line-clamp-2">{n.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {onNavigate && (
              <button onClick={() => { setNotifOpen(false); onNavigate('notifications') }}
                className="w-full mt-1.5 py-2 px-3 rounded-xl bg-[var(--bg2)] text-[var(--green)] hover:text-green-700 text-xs font-bold border border-[var(--border)] cursor-pointer text-center transition-colors">
                {t('topbar.view_all_notifications')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Kebab — mobile */}
      <div ref={kebabRef} className="relative md:hidden flex-shrink-0">
        <button onClick={toggleKebab} aria-label="Menu"
          style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <MoreVertical size={21} color="var(--text)" strokeWidth={2} />
        </button>
        {kebabOpen && (
          <div style={{ position: 'absolute', top: 48, right: 0, width: 216, background: 'var(--surface)', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.18),0 2px 6px rgba(0,0,0,0.08)', padding: 8, zIndex: 20 }}>
            <div onClick={() => { setTheme(isDark ? 'light' : 'dark'); setKebabOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, cursor: 'pointer' }}>
              {isDark ? <Sun size={18} color="var(--text)" strokeWidth={2} /> : <Moon size={18} color="var(--text)" strokeWidth={2} />}
              <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{t('topbar.theme')}</span>
            </div>
            {onChangePassword && (
              <div onClick={() => { onChangePassword(); setKebabOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, cursor: 'pointer' }}>
                <KeyRound size={18} color="var(--text)" strokeWidth={2} />
                <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{t('topbar.change_password')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions secondaires desktop */}
      <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <OfflineSyncButtonPopover namespace="admin" />
        <ThemeToggle />
        <NotificationBell onNav={onNavigate} />
        {onChangePassword && (
          <button onClick={onChangePassword} title={t('topbar.change_password')}
            style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <KeyRound size={16} color="var(--text2)" />
          </button>
        )}
      </div>

      {/* Profil utilisateur mobile — reproduction de l'avatar 34px de la maquette Android
          (bouton le plus a droite de l'app bar), uniquement sous md. Le comportement desktop
          (carte utilisateur en bas de la sidebar) reste inchange. */}
      {sessionUser && (
        <div ref={profileRef} className="relative flex-shrink-0 md:hidden" style={{ marginLeft: 2 }}>
          <button onClick={toggleProfile} aria-label={userDisplayName}
            style={{ width: 34, height: 34, borderRadius: 17, border: 'none', background: 'linear-gradient(135deg,var(--amber),var(--red))', color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {userInitials}
          </button>
          {profileOpen && (
            <div style={{ position: 'absolute', top: 48, right: 0, width: 220, background: 'var(--surface)', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.18),0 2px 6px rgba(0,0,0,0.08)', padding: 8, zIndex: 20 }}>
              <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{userDisplayName}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{tcommon('user.roleLabel')}</div>
              </div>
              {onLogout && (
                <div onClick={() => { setProfileOpen(false); onLogout() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, cursor: 'pointer' }}>
                  <LogOut size={18} color="var(--red)" strokeWidth={2} />
                  <span style={{ fontSize: 14, color: 'var(--red)', fontWeight: 600 }}>{tcommon('logout')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </header>
  )
}
