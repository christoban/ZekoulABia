'use client'
import { useState, useRef, useEffect } from 'react'
import {
  LogOut,
  Menu,
  UserPlus,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  Sun,
  Moon,
  LayoutDashboard,
  Building2,
  BookOpen,
  Shield,
  FlaskConical,
  Users,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useT, useLanguage, useChangeLanguage } from '@/lib/i18n'
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

const NAV: { id: Section; labelKey: string; icon: LucideIcon }[] = [
  { id: 'overview',     labelKey: 'nav.overview',     icon: LayoutDashboard },
  { id: 'schools',      labelKey: 'nav.schools',      icon: Building2 },
  { id: 'referentiels', labelKey: 'nav.referentiels', icon: BookOpen },
  { id: 'logs',         labelKey: 'nav.logs',         icon: Shield },
  { id: 'mode-test',    labelKey: 'nav.mode_test',    icon: FlaskConical },
  { id: 'team',         labelKey: 'nav.team',         icon: Users },
]

function isNavVisible(id: Section, role?: string): boolean {
  if (id === 'team') return role === 'super_admin'
  if (id === 'mode-test') return role === 'super_admin' || role === 'platform_admin' || role === 'school_manager'
  if (id === 'referentiels') return role === 'super_admin' || role === 'platform_admin'
  return true
}

function formatMasterRole(role?: string): string {
  switch ((role ?? '').toLowerCase()) {
    case 'super_admin':
      return 'Super Admin'
    case 'platform_admin':
      return 'Platform Admin'
    case 'school_manager':
      return 'School Manager'
    case 'support':
      return 'Support'
    default:
      return 'Master'
  }
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
  const { lang } = useLanguage()
  const changeLanguage = useChangeLanguage()
  const { setTheme, resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [internalOpen, setInternalOpen] = useState(false)
  const isDropdownOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsDropdownOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen

  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false)
        setMoreOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [setIsDropdownOpen])

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const handleAction = (action?: () => void) => {
    setIsDropdownOpen(false)
    if (action) action()
  }

  const visibleNav = NAV.filter(n => isNavVisible(n.id, user?.role))
  const primaryNav = visibleNav.slice(0, 4)
  const overflowNav = visibleNav.slice(4)
  const isOverflowActive = overflowNav.some(n => n.id === currentSection)

  const renderNavButton = (n: { id: Section; labelKey: string; icon: LucideIcon }) => {
    const Icon = n.icon
    const active = currentSection === n.id
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => onNav(n.id)}
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          background: active ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
          border: active ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid transparent',
          boxShadow: active ? '0 1px 4px rgba(0, 0, 0, 0.2)' : 'none',
          color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.82)',
          fontSize: 12.5,
          fontWeight: active ? 800 : 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition: 'all 0.14s ease',
        }}
      >
        <Icon size={14} style={{ opacity: active ? 1 : 0.82, flexShrink: 0 }} />
        <span>{t(n.labelKey)}</span>
      </button>
    )
  }

  return (
    <header style={{
      height: 56,
      background: 'var(--sidebar-bg)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 12,
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Brand + Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'linear-gradient(135deg,#f59e0b,#22c55e)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <img src="/logo.svg" alt="ZekoulABia" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
        </div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: '#ffffff' }}>
          ZekoulABia
        </div>
        <div className="hidden lg:inline-block" style={{
          background: 'rgba(245, 158, 11, 0.18)',
          color: '#fcd34d',
          fontSize: 10.5,
          fontWeight: 800,
          padding: '3px 9px',
          borderRadius: 6,
          border: '1px solid rgba(245, 158, 11, 0.35)',
          letterSpacing: '0.03em',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {t('hub_badge')}
        </div>
      </div>

      {/* Navigation >= 1536px (2xl): all tabs visible with generous spacing */}
      <nav className="hidden 2xl:flex" style={{
        alignItems: 'center',
        gap: 6,
        margin: '0 12px',
        flex: 1,
        minWidth: 0,
      }}>
        {visibleNav.map(renderNavButton)}
      </nav>

      {/* Navigation md .. < 2xl (< 1536px): 4 primary tabs + "Plus / More" dropdown so long FR labels never overflow */}
      <nav className="hidden md:flex 2xl:hidden" style={{
        alignItems: 'center',
        gap: 6,
        margin: '0 8px',
        flex: 1,
        minWidth: 0,
      }}>
        {primaryNav.map(renderNavButton)}
        {overflowNav.length > 0 && (
          <div ref={moreRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setMoreOpen(v => !v)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: isOverflowActive || moreOpen ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                border: isOverflowActive ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(255, 255, 255, 0.14)',
                color: isOverflowActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                fontSize: 12.5,
                fontWeight: isOverflowActive ? 800 : 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              <MoreHorizontal size={15} />
              <span>{t('nav.more')}</span>
              <ChevronDown size={13} style={{ opacity: 0.8, transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            {moreOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  minWidth: 210,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  boxShadow: '0 10px 26px rgba(0, 0, 0, 0.25)',
                  padding: 6,
                  zIndex: 90,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {overflowNav.map(n => {
                  const Icon = n.icon
                  const active = currentSection === n.id
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onNav(n.id)
                        setMoreOpen(false)
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 7,
                        background: active ? 'var(--amber-light)' : 'transparent',
                        color: active ? 'var(--primary)' : 'var(--text)',
                        border: 'none',
                        fontSize: 13,
                        fontWeight: active ? 800 : 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                    >
                      <Icon size={15} />
                      <span>{t(n.labelKey)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Right side: Translucent dark controls + Actionable MFA + User profile menu (no redundant Logout button) */}
      <div ref={menuRef} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, position: 'relative', flexShrink: 0 }}>
        {/* Translucent dark Language & Theme switchers (harmonized with dark topbar, no bright white glare or orange focus ring) */}
        <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 8 }}>
          <div
            role="group"
            aria-label={t('topbar.language')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: 8,
              padding: 2,
              gap: 2,
            }}
          >
            {(['fr', 'en'] as const).map(l => {
              const active = lang === l
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => { if (!active) changeLanguage(l) }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: 'none',
                    outline: 'none',
                    background: active ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
                    color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.72)',
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: active ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    lineHeight: 1.2,
                    transition: 'all 0.14s ease',
                  }}
                >
                  {l}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? t('topbar.theme_light') : t('topbar.theme_dark')}
            aria-label={isDark ? t('topbar.theme_light') : t('topbar.theme_dark')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              outline: 'none',
              color: 'rgba(255, 255, 255, 0.88)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.14s ease',
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {/* Desktop MFA actionable button & User profile trigger */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 10 }}>
          {mfaEnabled !== undefined && (
            mfaEnabled ? (
              <button
                type="button"
                onClick={() => onNav('logs')}
                className="hidden xl:inline-flex"
                style={{
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(34, 197, 94, 0.16)',
                  border: '1px solid rgba(74, 222, 128, 0.35)',
                  borderRadius: 8,
                  padding: '5px 10px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#86efac',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <ShieldCheck size={14} />
                <span>{t('topbar.mfa_active')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNav('logs')}
                className="hidden xl:inline-flex"
                title={t('topbar.mfa_enable_cta')}
                style={{
                  alignItems: 'center',
                  gap: 6,
                  background: '#dc2626',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: 8,
                  padding: '5px 11px',
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)',
                }}
              >
                <ShieldAlert size={14} />
                <span>{t('topbar.mfa_enable_cta')}</span>
              </button>
            )
          )}

          <button
            type="button"
            onClick={toggleDropdown}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: isDropdownOpen ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: 9,
              padding: '4px 10px',
              cursor: 'pointer',
              color: '#ffffff',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#ffffff', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name ?? 'Master'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.82)', fontWeight: 600 }}>
                {formatMasterRole(user?.role)}
              </div>
            </div>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 12,
              flexShrink: 0,
            }}>
              {user ? initials(user.name) : '?'}
            </div>
            <ChevronDown size={14} style={{ opacity: 0.85, transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
        </div>

        {/* Mobile action button */}
        <div className="flex md:hidden" style={{ alignItems: 'center', gap: 6 }}>
          <button
            type="button"
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
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 11,
            }}>
              {user ? initials(user.name) : '?'}
            </div>
            <Menu size={16} />
          </button>
        </div>

        {/* DROPDOWN POPOVER */}
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
                <div style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatMasterRole(user?.role)} · {user?.email ?? ''}
                </div>
              </div>
            </div>

            {/* Langue & Thème Clair/Sombre dans le menu déroulant */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <LanguageSwitch compact />
              <ThemeToggle />
            </div>

            {/* MFA Status Actionable Button */}
            <button
              type="button"
              onClick={() => handleAction(() => onNav('logs'))}
              style={{
                background: mfaEnabled ? 'rgba(34, 197, 94, 0.1)' : '#dc2626',
                border: `1px solid ${mfaEnabled ? 'rgba(34, 197, 94, 0.25)' : '#b91c1c'}`,
                borderRadius: 8,
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {mfaEnabled ? (
                  <ShieldCheck size={16} color="var(--green)" />
                ) : (
                  <ShieldAlert size={16} color="#ffffff" />
                )}
                <span style={{ fontSize: 12, fontWeight: 800, color: mfaEnabled ? 'var(--green)' : '#ffffff' }}>
                  {mfaEnabled ? t('topbar.mfa_totp_active') : t('topbar.mfa_enable_cta')}
                </span>
              </div>
              <span style={{ fontSize: 10, color: mfaEnabled ? 'var(--text3)' : 'rgba(255,255,255,0.85)', fontWeight: 800 }}>
                {t('topbar.security_badge')}
              </span>
            </button>

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
              id="edu-logout-btn"
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
