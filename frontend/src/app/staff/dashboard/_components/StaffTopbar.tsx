'use client'

import { useState, useRef, useEffect } from 'react'
import { KeyRound, MoreVertical, Moon, Sun, Calendar, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { StaffSection, SessionUser } from '../_types'
import { useT } from '@/lib/i18n'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/NotificationBell'
import MobileMenuButton from '@/components/MobileMenuButton'
import CalendarTopbarButton from '@/components/CalendarTopbarButton'
import OfflineSyncButtonPopover from '@/components/OfflineSyncButtonPopover'
import CalendarProgressModal from '@/components/CalendarProgressModal'

const SECTION_KEY: Record<string, string> = {
  'grille-horaire': 'grilleHoraire',
  'suivi-eleves': 'suiviEleves',
  'eleves-affectations': 'elevesAffectations',
  'import-eleves': 'importEleves',
  'moderation-messagerie': 'moderationMessagerie',
  'mon-profil-rh': 'monProfilRh',
  'sync-offline': 'syncOffline',
  'bulletin-validation': 'bulletinValidation',
  'configuration': 'configuration',
}

interface Props {
  section: StaffSection
  periodLabel?: string
  onChangePassword?: () => void
  onNav?: (section: string) => void
  onMenuClick?: () => void
  sessionUser?: SessionUser | null
  onLogout?: () => void
}

export default function StaffTopbar({
  section,
  periodLabel,
  onChangePassword,
  onNav,
  onMenuClick,
  sessionUser,
  onLogout,
}: Props) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isDark = (theme === 'system' ? resolvedTheme : theme) === 'dark'

  const [kebabOpen, setKebabOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)

  const kebabRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const userDisplayName = sessionUser?.firstName
    ? `${sessionUser.firstName} ${sessionUser.nomComplet?.split(' ').slice(1).join(' ') || ''}`.trim()
    : (sessionUser?.nomComplet || 'Membre Staff')

  const userInitials = sessionUser?.firstName
    ? `${sessionUser.firstName[0]}${sessionUser.nomComplet?.split(' ')?.[1]?.[0] || ''}`.toUpperCase()
    : 'ST'

  return (
    <header
      style={{
        height: 52,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 10,
        flexShrink: 0,
      }}
    >
      {onMenuClick && <MobileMenuButton onClick={onMenuClick} />}

      <div
        className="truncate flex-1 min-w-0"
        style={{
          fontFamily: 'var(--font-spectral),Spectral,serif',
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--text)',
        }}
      >
        {tnav(`pageTitle.staff_${SECTION_KEY[section] ?? section}`)}
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

      {/* Boutons d'actions */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Cloche de notifications : toujours visible sur mobile et desktop */}
        <NotificationBell onNav={onNav} />

        {/* Menu Kebab — mobile uniquement */}
        <div ref={kebabRef} className="relative md:hidden flex-shrink-0">
          <button
            onClick={() => setKebabOpen(o => !o)}
            aria-label="Options"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <MoreVertical size={19} color="var(--text)" strokeWidth={2} />
          </button>

          {kebabOpen && (
            <div
              style={{
                position: 'absolute',
                top: 44,
                right: 0,
                width: 220,
                background: 'var(--surface)',
                borderRadius: 14,
                boxShadow: '0 8px 24px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.06)',
                border: '1px solid var(--border)',
                padding: 6,
                zIndex: 50,
              }}
            >
              <div
                onClick={() => {
                  setTheme(isDark ? 'light' : 'dark')
                  setKebabOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                {isDark ? <Sun size={17} /> : <Moon size={17} />}
                <span>{tcommon('theme.toggle') ?? 'Thème'}</span>
              </div>

              <div
                onClick={() => {
                  setCalendarModalOpen(true)
                  setKebabOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                <Calendar size={17} />
                <span>{tcommon('calendar.title') ?? 'Calendrier'}</span>
              </div>

              {onChangePassword && (
                <div
                  onClick={() => {
                    onChangePassword()
                    setKebabOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    color: 'var(--text)',
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  <KeyRound size={17} />
                  <span>{tcommon('auth.changePassword') ?? 'Changer mot de passe'}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profil utilisateur mobile (avatar circulaire tactile) */}
        {sessionUser && (
          <div ref={profileRef} className="relative flex-shrink-0 md:hidden">
            <button
              onClick={() => setProfileOpen(o => !o)}
              aria-label={userDisplayName}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                border: 'none',
                background: 'linear-gradient(135deg, var(--teal, #0d9488), var(--blue, #2563eb))',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {userInitials}
            </button>

            {profileOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 44,
                  right: 0,
                  width: 220,
                  background: 'var(--surface)',
                  borderRadius: 14,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.06)',
                  border: '1px solid var(--border)',
                  padding: 8,
                  zIndex: 50,
                }}
              >
                <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{userDisplayName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{sessionUser.role}</div>
                </div>

                {onNav && (
                  <div
                    onClick={() => {
                      setProfileOpen(false)
                      onNav('mon-profil-rh')
                    }}
                    style={{
                      padding: '9px 10px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    {tnav('sidebar.monProfilRh') ?? 'Mon profil'}
                  </div>
                )}

                {onLogout && (
                  <div
                    onClick={() => {
                      setProfileOpen(false)
                      onLogout()
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 10px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--red, #ef4444)',
                    }}
                  >
                    <LogOut size={15} />
                    <span>{tcommon('auth.logout') ?? 'Déconnexion'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions secondaires desktop complètes */}
        <div className="hidden md:flex items-center gap-2">
          <CalendarTopbarButton />
          <OfflineSyncButtonPopover namespace="staff" />
          {onChangePassword && (
            <button
              onClick={onChangePassword}
              title={tcommon('auth.changePassword')}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <KeyRound size={15} color="var(--text2)" />
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* Modal calendrier mobile */}
      <CalendarProgressModal
        isOpen={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
      />
    </header>
  )
}
