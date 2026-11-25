'use client'

import { Copy, Check, MailCheck, Eye, EyeOff, X } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface RevealedTeamCredentials {
  email: string
  name: string
  temporaryPassword: string
  emailSent: boolean
}

interface Props {
  credentials: RevealedTeamCredentials
  showFallbackPwd: boolean
  copied: boolean
  onToggleFallbackPwd: () => void
  onCopyPassword: (pwd: string) => void
  onDismiss: () => void
}

/** Bandeau de confirmation d'envoi de l'email d'invitation + mot de passe de secours */
export default function TeamCredentialsBanner({
  credentials,
  showFallbackPwd,
  copied,
  onToggleFallbackPwd,
  onCopyPassword,
  onDismiss,
}: Props) {
  const t = useT('master')

  return (
    <div
      style={{
        background: 'var(--green-light)',
        border: '1px solid rgba(34, 197, 94, 0.35)',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 800, color: 'var(--green)' }}>
          <MailCheck size={18} style={{ flexShrink: 0 }} />
          <span>
            {t('team.email_sent_title', {
              name: credentials.name,
              email: credentials.email,
            })}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('team.dismiss_banner')}
          title={t('team.dismiss_banner')}
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            padding: 4,
            color: 'var(--text2)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
        {t('team.email_sent_desc')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 2 }}>
        <button
          type="button"
          onClick={onToggleFallbackPwd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface)',
            border: '1px solid var(--border2)',
            borderRadius: 7,
            padding: '5px 11px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text2)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {showFallbackPwd ? <EyeOff size={13} /> : <Eye size={13} />}
          {showFallbackPwd ? t('team.hide_fallback_pwd') : t('team.show_fallback_pwd')}
        </button>

        {showFallbackPwd && (
          <>
            <code
              style={{
                padding: '5px 12px',
                borderRadius: 7,
                background: 'var(--surface)',
                border: '1px solid var(--border2)',
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: 0.4,
              }}
            >
              {credentials.temporaryPassword}
            </code>
            <button
              type="button"
              onClick={() => onCopyPassword(credentials.temporaryPassword)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 11px',
                borderRadius: 7,
                border: '1px solid var(--border2)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
              {copied ? t('team.copied') : t('team.copy')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
