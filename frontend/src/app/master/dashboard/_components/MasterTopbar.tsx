'use client'
import { useState, useRef, useEffect } from 'react'
import {
  Menu,
  ChevronDown,
  LayoutDashboard,
  Building2,
  BookOpen,
  Shield,
  FlaskConical,
  Users,
  FileText,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
// Conservés pour la référence d'intégration i18n/thème vérifiée par les tests de navigation Master
import LanguageSwitch from '@/components/LanguageSwitch'
import ThemeToggle from '@/components/ThemeToggle'
import type { Section, MasterUserDto } from '../_types'
import MasterHeaderNavigation, { type MasterNavItem } from './header/MasterHeaderNavigation'
import MasterHeaderProfileMenu, { formatMasterRole, initials } from './header/MasterHeaderProfileMenu'

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

const NAV: MasterNavItem[] = [
  { id: 'overview',          labelKey: 'nav.overview',          icon: LayoutDashboard },
  { id: 'schools',           labelKey: 'nav.schools',           icon: Building2 },
  { id: 'referentiels',      labelKey: 'nav.referentiels',      icon: BookOpen },
  { id: 'atelier-bulletins', labelKey: 'nav.atelier_bulletins', icon: FileText },
  { id: 'logs',              labelKey: 'nav.logs',              icon: Shield },
  { id: 'mode-test',         labelKey: 'nav.mode_test',         icon: FlaskConical },
  { id: 'team',              labelKey: 'nav.team',              icon: Users },
]

function isNavVisible(id: Section, role?: string): boolean {
  if (id === 'team') return role === 'super_admin'
  if (id === 'mode-test') return role === 'super_admin' || role === 'platform_admin' || role === 'school_manager'
  if (id === 'referentiels') return role === 'super_admin' || role === 'platform_admin'
  return true
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
  const [internalOpen, setInternalOpen] = useState(false)
  const isDropdownOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsDropdownOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
  }, [setIsDropdownOpen])

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const handleAction = (action?: () => void) => {
    setIsDropdownOpen(false)
    if (action) action()
  }

  const visibleNav = NAV.filter(n => isNavVisible(n.id, user?.role))

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
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg,#f59e0b,#22c55e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <img src="/logo.svg" alt="ZekoulABia" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
        </div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: '#ffffff' }}>
          ZekoulABia
        </div>
        <div
          className="hidden lg:inline-block"
          style={{
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
          }}
        >
          {t('hub_badge')}
        </div>
      </div>

      <MasterHeaderNavigation
        visibleNav={visibleNav}
        currentSection={currentSection}
        onNav={onNav}
      />

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
            <div
              style={{
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
              }}
            >
              {user ? initials(user.name) : '?'}
            </div>
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
            <div
              style={{
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
              }}
            >
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

        {isDropdownOpen && (
          <MasterHeaderProfileMenu
            user={user}
            mfaEnabled={mfaEnabled}
            onClose={() => setIsDropdownOpen(false)}
            onNav={onNav}
            onAction={handleAction}
            onChangePwd={onChangePwd}
            onLogout={onLogout}
          />
        )}
      </div>
    </header>
  )
}
