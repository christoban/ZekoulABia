'use client'

import { Loader2, AlertTriangle, ArrowLeft, KeyRound } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { handleInputBlur, handleInputFocus } from '../_helpers/loginConfig'

interface Props {
  totpCode: string
  onChangeTotpCode: (val: string) => void
  isRecovery: boolean
  onToggleRecovery: () => void
  recoveryCode: string
  onChangeRecoveryCode: (val: string) => void
  totpLoading: boolean
  totpAlert: string | null
  onBack: () => void
  onSubmit: () => void
}

export default function TotpStep({
  totpCode,
  onChangeTotpCode,
  isRecovery,
  onToggleRecovery,
  recoveryCode,
  onChangeRecoveryCode,
  totpLoading,
  totpAlert,
  onBack,
  onSubmit,
}: Props) {
  const t = useT('common')

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text3)',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          fontFamily: 'inherit',
          marginBottom: 16,
          padding: 0,
        }}
      >
        <ArrowLeft size={16} /> {t('login.back')}
      </button>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
          {t('login.totp_title')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
          {isRecovery ? t('login.totp_subtitle_recovery') : t('login.totp_subtitle')}
        </p>
      </div>
      {totpAlert && (
        <div
          style={{
            borderRadius: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            marginBottom: 14,
            background: 'var(--red-light)',
            border: '1px solid rgba(217,72,31,0.2)',
            color: 'var(--red)',
            fontSize: 13,
          }}
        >
          <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>{totpAlert}</span>
        </div>
      )}
      {!isRecovery ? (
        <input
          type="tel"
          maxLength={6}
          value={totpCode}
          placeholder="123456"
          autoComplete="one-time-code"
          onChange={(e) => onChangeTotpCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          style={{
            width: '100%',
            minHeight: 48,
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 22,
            fontWeight: 900,
            textAlign: 'center',
            outline: 'none',
            letterSpacing: 6,
            marginBottom: 16,
          }}
        />
      ) : (
        <input
          type="text"
          value={recoveryCode}
          placeholder="ABCD-1234-EFGH-5678"
          autoComplete="off"
          onChange={(e) => onChangeRecoveryCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          style={{
            width: '100%',
            minHeight: 48,
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 700,
            textAlign: 'center',
            outline: 'none',
            letterSpacing: 2,
            marginBottom: 16,
          }}
        />
      )}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <button
          onClick={onToggleRecovery}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--primary)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 0',
          }}
        >
          {isRecovery ? (
            <>
              <ArrowLeft size={15} /> {t('login.totp_use_app')}
            </>
          ) : (
            <>
              <KeyRound size={15} /> {t('login.totp_use_recovery')}
            </>
          )}
        </button>
      </div>
      <button
        onClick={onSubmit}
        disabled={totpLoading}
        style={{
          width: '100%',
          minHeight: 48,
          background: 'var(--primary)',
          color: 'white',
          fontSize: 15,
          fontWeight: 800,
          border: 'none',
          borderRadius: 10,
          cursor: totpLoading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: totpLoading ? 0.8 : 1,
        }}
        onMouseEnter={(e) => !totpLoading && (e.currentTarget.style.background = 'var(--primary-hover)')}
        onMouseLeave={(e) => !totpLoading && (e.currentTarget.style.background = 'var(--primary)')}
      >
        {totpLoading ? <Loader2 size={18} className="animate-spin" /> : null}
        {t('login.totp_verify')}
      </button>
    </div>
  )
}
