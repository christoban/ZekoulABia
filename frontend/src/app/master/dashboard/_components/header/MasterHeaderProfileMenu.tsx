'use client'

import { LogOut, KeyRound, ShieldCheck, ShieldAlert, Sun, Moon, Globe } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useT, useLanguage, useChangeLanguage } from '@/lib/i18n'
import type { Section, MasterUserDto } from '../../_types'

export function formatMasterRole(role?: string): string {
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

export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

interface Props {
  user: MasterUserDto | null
  mfaEnabled: boolean
  onClose: () => void
  onNav: (s: Section) => void
  onAction: (action?: () => void) => void
  onChangePwd?: () => void
  onLogout: () => void
}

/** Menu déroulant du profil Master (2FA, langue, thème, mot de passe, déconnexion) */
export default function MasterHeaderProfileMenu({
  user,
  mfaEnabled,
  onClose,
  onNav,
  onAction,
  onChangePwd,
  onLogout,
}: Props) {
  const t = useT('master')
  const { lang } = useLanguage()
  const changeLanguage = useChangeLanguage()
  const { setTheme, resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <>
      <div
        onClick={onClose}
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
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: 'var(--amber-light)',
                  color: 'var(--amber)',
                  whiteSpace: 'nowrap',
                }}
              >
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
          onClick={() => onAction(() => onNav('logs'))}
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 8,
          }}
        >
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
            onClick={() => onAction(onChangePwd)}
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
          onClick={() => onAction(onLogout)}
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
  )
}
