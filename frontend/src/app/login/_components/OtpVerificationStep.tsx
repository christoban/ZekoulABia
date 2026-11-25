'use client'

import type { MutableRefObject } from 'react'
import { Loader2, AlertTriangle, Mail, Clock, ArrowLeft, Smartphone } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { handleInputBlur, handleInputFocus, maskEmail } from '../_helpers/loginConfig'

interface Props {
  otp: string[]
  otpChannel: 'EMAIL' | 'SMS'
  email: string
  emailMasked: string | null
  phoneMasked: string | null
  hasPhone: boolean
  switchingChannel: boolean
  otpTimerSecs: number
  otpResendEnabled: boolean
  otpLoading: boolean
  otpAlert: string | null
  otpRefs: MutableRefObject<(HTMLInputElement | null)[]>
  onBack: () => void
  onOtpInput: (idx: number, val: string) => void
  onOtpKey: (idx: number, e: React.KeyboardEvent) => void
  onResend: () => void
  onSubmit: () => void
  onSwitchToSms: () => void
  onSwitchToEmail: () => void
}

export default function OtpVerificationStep({
  otp,
  otpChannel,
  email,
  emailMasked,
  phoneMasked,
  hasPhone,
  switchingChannel,
  otpTimerSecs,
  otpResendEnabled,
  otpLoading,
  otpAlert,
  otpRefs,
  onBack,
  onOtpInput,
  onOtpKey,
  onResend,
  onSubmit,
  onSwitchToSms,
  onSwitchToEmail,
}: Props) {
  const t = useT('common')
  const timerMin = Math.floor(Math.max(otpTimerSecs, 0) / 60)
  const timerSecDisp = Math.max(otpTimerSecs, 0) % 60

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
          {otpChannel === 'SMS' ? t('login.otp_title_sms') : t('login.otp_title')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
          {otpChannel === 'SMS'
            ? t('login.otp_subtitle_sms', { phone: phoneMasked || '' })
            : t('login.otp_subtitle', { email: emailMasked || maskEmail(email) })}
        </p>
      </div>
      {otpAlert && (
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
          <span>{otpAlert}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 14 }}>
        {otp.map((v, i) => (
          <input
            key={i}
            ref={(el) => {
              otpRefs.current[i] = el
            }}
            type="tel"
            maxLength={1}
            value={v}
            onChange={(e) => onOtpInput(i, e.target.value)}
            onKeyDown={(e) => onOtpKey(i, e)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            style={{
              flex: 1,
              minHeight: 52,
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 900,
              background: v ? 'var(--primary-light)' : 'var(--surface)',
              border: `1.5px solid ${v ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 10,
              outline: 'none',
              color: v ? 'var(--primary)' : 'var(--text)',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              minWidth: 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: otpTimerSecs <= 60 ? 'var(--red)' : 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={15} /> {timerMin}:{String(timerSecDisp).padStart(2, '0')}
        </div>
        <button
          onClick={onResend}
          disabled={!otpResendEnabled}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: otpResendEnabled ? 'var(--primary)' : 'var(--text3)',
            cursor: otpResendEnabled ? 'pointer' : 'default',
            background: 'none',
            border: 'none',
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          {t('login.otp_resend')}
        </button>
      </div>
      <button
        onClick={onSubmit}
        disabled={otpLoading}
        style={{
          width: '100%',
          minHeight: 48,
          background: 'var(--primary)',
          color: 'white',
          fontSize: 15,
          fontWeight: 800,
          border: 'none',
          borderRadius: 10,
          cursor: otpLoading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: otpLoading ? 0.8 : 1,
        }}
        onMouseEnter={(e) => !otpLoading && (e.currentTarget.style.background = 'var(--primary-hover)')}
        onMouseLeave={(e) => !otpLoading && (e.currentTarget.style.background = 'var(--primary)')}
      >
        {otpLoading ? <Loader2 size={18} className="animate-spin" /> : null}
        {t('login.otp_verify')}
      </button>

      {/* Option de bascule entre Email et SMS */}
      {otpChannel === 'EMAIL' && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          {hasPhone ? (
            <button
              type="button"
              onClick={onSwitchToSms}
              disabled={switchingChannel || otpLoading}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--primary)',
                cursor: switchingChannel ? 'not-allowed' : 'pointer',
                background: 'none',
                border: 'none',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                opacity: switchingChannel ? 0.7 : 1,
              }}
            >
              {switchingChannel ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={15} />}
              {switchingChannel
                ? t('login.switching_channel')
                : t('login.otp_no_email_access_sms', { phone: phoneMasked ? ` (${phoneMasked})` : '' })}
            </button>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)', display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.4, padding: '4px 8px' }}>
              <Smartphone size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
              <span>{t('login.no_phone_notice')}</span>
            </div>
          )}
        </div>
      )}

      {otpChannel === 'SMS' && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onSwitchToEmail}
            disabled={switchingChannel || otpLoading}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--primary)',
              cursor: switchingChannel ? 'not-allowed' : 'pointer',
              background: 'none',
              border: 'none',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              opacity: switchingChannel ? 0.7 : 1,
            }}
          >
            {switchingChannel ? <Loader2 size={14} className="animate-spin" /> : <Mail size={15} />}
            {switchingChannel
              ? t('login.switching_channel')
              : t('login.otp_use_email_instead', { email: emailMasked ? ` (${emailMasked})` : '' })}
          </button>
        </div>
      )}
    </div>
  )
}
