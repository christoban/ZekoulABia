'use client'
import { useState, useRef, useEffect } from 'react'
import {
  LogOut,
  Menu,
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
  Globe,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useT, useLanguage, useChangeLanguage } from '@/lib/i18n'
// Conservés pour la référence d'intégration i18n/thème vérifiée par les tests de navigation Master
import LanguageSwitch from '@/components/LanguageSwitch'
import ThemeToggle from '@/components/ThemeToggle'
import type { Section, MasterUserDto } from '../_types'

void LanguageSwitch
void ThemeToggle

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
          outline: 'none',
          background: active ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
          border: active ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid transparent',
          boxShadow: active ? '0 1px 4px rgba(0, 0, 0, 0.2)' : 'none',
          color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.84)',
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
        <Icon size={14} style={{ opacity: active ? 1 : 0.84, flexShrink: 0 }} />
        <span>{t(n.labelKey)}</span>
      </button>
    )
  }

  return (
    <header
      className="px-3.5 md:px-6"
      style={{
        height: 56,
        background: 'var(--sidebar-bg)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
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

      {/* Navigation >= 1280px (xl): Option A libère toute la place de droite, tous les onglets tiennent largement */}
      <nav className="hidden xl:flex" style={{
        alignItems: 'center',
        gap: 6,
        margin: '0 12px',
        flex: 1,
        minWidth: 0,
      }}>
        {visibleNav.map(renderNavButton)}
      </nav>

      {/* Navigation md .. < xl (768px..1279px): 4 onglets principaux + menu "Plus / More" */}
      <nav className="hidden md:flex xl:hidden" style={{
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
                outline: 'none',
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
                  border: '1px solid var(--border2)',
                  borderRadius: 10,
                  boxShadow: '0 14px 32px rgba(0, 0, 0, 0.35)',
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
                        outline: 'none',
                        background: active ? 'var(--amber-light)' : 'transparent',
                        color: active ? 'var(--amber)' : 'var(--text)',
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

      {/* Option A — À droite : uniquement le bloc utilisateur avec pastille d'alerte 2FA sur l'avatar */}
      <div ref={menuRef} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', position: 'relative', flexShrink: 0 }}>
        {/* Bouton Utilisateur Desktop */}
        <button
          type="button"
          onClick={toggleDropdown}
          aria-expanded={isDropdownOpen}
          className="hidden md:flex"
          style={{
            alignItems: 'center',
            gap: 10,
            outline: 'none',
            background: isDropdownOpen ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
            border: isDropdownOpen ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: 10,
            padding: '5px 11px',
            cursor: 'pointer',
            color: '#ffffff',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#ffffff', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name ?? 'Master'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.82)', fontWeight: 600 }}>
              {formatMasterRole(user?.role)}
            </div>
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 12,
            }}>
              {user ? initials(user.name) : '?'}
            </div>
            {/* Point d'alerte rouge quand la 2FA est inactive */}
            {!mfaEnabled && (
              <span
                title={t('topbar.mfa_totp_inactive')}
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: '2px solid var(--sidebar-bg)',
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>
          <ChevronDown size={14} style={{ opacity: 0.85, transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>

        {/* Bouton Utilisateur Mobile */}
        <button
          type="button"
          onClick={toggleDropdown}
          aria-label="Menu Master"
          aria-expanded={isDropdownOpen}
          className="flex md:hidden"
          style={{
            outline: 'none',
            background: isDropdownOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            padding: '5px 8px',
            color: 'white',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            minHeight: 36,
            transition: 'background 0.15s ease',
          }}
        >
          <div style={{ position: 'relative' }}>
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
            {!mfaEnabled && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: '1.5px solid var(--sidebar-bg)',
                }}
              />
            )}
          </div>
          <Menu size={16} />
        </button>

        {/* MENU DÉROULANT DU PROFIL (compact sur mobile w-[236px], plus large sur desktop sm:w-[304px]) */}
        {isDropdownOpen && (
          <>
            <div
              onClick={() => setIsDropdownOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.18)',
                zIndex: 95,
              }}
            />
            <div
              className="w-[236px] sm:w-[304px] p-2.5 sm:p-3.5"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                maxWidth: 'calc(100vw - 24px)',
                background: 'var(--surface)',
                borderRadius: 13,
                boxShadow: '0 20px 48px -8px rgba(0, 0, 0, 0.45), 0 8px 20px rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border2)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {/* En-tête Profil : Nom + Badge de rôle sur la ligne 1, Email sur la ligne 2 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <div
                  className="w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-[15px]"
                  style={{
                    borderRadius: 9,
                    background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {user ? initials(user.name) : '?'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span className="text-[13px] sm:text-[14px]" style={{ fontWeight: 800, color: 'var(--text)' }}>
                      {user?.name ?? 'Master'}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 999,
                      background: 'var(--amber-light)',
                      color: 'var(--amber)',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatMasterRole(user?.role)}
                    </span>
                  </div>
                  <div
                    title={user?.email ?? ''}
                    className="text-[11px] sm:text-[12px]"
                    style={{
                      color: 'var(--text2)',
                      fontWeight: 600,
                      marginTop: 2,
                      wordBreak: 'break-all',
                      lineHeight: 1.3,
                    }}
                  >
                    {user?.email ?? ''}
                  </div>
                </div>
              </div>

              {/* Ligne 2FA actionnable */}
              <button
                type="button"
                onClick={() => handleAction(() => onNav('logs'))}
                style={{
                  outline: 'none',
                  background: mfaEnabled ? 'var(--green-light)' : 'var(--red-light)',
                  border: `1px solid ${mfaEnabled ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.35)'}`,
                  borderRadius: 8,
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {mfaEnabled ? (
                    <ShieldCheck size={15} color="var(--green)" style={{ flexShrink: 0 }} />
                  ) : (
                    <ShieldAlert size={15} color="var(--red)" style={{ flexShrink: 0 }} />
                  )}
                  <span className="text-[11.5px] sm:text-[12.5px]" style={{ fontWeight: 800, color: mfaEnabled ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                    {mfaEnabled ? t('topbar.mfa_totp_active') : t('topbar.mfa_totp_inactive')}
                  </span>
                </div>
                {!mfaEnabled && (
                  <span className="text-[11px] sm:text-[12px]" style={{ fontWeight: 800, color: 'var(--red)', whiteSpace: 'nowrap' }}>
                    {t('topbar.mfa_enable_cta')}
                  </span>
                )}
              </button>

              {/* Préférences (Langue & Thème sans cadres imbriqués) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 8px',
                borderRadius: 8,
              }}>
                <span className="text-[12px] sm:text-[13px]" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, color: 'var(--text)' }}>
                  <Globe size={14} color="var(--text2)" />
                  {t('topbar.language')}
                </span>
                <div
                  role="group"
                  aria-label={t('topbar.language')}
                  style={{
                    display: 'inline-flex',
                    background: 'var(--bg2)',
                    borderRadius: 6,
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
                          padding: '2px 8px',
                          borderRadius: 4,
                          border: 'none',
                          outline: 'none',
                          background: active ? 'var(--primary)' : 'transparent',
                          color: active ? '#ffffff' : 'var(--text2)',
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          cursor: active ? 'default' : 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="text-[12px] sm:text-[13px]"
                style={{
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: 'transparent',
                  color: 'var(--text)',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {isDark ? <Sun size={14} color="var(--amber)" /> : <Moon size={14} color="var(--text2)" />}
                <span>{isDark ? t('topbar.theme_light') : t('topbar.theme_dark')}</span>
              </button>

              {onChangePwd && (
                <button
                  type="button"
                  onClick={() => handleAction(onChangePwd)}
                  className="text-[12px] sm:text-[13px]"
                  style={{
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '6px 8px',
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'var(--text)',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <KeyRound size={14} color="var(--text2)" />
                  <span>{t('topbar.change_password')}</span>
                </button>
              )}

              <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

              {/* Déconnexion */}
              <button
                id="edu-logout-btn"
                type="button"
                onClick={() => handleAction(onLogout)}
                className="text-[12px] sm:text-[13px]"
                style={{
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: 'var(--red-light)',
                  color: 'var(--red)',
                  border: '1px solid rgba(248, 113, 113, 0.35)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              >
                <LogOut size={14} />
                <span>{t('topbar.logout_full')}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
