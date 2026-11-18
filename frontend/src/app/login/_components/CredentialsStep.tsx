'use client'

import type { RefObject } from 'react'
import { Eye, EyeOff, Loader2, Hand, AlertTriangle, Shield, Award } from 'lucide-react'
import Link from 'next/link'
import { useT } from '@/lib/i18n'
import { handleInputBlur, handleInputFocus } from '../_helpers/loginConfig'

interface Props {
  emailRef: RefObject<HTMLInputElement | null>
  email: string
  onChangeEmail: (val: string) => void
  password: string
  onChangePassword: (val: string) => void
  showPwd: boolean
  onToggleShowPwd: () => void
  loading: boolean
  alert: { msg: string; type: 'error' | 'warning' } | null
  modeTestBandeau: string | null
  onSubmit: () => void
  onOpenForgot: () => void
}

export default function CredentialsStep({
  emailRef,
  email,
  onChangeEmail,
  password,
  onChangePassword,
  showPwd,
  onToggleShowPwd,
  loading,
  alert,
  modeTestBandeau,
  onSubmit,
  onOpenForgot,
}: Props) {
  const t = useT('common')

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <span style={{ color: 'var(--text)', display: 'block', marginBottom: 10 }}>
          <Hand size={28} strokeWidth={2} />
        </span>
        <h1
          style={{
            fontFamily: 'var(--font-spectral),Spectral,serif',
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1.2,
            margin: '0 0 6px',
          }}
        >
          {t('login.right_title')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
          {t('login.right_subtitle')}
        </p>
      </div>

      {modeTestBandeau && (
        <div
          style={{
            fontSize: 13,
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 8,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--red-light)',
            border: '1px solid rgba(217,72,31,0.2)',
            color: 'var(--red)',
          }}
        >
          <Shield size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>{modeTestBandeau}</span>
        </div>
      )}

      {alert && (
        <div
          style={{
            fontSize: 13,
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 8,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: alert.type === 'error' ? 'var(--red-light)' : 'var(--amber-light)',
            border: alert.type === 'error' ? '1px solid rgba(217,72,31,0.2)' : '1px solid rgba(217,119,6,0.2)',
            color: alert.type === 'error' ? 'var(--red)' : 'var(--amber)',
          }}
        >
          <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>{alert.msg}</span>
        </div>
      )}

      {/* Email */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', display: 'block', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
          {t('fields.email')}
        </label>
        <input
          ref={emailRef}
          type="email"
          value={email}
          onChange={(e) => onChangeEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={t('login.email_placeholder')}
          autoComplete="off"
          style={{
            width: '100%',
            minHeight: 48,
            padding: '12px 14px',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 600,
            outline: 'none',
            transition: 'all 0.2s',
          }}
        />
      </div>

      {/* Mot de passe */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', display: 'block', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
          {t('fields.password')}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={(e) => onChangePassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={t('login.password_placeholder')}
            autoComplete="new-password"
            style={{
              width: '100%',
              minHeight: 48,
              padding: '12px 44px 12px 14px',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: 16,
              fontWeight: 600,
              outline: 'none',
              transition: 'all 0.2s',
            }}
          />
          <button
            type="button"
            onClick={onToggleShowPwd}
            aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: 6,
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20, marginTop: -4 }}>
        <button
          type="button"
          onClick={onOpenForgot}
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}
        >
          {t('auth.forgotPassword')}
        </button>
      </div>

      <button
        onClick={onSubmit}
        disabled={loading}
        style={{
          width: '100%',
          minHeight: 48,
          background: 'var(--primary)',
          color: 'white',
          fontSize: 15,
          fontWeight: 800,
          border: 'none',
          borderRadius: 10,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.2s',
          boxShadow: '0 4px 14px rgba(180,83,42,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: loading ? 0.8 : 1,
        }}
        onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'var(--primary-hover)')}
        onMouseLeave={(e) => !loading && (e.currentTarget.style.background = 'var(--primary)')}
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : null}
        {loading ? t('login.signing_in') : t('auth.signIn')}
      </button>

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Link
          href="/concours/resultats"
          style={{
            fontSize: 13,
            color: 'var(--text3)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 600,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text3)')}
        >
          <Award size={15} />
          Résultats du concours d&apos;entrée
        </Link>
      </div>
    </>
  )
}
