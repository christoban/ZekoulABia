'use client'

import { useState, useEffect, useRef } from 'react'
import { KeyRound, MoreVertical, Bell, Menu, Sun, Moon, LogOut, Camera } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useTheme } from 'next-themes'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/NotificationBell'
import OfflineSyncButtonPopover from '@/components/OfflineSyncButtonPopover'
import { useNotifications } from '@/hooks/NotificationContext'
import CalendarTopbarButton from '@/components/CalendarTopbarButton'
import LanguageSwitch from '@/components/LanguageSwitch'
import ChangeAvatarModal from '@/components/ChangeAvatarModal'

export interface AppTopbarUser {
  nomComplet?: string
  firstName?: string
  lastName?: string
  role?: string
  avatarUrl?: string | null
}

export interface AppTopbarProps {
  title: string
  periodLabel?: string
  onNavigate?: (section: string) => void
  onChangePassword?: () => void
  onMenuClick?: () => void
  user?: AppTopbarUser | null
  fallbackInitials: string
  roleLabel: string
  avatarGradient: string
  syncNamespace: 'admin' | 'staff' | 'teacher' | 'common'
  onLogout?: () => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function AppTopbar({
  title,
  periodLabel,
  onNavigate,
  onChangePassword,
  onMenuClick,
  user,
  fallbackInitials,
  roleLabel,
  avatarGradient,
  syncNamespace,
  onLogout,
  onToast,
}: AppTopbarProps) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const { setTheme, resolvedTheme } = useTheme()
  const { recentNotifications, unreadCount, markAsRead, registerSeen } = useNotifications()

  const [notifOpen, setNotifOpen] = useState(false)
  const [kebabOpen, setKebabOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(user?.avatarUrl ?? null)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const kebabRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user?.avatarUrl !== undefined) setCurrentAvatar(user.avatarUrl)
  }, [user?.avatarUrl])

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setKebabOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleNotif = () => {
    if (!notifOpen) registerSeen()
    setNotifOpen((o) => !o)
    setKebabOpen(false)
    setProfileOpen(false)
  }

  const toggleKebab = () => {
    setKebabOpen((o) => !o)
    setNotifOpen(false)
    setProfileOpen(false)
  }

  const toggleProfile = () => {
    setProfileOpen((o) => !o)
    setNotifOpen(false)
    setKebabOpen(false)
  }

  const nameFromParts = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
  const rawName = user?.nomComplet || nameFromParts || user?.firstName || ''
  const userDisplayName = rawName || tcommon('user.fallbackName')
  const userInitials =
    rawName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || fallbackInitials

  const isDark = resolvedTheme === 'dark'

  return (
    <header
      className="px-3 py-[8px] gap-1.5 md:gap-[10px] md:px-[20px] md:h-[48px] md:border-b-[1px] md:border-[var(--border)]"
      style={{
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        position: 'relative',
        boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
      }}
    >
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Menu"
          className="flex md:!hidden active:scale-90 transition-transform cursor-pointer border border-[var(--border)] bg-[var(--bg2)] hover:bg-[var(--surface2)] items-center justify-center shrink-0"
          style={{ width: 38, height: 38, borderRadius: 10 }}
        >
          <Menu size={20} color="var(--text)" strokeWidth={2} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div
          className="text-[16px] md:text-[18px] truncate"
          style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}
        >
          {title}
        </div>
      </div>

      {periodLabel && (
        <span
          className="hidden md:inline"
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '3px 9px',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--text3)',
            whiteSpace: 'nowrap',
          }}
        >
          {periodLabel}
        </span>
      )}

      <div className="shrink-0">
        <CalendarTopbarButton />
      </div>

      {/* Notifications mobile */}
      <div ref={notifRef} className="relative md:hidden flex-shrink-0">
        <button
          type="button"
          onClick={toggleNotif}
          aria-label={tnav('topbar.notifications') || 'Notifications'}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          <Bell size={21} color="var(--text)" strokeWidth={2} />
          {unreadCount > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 9,
                right: 9,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--red)',
                border: '1.5px solid var(--surface)',
              }}
            />
          )}
        </button>
        {notifOpen && (
          <div className="fixed inset-x-3 top-[54px] max-w-[340px] ml-auto sm:absolute sm:inset-auto sm:top-12 sm:right-0 sm:w-[320px] max-h-[380px] overflow-y-auto bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] p-2.5 z-50 animate-fade-in font-nunito">
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-[var(--border)]">
              <span className="text-[13.5px] font-bold text-[var(--text)]">{tnav('topbar.notifications')}</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-300">
                  {unreadCount} {tnav('topbar.unread') || 'non lue(s)'}
                </span>
              )}
            </div>
            {recentNotifications.length === 0 ? (
              <div className="py-7 text-center text-[var(--text3)] text-xs font-medium">{tnav('topbar.no_notifications')}</div>
            ) : (
              <div className="divide-y divide-[var(--border)]/40 my-1">
                {[...recentNotifications]
                  .sort((a, b) => Number(a.isRead) - Number(b.isRead))
                  .slice(0, 8)
                  .map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.isRead && markAsRead(n.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-colors ${
                        n.isRead ? 'hover:bg-[var(--bg2)]' : 'bg-blue-500/5 hover:bg-blue-500/15'
                      }`}
                    >
                      <div className="mt-1 flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${!n.isRead ? 'bg-[var(--green)]' : 'bg-transparent'}`} />
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
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(false)
                  onNavigate('notifications')
                }}
                className="w-full mt-1.5 py-2 px-3 rounded-xl bg-[var(--bg2)] text-[var(--green)] hover:text-success text-xs font-bold border border-[var(--border)] cursor-pointer text-center transition-colors"
              >
                {tnav('topbar.view_all_notifications')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Kebab mobile */}
      <div ref={kebabRef} className="relative md:hidden flex-shrink-0">
        <button
          type="button"
          onClick={toggleKebab}
          aria-label="Menu"
          style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <MoreVertical size={21} color="var(--text)" strokeWidth={2} />
        </button>
        {kebabOpen && (
          <div style={{ position: 'absolute', top: 48, right: 0, width: 216, background: 'var(--surface)', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.18),0 2px 6px rgba(0,0,0,0.08)', padding: 8, zIndex: 20 }}>
            <div style={{ padding: '4px 6px 8px' }}>
              <LanguageSwitch compact style={{ width: '100%', justifyContent: 'center' }} />
            </div>
            <div
              onClick={() => {
                setTheme(isDark ? 'light' : 'dark')
                setKebabOpen(false)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, cursor: 'pointer' }}
            >
              {isDark ? <Sun size={18} color="var(--text)" strokeWidth={2} /> : <Moon size={18} color="var(--text)" strokeWidth={2} />}
              <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{tcommon('theme.toggle') || 'Thème'}</span>
            </div>
            {onChangePassword && (
              <div
                onClick={() => {
                  onChangePassword()
                  setKebabOpen(false)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, cursor: 'pointer' }}
              >
                <KeyRound size={18} color="var(--text)" strokeWidth={2} />
                <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{tcommon('auth.changePassword') || 'Changer le mot de passe'}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions desktop */}
      <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <OfflineSyncButtonPopover namespace={syncNamespace} />
        <ThemeToggle />
        <LanguageSwitch compact />
        <NotificationBell onNav={onNavigate} />
        {onChangePassword && (
          <button
            type="button"
            onClick={onChangePassword}
            title={tcommon('auth.changePassword') || 'Changer le mot de passe'}
            style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <KeyRound size={16} color="var(--text2)" />
          </button>
        )}
      </div>

      {/* Profil utilisateur mobile */}
      {user && (
        <div ref={profileRef} className="relative flex-shrink-0 md:hidden" style={{ marginLeft: 2 }}>
          <button
            type="button"
            onClick={toggleProfile}
            aria-label={userDisplayName}
            style={{ width: 34, height: 34, borderRadius: 17, border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
          >
            {currentAvatar ? (
              <img src={currentAvatar} alt={userDisplayName} className="w-full h-full object-cover rounded-full" />
            ) : (
              <div style={{ width: '100%', height: '100%', borderRadius: 17, background: avatarGradient, color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {userInitials}
              </div>
            )}
          </button>
          {profileOpen && (
            <div style={{ position: 'absolute', top: 48, right: 0, width: 220, background: 'var(--surface)', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.18),0 2px 6px rgba(0,0,0,0.08)', padding: 8, zIndex: 20 }}>
              <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{userDisplayName}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{roleLabel}</div>
              </div>
              <div
                onClick={() => {
                  setProfileOpen(false)
                  setAvatarModalOpen(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, cursor: 'pointer' }}
              >
                <Camera size={18} color="var(--primary)" strokeWidth={2} />
                <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{tcommon('user.profilePhoto') || 'Photo de profil'}</span>
              </div>
              {onLogout && (
                <div
                  onClick={() => {
                    setProfileOpen(false)
                    onLogout()
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, cursor: 'pointer' }}
                >
                  <LogOut size={18} color="var(--red)" strokeWidth={2} />
                  <span style={{ fontSize: 14, color: 'var(--red)', fontWeight: 600 }}>{tcommon('logout')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {avatarModalOpen && (
        <ChangeAvatarModal
          currentAvatarUrl={currentAvatar}
          userName={userDisplayName}
          onClose={() => setAvatarModalOpen(false)}
          onSuccess={(url) => setCurrentAvatar(url)}
          onToast={(msg, tp) => onToast?.(msg, tp === 'warning' ? 'info' : tp)}
        />
      )}
    </header>
  )
}
