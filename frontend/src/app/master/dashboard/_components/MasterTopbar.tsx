'use client'
import { useState, useRef, useEffect } from 'react'
import { LogOut, Menu, UserPlus, KeyRound, ShieldCheck, ShieldAlert, ChevronDown } from 'lucide-react'
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

const NAV: { id: Section; label: string; dotColor: string }[] = [
  { id: 'overview',     label: "Vue d'ensemble",           dotColor: '#4ade80' },
  { id: 'schools',      label: 'Écoles',                   dotColor: '#d97706' },
  { id: 'referentiels', label: 'Référentiels Nationaux',   dotColor: '#60a5fa' },
  { id: 'logs',         label: 'Logs & Sécurité',          dotColor: '#94a3b8' },
]

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function MasterTopbar({
  user,
  currentSection,
  mfaEnabled,
  onNav,
  onLogout,
  onOpenMenu,
  onInviteSchool,
  onChangePwd,
  isMenuOpen: controlledOpen,
  setIsMenuOpen: setControlledOpen,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isDropdownOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsDropdownOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen

  const menuRef = useRef<HTMLDivElement>(null)

  // Fermeture lors d'un clic en dehors ou appui sur Échap
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
      padding: '0 16px', gap: 10, flexShrink: 0, position: 'relative', zIndex: 60
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 16px,#22c55e 16px,#22c55e 32px,#ef4444 32px,#ef4444 48px,#60a5fa 48px,#60a5fa 64px)'
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#22c55e)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} />
        </div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'white' }}>
          ZekoulABia
        </div>
      </div>

      <div className="hidden sm:inline-block" style={{
        background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
        fontSize: 11, fontWeight: 700, padding: '2px 8px',
        borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
        whiteSpace: 'nowrap'
      }}>HUB DE CONTRÔLE</div>

      {/* Desktop horizontal navigation */}
      <nav className="hidden md:flex" style={{ gap: 6, margin: '0 12px' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)}
            style={{
              padding: '6px 12px', borderRadius: 8,
              background: currentSection === n.id ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: currentSection === n.id ? 'white' : 'rgba(255,255,255,0.6)',
              fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              transition: 'all 0.12s'
            }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.dotColor }} />
            {n.label}
          </button>
        ))}
      </nav>

      {/* Right side: Desktop & Mobile user menu container */}
      <div ref={menuRef} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        {/* Desktop user badge & logout */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 10 }}>
          {mfaEnabled !== undefined && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: mfaEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: mfaEnabled ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700,
              color: mfaEnabled ? '#4ade80' : '#f87171'
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: mfaEnabled ? '#4ade80' : '#f87171' }} />
              {mfaEnabled ? 'MFA actif' : 'MFA inactif'}
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
            title="Menu du profil"
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{user?.name ?? 'Super Admin'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{user?.role ?? 'MASTER'}</div>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 12
            }}>
              {user ? initials(user.name) : '?'}
            </div>
            <ChevronDown size={14} style={{ opacity: 0.7, transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>

          <button id="edu-logout-btn" onClick={onLogout} style={{
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
            color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}><LogOut size={14} /> Déconnexion</button>
        </div>

        {/* Mobile action button: opens popover dropdown right below */}
        <div className="flex md:hidden" style={{ alignItems: 'center' }}>
          <button
            onClick={toggleDropdown}
            aria-label="Menu Super Admin"
            aria-expanded={isDropdownOpen}
            style={{
              background: isDropdownOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '5px 8px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              minHeight: 36,
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: 6,
              background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 11
            }}>
              {user ? initials(user.name) : '?'}
            </div>
            <Menu size={16} />
          </button>
        </div>

        {/* DROPDOWN POPOVER : Positionné exactement sous le bouton */}
        {isDropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 290,
              maxWidth: 'calc(100vw - 24px)',
              background: 'white',
              borderRadius: 14,
              boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e8e0d4',
              padding: '14px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              animation: 'dropdownFadeIn 0.15s ease-out both',
            }}
          >
            {/* Header Profil */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #f1ece4' }}>
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
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1209', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name ?? 'Super Admin'}
                </div>
                <div style={{ fontSize: 11, color: '#a89478', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.role ?? 'MASTER'} · {user?.email ?? 'master@zekoulabia.cm'}
                </div>
              </div>
            </div>

            {/* MFA Status Badge */}
            <div
              style={{
                background: mfaEnabled ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
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
                  <ShieldCheck size={16} color="#16a34a" />
                ) : (
                  <ShieldAlert size={16} color="#dc2626" />
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: mfaEnabled ? '#16a34a' : '#dc2626' }}>
                  {mfaEnabled ? '2FA Actif (TOTP)' : '2FA Inactif'}
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#a89478', fontWeight: 700 }}>
                SÉCURITÉ
              </span>
            </div>

            {/* Actions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {onInviteSchool && (
                <button
                  type="button"
                  onClick={() => handleAction(onInviteSchool)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid rgba(180, 83, 9, 0.15)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.12s',
                  }}
                >
                  <UserPlus size={16} color="#92400e" />
                  <span>Inviter un établissement</span>
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
                    background: 'var(--bg2, #faf7f2)',
                    color: '#1a1209',
                    border: '1px solid #e8e0d4',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.12s',
                  }}
                >
                  <KeyRound size={16} color="#6b5c45" />
                  <span>Modifier mon mot de passe</span>
                </button>
              )}
            </div>

            <div style={{ height: 1, background: '#f1ece4', margin: '2px 0' }} />

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
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid rgba(220, 38, 38, 0.2)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
                transition: 'background 0.12s',
              }}
            >
              <LogOut size={15} />
              <span>Se déconnecter</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
