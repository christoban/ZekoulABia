'use client'

import { useState, useRef } from 'react'
import { useT } from '@/lib/i18n'
import type { LoginData, LoginStep } from './loginConfig'

interface UseOtpMfaFlowParams {
  onSuccessLogin: (data: LoginData) => void
  onGoToStep: (step: LoginStep) => void
}

export interface OtpInitPayload {
  emailMasked?: string
  phoneMasked?: string
  hasPhone?: boolean
}

export function useOtpMfaFlow({ onSuccessLogin, onGoToStep }: UseOtpMfaFlowParams) {
  const t = useT('common')

  // ── Étape code OTP (Email ou SMS) ──
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpChannel, setOtpChannel] = useState<'EMAIL' | 'SMS'>('EMAIL')
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null)
  const [emailMasked, setEmailMasked] = useState<string | null>(null)
  const [hasPhone, setHasPhone] = useState(false)
  const [switchingChannel, setSwitchingChannel] = useState(false)
  const [otpTimerSecs, setOtpTimerSecs] = useState(600)
  const [otpResendEnabled, setOtpResendEnabled] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpAlert, setOtpAlert] = useState<string | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const otpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Étape TOTP ──
  const [totpCode, setTotpCode] = useState('')
  const [isRecovery, setIsRecovery] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)
  const [totpAlert, setTotpAlert] = useState<string | null>(null)

  // ── Étape configuration MFA ──
  const [qrDataUri, setQrDataUri] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [setupTotpCode, setSetupTotpCode] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupAlert, setSetupAlert] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [recoveryAck, setRecoveryAck] = useState(false)
  const [pendingLoginData, setPendingLoginData] = useState<LoginData | null>(null)

  const clearOtpTimer = () => {
    if (otpTimerRef.current) clearInterval(otpTimerRef.current)
  }

  const startOtpTimer = () => {
    clearOtpTimer()
    setOtpTimerSecs(600)
    setOtpResendEnabled(false)
    otpTimerRef.current = setInterval(() => {
      setOtpTimerSecs((s) => {
        const next = s - 1
        if (next === 120) setOtpResendEnabled(true)
        if (next <= 0) {
          clearOtpTimer()
          setOtpAlert(t('login.otp_expired'))
        }
        return next
      })
    }, 1000)
  }

  const beginOtpStep = (data: OtpInitPayload) => {
    if (data.emailMasked) setEmailMasked(data.emailMasked)
    if (data.phoneMasked) setPhoneMasked(data.phoneMasked)
    setHasPhone(Boolean(data.hasPhone))
    setOtpChannel('EMAIL')
    setOtp(['', '', '', '', '', ''])
    setOtpAlert(null)
    onGoToStep('email_otp')
    startOtpTimer()
    setTimeout(() => otpRefs.current[0]?.focus(), 100)
  }

  const startMfaSetup = async () => {
    setSetupAlert(null)
    try {
      const res = await fetch('/api/v2/users/auth/mfa/first-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setQrDataUri(data.data.qrDataUri)
      setManualKey(data.data.manualKey)
    } catch (err: unknown) {
      setSetupAlert(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const submitOtp = async (codeOverride?: string) => {
    const code = codeOverride ?? otp.join('')
    setOtpAlert(null)
    if (code.length !== 6) {
      setOtpAlert(t('login.otp_expired'))
      return
    }
    setOtpLoading(true)
    try {
      const res = await fetch('/api/v2/users/auth/verify-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otp: code }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      clearOtpTimer()

      if (data.step === 'totp_required') {
        setTotpAlert(null)
        setTotpCode('')
        setIsRecovery(false)
        setRecoveryCode('')
        onGoToStep('totp')
      } else if (data.step === 'mfa_setup_required') {
        onGoToStep('mfa_setup')
        void startMfaSetup()
      } else {
        onSuccessLogin(data.data)
      }
    } catch (err: unknown) {
      setOtpAlert(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setOtpLoading(false)
    }
  }

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < 5) setTimeout(() => otpRefs.current[idx + 1]?.focus(), 0)
    if (digit && idx === 5 && next.join('').length === 6) setTimeout(() => submitOtp(next.join('')), 50)
  }

  const handleOtpKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      const next = [...otp]
      next[idx - 1] = ''
      setOtp(next)
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const resendOtp = async () => {
    setOtp(['', '', '', '', '', ''])
    setOtpAlert(null)
    try {
      const res = await fetch('/api/v2/users/auth/resend-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channel: otpChannel }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      if (data.phoneMasked) setPhoneMasked(data.phoneMasked)
      if (data.emailMasked) setEmailMasked(data.emailMasked)
      startOtpTimer()
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch (err: unknown) {
      setOtpAlert(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const switchToSms = async () => {
    setOtpAlert(null)
    setSwitchingChannel(true)
    try {
      const res = await fetch('/api/v2/users/auth/request-sms-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setOtpChannel('SMS')
        if (data.phoneMasked) setPhoneMasked(data.phoneMasked)
        setOtp(['', '', '', '', '', ''])
        startOtpTimer()
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      } else {
        setOtpAlert(data.message || t('login.sms_error'))
      }
    } catch {
      setOtpAlert(t('login.sms_network_error'))
    } finally {
      setSwitchingChannel(false)
    }
  }

  const switchToEmail = async () => {
    setOtpAlert(null)
    setSwitchingChannel(true)
    try {
      const res = await fetch('/api/v2/users/auth/resend-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channel: 'EMAIL' }),
      })
      const data = await res.json()
      if (data.success) {
        setOtpChannel('EMAIL')
        setOtp(['', '', '', '', '', ''])
        startOtpTimer()
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      } else {
        setOtpAlert(data.message || t('login.email_error'))
      }
    } catch {
      setOtpAlert(t('login.email_network_error'))
    } finally {
      setSwitchingChannel(false)
    }
  }

  const submitTotp = async () => {
    setTotpAlert(null)
    const code = isRecovery ? recoveryCode.trim() : totpCode.trim()
    if (!code) {
      setTotpAlert(t('fields.password'))
      return
    }
    setTotpLoading(true)
    try {
      const res = await fetch('/api/v2/users/auth/verify-login-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onSuccessLogin(data.data)
    } catch (err: unknown) {
      setTotpAlert(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setTotpLoading(false)
    }
  }

  const submitMfaSetup = async () => {
    setSetupAlert(null)
    if (setupTotpCode.trim().length !== 6) {
      setSetupAlert(t('login.mfa_setup_code_label'))
      return
    }
    setSetupLoading(true)
    try {
      const res = await fetch('/api/v2/users/auth/mfa/first-enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totpCode: setupTotpCode.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setRecoveryCodes(data.data.recoveryCodes)
      setPendingLoginData(data.data)
    } catch (err: unknown) {
      setSetupAlert(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSetupLoading(false)
    }
  }

  return {
    otp,
    otpChannel,
    phoneMasked,
    emailMasked,
    hasPhone,
    switchingChannel,
    otpTimerSecs,
    otpResendEnabled,
    otpLoading,
    otpAlert,
    otpRefs,
    clearOtpTimer,
    beginOtpStep,
    handleOtpInput,
    handleOtpKey,
    submitOtp,
    resendOtp,
    switchToSms,
    switchToEmail,
    totpCode,
    setTotpCode,
    isRecovery,
    setIsRecovery,
    recoveryCode,
    setRecoveryCode,
    totpLoading,
    totpAlert,
    setTotpAlert,
    submitTotp,
    qrDataUri,
    manualKey,
    setupTotpCode,
    setSetupTotpCode,
    setupLoading,
    setupAlert,
    setSetupAlert,
    recoveryCodes,
    recoveryAck,
    setRecoveryAck,
    pendingLoginData,
    submitMfaSetup,
  }
}
