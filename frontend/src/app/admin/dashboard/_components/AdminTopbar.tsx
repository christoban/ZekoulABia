'use client'
import { useState, useEffect, useRef } from 'react'
import { KeyRound, MoreVertical, Bell, Menu, Sun, Moon, LogOut } from 'lucide-react'
import { useT, useLanguage } from '@/lib/i18n'
import { useTheme } from 'next-themes'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/NotificationBell'
import { useNotifications } from '@/hooks/NotificationContext'

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
  const { lang } = useLanguage()
  const { recentNotifications, unreadCount, markAsRead, registerSeen } = useNotifications()
  const { setTheme, resolvedTheme } = useTheme()

  const [todayLabel, setTodayLabel] = useState('')
  // Reproduction fidele de l'app bar de la maquette Android pour <md : boutons circulaires
  // transparents (pas de bordure), panneau notifications + panneau "..." (theme/mot de passe)
  // propres a cette taille d'ecran. A partir de md, pas d'equivalent dans la maquette — on garde
  // la convention desktop existante (ThemeToggle/NotificationBell/KeyRound en boutons carres
  // bordes, deja en place).
  const [notifOpen, setNotifOpen] = useState(false)
  const [kebabOpen, setKebabOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const kebabRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const userDisplayName = sessionUser?.nomComplet ?? sessionUser?.firstName ?? tcommon('user.fallbackName')
  const userInitials = userDisplayName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)

  useEffect(() => {
    const locale = lang === 'en' ? 'en-US' : 'fr-FR'
    const d = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    setTodayLabel(d.charAt(0).toUpperCase() + d.slice(1))
  }, [lang])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setKebabOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Un seul panneau ouvert a la fois — evite que notif/kebab/profil se chevauchent visuellement
  // (chacun est positionne independamment par rapport a son propre bouton).
  const toggleNotif = () => {
    setKebabOpen(false)
    setProfileOpen(false)
    setNotifOpen(o => {
      const next = !o
      if (next) registerSeen()
      return next
    })
  }

  const toggleKebab = () => {
    setNotifOpen(false)
    setProfileOpen(false)
    setKebabOpen(o => !o)
  }

  const toggleProfile = () => {
    setNotifOpen(false)
    setKebabOpen(false)
    setProfileOpen(o => !o)
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <header
      className="px-2 py-[6px] gap-1 md:px-[16px] md:gap-[8px] md:h-[40px] md:border-b-[1px] md:border-[var(--border)]"
      style={{ background: 'var(--surface)', display: 'flex', alignItems: 'center', flexShrink: 0, position: 'relative', boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}
    >
      {/* Hamburger — reproduction maquette : cercle 44px transparent, sous md uniquement */}
      {onMenuClick && (
        <button onClick={onMenuClick} aria-label="Menu" className="md:hidden"
          style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
          <Menu size={22} color="var(--text)" strokeWidth={2} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="text-[17px] md:text-[16px] truncate" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
          {title}
        </div>
        {todayLabel && (
          <div className="text-[11.5px] md:hidden truncate" style={{ color: 'var(--text3)' }}>{todayLabel}</div>
        )}
      </div>
      {todayLabel && (
        <span className="hidden lg:inline" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '3px 8px', fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>
          📅 {todayLabel}
        </span>
      )}

      {/* Notifications — mobile : cercle 44px transparent + pastille de presence + panneau propre */}
      <div ref={notifRef} className="relative md:hidden flex-shrink-0">
        <button onClick={toggleNotif} aria-label={t('topbar.notifications')}
          style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}>
          <Bell size={21} color="var(--text)" strokeWidth={2} />
          {unreadCount > 0 && (
            <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', border: '1.5px solid var(--surface)' }} />
          )}
        </button>
        {notifOpen && (
          <div style={{ position: 'absolute', top: 48, right: -8, width: 290, maxHeight: 360, overflowY: 'auto', background: 'var(--surface)', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.18),0 2px 6px rgba(0,0,0,0.08)', padding: 6, zIndex: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '9px 10px 6px' }}>{t('topbar.notifications')}</div>
            {recentNotifications.length === 0 ? (
              <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('topbar.no_notifications')}</div>
            ) : [...recentNotifications].sort((a, b) => Number(a.isRead) - Number(b.isRead)).slice(0, 8).map(n => (
              <div key={n.id} onClick={() => !n.isRead && markAsRead(n.id)}
                style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 10, cursor: n.isRead ? 'default' : 'pointer', background: n.isRead ? 'transparent' : 'var(--bg2)' }}>
                {!n.isRead && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', marginTop: 5, flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>{n.body}</div>
                </div>
              </div>
            ))}
            {onNavigate && (
              <button onClick={() => { setNotifOpen(false); onNavigate('notifications') }}
                style={{ width: '100%', padding: '10px 10px 6px', background: 'none', border: 'none', color: 'var(--green)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                {t('topbar.view_all_notifications')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Kebab — mobile : cercle 44px transparent + panneau 216px (Theme / Mot de passe) */}
      <div ref={kebabRef} className="relative md:hidden flex-shrink-0">
        <button onClick={toggleKebab} aria-label="Menu"
          style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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

      {/* Actions secondaires desktop — pas d'équivalent maquette à partir de md, convention existante inchangée */}
      <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <ThemeToggle />
        <NotificationBell onNav={onNavigate} />
        {onChangePassword && (
          <button onClick={onChangePassword} title={t('topbar.change_password')}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <KeyRound size={15} color="var(--text2)" />
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
