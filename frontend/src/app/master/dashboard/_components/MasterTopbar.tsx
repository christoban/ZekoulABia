'use client'
import { useState, useRef, useEffect } from 'react'
import { LogOut, Menu, UserPlus, KeyRound, ShieldCheck, ShieldAlert, ChevronDown, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useT } from '@/lib/i18n'
import LanguageSwitch from '@/components/LanguageSwitch'
import ThemeToggle from '@/components/ThemeToggle'
import type { Section, MasterUserDto } from '../_types'

interface Props {
  user: MasterUserDto | null
  currentSection: Section
  mfaEnabled: boolean
  onNav: (s: Section) => void
  onLogout: () => void
  onOpenMenu?: () => void
  onInviteSchool?: () => void
  onChangePwd?: () => void
  isMenuOpen?: boolean
  setIsMenuOpen?: (open: boolean) => void
}

const NAV: { id: Section; labelKey: string; dotColor: string }[] = [
  { id: 'overview',     labelKey: 'nav.overview',     dotColor: '#4ade80' },
  { id: 'schools',      labelKey: 'nav.schools',      dotColor: '#d97706' },
  { id: 'referentiels', labelKey: 'nav.referentiels', dotColor: '#60a5fa' },
  { id: 'logs',         labelKey: 'nav.logs',         dotColor: '#94a3b8' },
  { id: 'mode-test',    labelKey: 'nav.mode_test',    dotColor: '#ef4444' },
  { id: 'team',         labelKey: 'nav.team',         dotColor: '#a855f7' },
]

function isNavVisible(id: Section, role?: string): boolean {
  if (id === 'team') return role === 'super_admin'
  if (id === 'mode-test') return role === 'super_admin' || role === 'platform_admin' || role === 'school_manager'
  if (id === 'referentiels') return role === 'super_admin' || role === 'platform_admin'
  return true
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function MasterTopbar({
  user,
  currentSection,
  mfaEnabled,
  onNav,
  onLogout,
  onInviteSchool,
  onChangePwd,
  isMenuOpen: controlledOpen,
  setIsMenuOpen: setControlledOpen,
}: Props) {
  const t = useT('master')
  const { setTheme, resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [internalOpen, setInternalOpen] = useState(false)
  const isDropdownOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsDropdownOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDropdownOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDropdownOpen, setIsDropdownOpen])

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const handleAction = (action?: () => void) => {
    setIsDropdownOpen(false)
    if (action) action()
  }

  return (
    <header style={{
      height: 54, background: 'var(--sidebar-bg)', display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 8, flexShrink: 0, position: 'sticky', top: 0, left: 0, right: 0, zIndex: 60,
      width: '100%', boxSizing: 'border-box'
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 16px,#22c55e 16px,#22c55e 32px,#ef4444 32px,#ef4444 48px,#60a5fa 48px,#60a5fa 64px)'
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          <img src="/logo.svg" alt="ZekoulABia" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
        </div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'white' }}>
          ZekoulABia
        </div>
      </div>

      <div className="hidden lg:inline-block" style={{
        background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)',
        fontSize: 10.5, fontWeight: 800, padding: '2px 8px',
        borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
        whiteSpace: 'nowrap', flexShrink: 0
      }}>{t('hub_badge')}</div>

      {/* Desktop horizontal navigation (scrollable on medium screens) */}
      <nav className="hidden md:flex" style={{
        gap: 4, margin: '0 8px', flex: 1, minWidth: 0,
        overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch'
      }}>
        {NAV.filter(n => isNavVisible(n.id, user?.role)).map(n => (
          <button key={n.id} onClick={() => onNav(n.id)}
            style={{
              padding: '6px 10px', borderRadius: 8,
              background: currentSection === n.id ? 'rgba(255,255,255,0.16)' : 'transparent',
              color: currentSection === n.id ? 'white' : 'rgba(255,255,255,0.65)',
              fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.12s'
            }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.dotColor, flexShrink: 0 }} />
            {t(n.labelKey)}
          </button>
        ))}
      </nav>

      {/* Right side: Desktop & Mobile controls */}
      <div ref={menuRef} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, position: 'relative', flexShrink: 0 }}>
        {/* Language & Theme toggles always accessible */}
        <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 6 }}>
          <LanguageSwitch compact />
          <ThemeToggle />
        </div>

        {/* Desktop user badge & logout */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8 }}>
          {mfaEnabled !== undefined && (
            <div className="hidden xl:flex" style={{
              alignItems: 'center', gap: 5,
              background: mfaEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: mfaEnabled ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '3px 9px', fontSize: 11.5, fontWeight: 700,
              color: mfaEnabled ? '#4ade80' : '#f87171', whiteSpace: 'nowrap'
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: mfaEnabled ? '#4ade80' : '#f87171' }} />
              {mfaEnabled ? t('topbar.mfa_active') : t('topbar.mfa_inactive')}
            </div>
          )}

          <button
            onClick={toggleDropdown}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: isDropdownOpen ? 'rgba(255,255,255,0.15)' : 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '4px 8px',
              cursor: 'pointer',
              color: 'white',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'white', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name ?? 'Master'}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{user?.role ?? 'MASTER'}</div>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0
            }}>
              {user ? initials(user.name) : '?'}
            </div>
            <ChevronDown size={14} style={{ opacity: 0.7, transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>

          <button id="edu-logout-btn" onClick={onLogout} className="hidden lg:flex" style={{
            padding: '6px 10px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
            color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
            alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
          }}><LogOut size={14} /> {t('topbar.logout')}</button>
        </div>

        {/* Mobile action button */}
        <div className="flex md:hidden" style={{ alignItems: 'center', gap: 6 }}>
          <LanguageSwitch compact />
          <button
            onClick={toggleDropdown}
            aria-label="Menu Master"
            aria-expanded={isDropdownOpen}
            style={{
              background: isDropdownOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '5px 8px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              minHeight: 36,
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 11
            }}>
              {user ? initials(user.name) : '?'}
            </div>
            <Menu size={16} />
          </button>
        </div>

        {/* DROPDOWN POPOVER (adapté Mode Clair / Sombre & Mobile / Desktop) */}
        {isDropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 292,
              maxWidth: 'calc(100vw - 24px)',
              background: 'var(--surface)',
              borderRadius: 14,
              boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.28), 0 4px 12px rgba(0, 0, 0, 0.12)',
              border: '1px solid var(--border)',
              padding: 14,
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Header Profil */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                {user ? initials(user.name) : '?'}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name ?? 'Master'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.role ?? 'MASTER'} · {user?.email ?? ''}
                </div>
              </div>
            </div>

            {/* Langue & Thème Clair/Sombre (toujours accessibles dans le menu) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <LanguageSwitch compact />
              <button
                type="button"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
                <span>{isDark ? t('topbar.theme_light') : t('topbar.theme_dark')}</span>
              </button>
            </div>

            {/* MFA Status Badge */}
            <div
              style={{
                background: mfaEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${mfaEnabled ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                borderRadius: 8,
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {mfaEnabled ? (
                  <ShieldCheck size={16} color="var(--green)" />
                ) : (
                  <ShieldAlert size={16} color="var(--red)" />
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: mfaEnabled ? 'var(--green)' : 'var(--red)' }}>
                  {mfaEnabled ? t('topbar.mfa_totp_active') : t('topbar.mfa_totp_inactive')}
                </span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700 }}>
                {t('topbar.security_badge')}
              </span>
            </div>

            {/* Actions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {onInviteSchool && user?.role !== 'support' && (
                <button
                  type="button"
                  onClick={() => handleAction(onInviteSchool)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'var(--amber-light)',
                    color: 'var(--amber)',
                    border: '1px solid rgba(217, 119, 6, 0.25)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <UserPlus size={16} />
                  <span>{t('topbar.invite_school')}</span>
                </button>
              )}

              {onChangePwd && (
                <button
                  type="button"
                  onClick={() => handleAction(onChangePwd)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: 'var(--bg2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <KeyRound size={16} color="var(--text2)" />
                  <span>{t('topbar.change_password')}</span>
                </button>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

            {/* Logout Button */}
            <button
              type="button"
              onClick={() => handleAction(onLogout)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--red-light)',
                color: 'var(--red)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
              }}
            >
              <LogOut size={15} />
              <span>{t('topbar.logout_full')}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
