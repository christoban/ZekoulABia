'use client'

import { Loader2, AlertTriangle, Shield, Copy } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { handleInputBlur, handleInputFocus, type LoginData } from '../_helpers/loginConfig'

interface Props {
  qrDataUri: string
  manualKey: string
  setupTotpCode: string
  onChangeSetupTotpCode: (val: string) => void
  setupLoading: boolean
  setupAlert: string | null
  recoveryCodes: string[] | null
  recoveryAck: boolean
  onChangeRecoveryAck: (val: boolean) => void
  pendingLoginData: LoginData | null
  onSubmitSetup: () => void
  onCompleteLogin: (data: LoginData) => void
}

export default function MfaSetupStep({
  qrDataUri,
  manualKey,
  setupTotpCode,
  onChangeSetupTotpCode,
  setupLoading,
  setupAlert,
  recoveryCodes,
  recoveryAck,
  onChangeRecoveryAck,
  pendingLoginData,
  onSubmitSetup,
  onCompleteLogin,
}: Props) {
  const t = useT('common')

  return (
    <div>
      {!recoveryCodes ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--amber-light)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>
            <Shield size={18} style={{ flexShrink: 0 }} /> {t('login.mfa_setup_subtitle')}
          </div>
          <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }}>
            {t('login.mfa_setup_title')}
          </h2>
          {setupAlert && (
            <div style={{ borderRadius: 9, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, background: 'var(--red-light)', border: '1px solid rgba(217,72,31,0.2)', color: 'var(--red)', fontSize: 13 }}>
              <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span>{setupAlert}</span>
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{t('login.mfa_setup_step1')}</div>
          {qrDataUri ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <img src={qrDataUri} alt="QR MFA" style={{ width: 160, height: 160, borderRadius: 12, border: '1.5px solid var(--border)', padding: 8, background: 'white' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          )}
          {manualKey && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 4 }}>{t('login.mfa_setup_manual_label')}</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)', background: 'var(--bg2)', padding: '10px 12px', borderRadius: 8, textAlign: 'center', fontSize: 14, letterSpacing: 1, wordBreak: 'break-all' }}>
                {manualKey}
              </div>
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{t('login.mfa_setup_code_label')}</div>
          <input
            type="tel"
            maxLength={6}
            value={setupTotpCode}
            placeholder="123456"
            autoComplete="one-time-code"
            onChange={(e) => onChangeSetupTotpCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && onSubmitSetup()}
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
          <button
            onClick={onSubmitSetup}
            disabled={setupLoading || !qrDataUri}
            style={{
              width: '100%',
              minHeight: 48,
              background: 'var(--primary)',
              color: 'white',
              fontSize: 15,
              fontWeight: 800,
              border: 'none',
              borderRadius: 10,
              cursor: setupLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: setupLoading ? 0.8 : 1,
            }}
            onMouseEnter={(e) => !setupLoading && (e.currentTarget.style.background = 'var(--primary-hover)')}
            onMouseLeave={(e) => !setupLoading && (e.currentTarget.style.background = 'var(--primary)')}
          >
            {setupLoading ? <Loader2 size={18} className="animate-spin" /> : null}
            {t('login.mfa_setup_confirm')}
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--primary)', marginBottom: 14 }}>
            <Shield size={36} strokeWidth={2} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', textAlign: 'center' }}>
            {t('login.mfa_setup_recovery_title')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 16, textAlign: 'center' }}>
            {t('login.mfa_setup_recovery_subtitle')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, background: 'var(--bg2)', borderRadius: 12, padding: 14 }}>
            {recoveryCodes.map((code) => (
              <div key={code} style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 6px', textAlign: 'center' }}>
                {code}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
            style={{
              width: '100%',
              minHeight: 44,
              marginBottom: 16,
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Copy size={16} /> Copier les codes
          </button>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={recoveryAck} onChange={(e) => onChangeRecoveryAck(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{t('login.mfa_setup_recovery_confirm')}</span>
          </label>
          <button
            onClick={() => pendingLoginData && onCompleteLogin(pendingLoginData)}
            disabled={!recoveryAck}
            style={{
              width: '100%',
              minHeight: 48,
              background: recoveryAck ? 'var(--primary)' : 'var(--text3)',
              color: 'white',
              fontSize: 15,
              fontWeight: 800,
              border: 'none',
              borderRadius: 10,
              cursor: recoveryAck ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => recoveryAck && (e.currentTarget.style.background = 'var(--primary-hover)')}
            onMouseLeave={(e) => recoveryAck && (e.currentTarget.style.background = 'var(--primary)')}
          >
            {t('login.mfa_setup_continue')}
          </button>
        </>
      )}
    </div>
  )
}
