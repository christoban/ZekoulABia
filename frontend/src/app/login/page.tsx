'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Eye, EyeOff, Loader2, Search, School, Presentation, Users, GraduationCap,
  User, Ban, Hand, AlertTriangle, Mail, Clock, ArrowLeft, KeyRound, Shield, Copy, Award
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LanguageSwitch from '@/components/LanguageSwitch'
import { useT } from '@/lib/i18n'
import { resetNotificationSocket } from '@/lib/notificationSocket'

// ── Configuration d'affichage par rôle (icônes, badges, redirections) ──
type SuccessInfo = { icon: LucideIcon; badge: string; color: string; bg: string; dest: string; firstName: string }

const ROLE_CONFIG: Record<string, Omit<SuccessInfo, 'firstName'>> = {
  ADMIN:   { icon: School,       badge: 'Administrateur', color: 'var(--primary)', bg: 'var(--primary-light)', dest: '/admin/dashboard' },
  TEACHER: { icon: Presentation, badge: 'Enseignant',      color: 'var(--blue)', bg: 'var(--blue-light)', dest: '/teacher/dashboard' },
  PARENT:  { icon: Users,        badge: 'Parent',          color: 'var(--amber)', bg: 'var(--amber-light)', dest: '/parent/dashboard' },
  STUDENT: { icon: GraduationCap,badge: 'Élève',           color: 'var(--purple)', bg: 'var(--purple-light)', dest: '/student/dashboard' },
  STAFF:   { icon: Search,       badge: 'Staff',           color: 'var(--primary)', bg: 'var(--primary-light)', dest: '/staff/dashboard' },
}

type AccountChoice = {
  userId: string
  schoolId: string
  role: string
  schoolName: string
  nomComplet: string
}

type LoginStep = 'credentials' | 'choose_account' | 'email_otp' | 'totp' | 'mfa_setup'

type LoginData = { role: string; nomComplet: string; userId: string; permissions: string[]; roleMismatch: boolean; mustChangePassword?: boolean; redirectTo?: string | null }

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return (local?.[0] ?? '') + '***@' + (domain ?? '')
}

export default function LoginPage() {
  const t = useT('common')
  const router = useRouter()

  const [step, setStep] = useState<LoginStep>('credentials')

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [alert, setAlert]           = useState<{ msg: string; type: 'error' | 'warning' } | null>(null)
  const [suspended, setSuspended]   = useState<{ schoolName: string } | null>(null)
  const [success, setSuccess]       = useState<SuccessInfo | null>(null)
  const [progress, setProgress]     = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  // ── Multi-account choice ──
  const [accountChoices, setAccountChoices] = useState<AccountChoice[] | null>(null)
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null)

  // ── Étape code email ──
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
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

  // Forgot password modal
  const [forgotOpen,    setForgotOpen]    = useState(false)
  const [forgotEmail,   setForgotEmail]   = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotDone,    setForgotDone]    = useState(false)
  const [forgotError,   setForgotError]   = useState('')

  useEffect(() => { emailRef.current?.focus() }, [])

  // Empêcher le remplissage automatique du navigateur
  useEffect(() => {
    const tmr = setTimeout(() => { setEmail(''); setPassword('') }, 50)
    return () => clearTimeout(tmr)
  }, [])

  useEffect(() => {
    if (success) {
      const tm = setTimeout(() => setProgress(true), 100)
      const r = setTimeout(() => router.push(success.dest), 2200)
      return () => { clearTimeout(tm); clearTimeout(r) }
    }
  }, [success, router])

  const startOtpTimer = () => {
    if (otpTimerRef.current) clearInterval(otpTimerRef.current)
    setOtpTimerSecs(600)
    setOtpResendEnabled(false)
    otpTimerRef.current = setInterval(() => {
      setOtpTimerSecs(s => {
        const next = s - 1
        if (next === 120) setOtpResendEnabled(true)
        if (next <= 0) {
          if (otpTimerRef.current) clearInterval(otpTimerRef.current)
          setOtpAlert(t('login.otp_expired'))
        }
        return next
      })
    }, 1000)
  }

  const completeLogin = (data: LoginData) => {
    const { role, nomComplet, userId, permissions, mustChangePassword, redirectTo } = data
    const config = ROLE_CONFIG[role] ?? { icon: User, badge: role, color: 'var(--text-muted)', bg: 'var(--bg2)', dest: '/' }
    const dest = mustChangePassword ? '/change-password' : (redirectTo ?? config.dest)
    const firstName = nomComplet?.split(' ')[0] ?? 'Bienvenue'

    resetNotificationSocket()

    localStorage.setItem('zekoulabia_user', JSON.stringify({
      userId, role, nomComplet, firstName,
      permissions: permissions ?? [],
      mustChangePassword: mustChangePassword ?? false,
    }))

    setSuccess({ ...config, dest, firstName })
  }

  const submitCredentials = async () => {
    setAlert(null)
    setSuspended(null)
    if (!email.trim() || !password) {
      setAlert({ msg: t('login.alert_required'), type: 'error' }); return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v2/users/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await res.json()

      if (res.status === 403 && data.error === 'SCHOOL_SUSPENDED') {
        setSuspended({ schoolName: data.schoolName ?? 'Établissement' })
        return
      }

      if (res.status === 409 && data.code === 'MULTIPLE_ACCOUNTS') {
        setPendingCredentials({ email: email.trim().toLowerCase(), password })
        setAccountChoices(data.accounts)
        setStep('choose_account')
        return
      }

      if (res.status === 422 && data.code === 'ROLE_MISMATCH_MULTIPLE') {
        setAlert({ msg: data.message ?? 'Rôle invalide', type: 'error' })
        return
      }

      if (!data.success) {
        setAlert({ msg: data.message ?? 'Email ou mot de passe incorrect', type: 'error' })
        return
      }

      setOtp(['', '', '', '', '', ''])
      setOtpAlert(null)
      setStep('email_otp')
      startOtpTimer()
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch {
      setAlert({ msg: t('messages.networkError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const submitAccountChoice = async (account: AccountChoice) => {
    if (!pendingCredentials) return
    setLoading(true)
    setAlert(null)
    try {
      const res = await fetch('/api/v2/users/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: pendingCredentials.email,
          password: pendingCredentials.password,
          userId: account.userId,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setAlert({ msg: data.message ?? 'Erreur', type: 'error' })
        return
      }
      setAccountChoices(null)
      setPendingCredentials(null)
      setOtp(['', '', '', '', '', ''])
      setOtpAlert(null)
      setStep('email_otp')
      startOtpTimer()
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch {
      setAlert({ msg: t('messages.networkError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = async () => {
    setForgotError('')
    if (!forgotEmail.trim()) { setForgotError(t('login.forgot_error_empty')); return }
    setForgotLoading(true)
    try {
      const res = await fetch('/api/v2/users/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      })
      if (res.ok) setForgotDone(true)
      else {
        const d = await res.json()
        setForgotError(d.message || t('login.forgot_error'))
      }
    } catch {
      setForgotError(t('login.forgot_error_network'))
    } finally {
      setForgotLoading(false)
    }
  }

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[idx] = digit; setOtp(next)
    if (digit && idx < 5) setTimeout(() => otpRefs.current[idx + 1]?.focus(), 0)
    if (digit && idx === 5 && next.join('').length === 6) setTimeout(() => submitOtp(next.join('')), 50)
  }

  const handleOtpKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      const next = [...otp]; next[idx - 1] = ''; setOtp(next)
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const submitOtp = async (codeOverride?: string) => {
    const code = codeOverride ?? otp.join('')
    setOtpAlert(null)
    if (code.length !== 6) { setOtpAlert(t('login.otp_expired')); return }
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
      if (otpTimerRef.current) clearInterval(otpTimerRef.current)

      if (data.step === 'totp_required') {
        setTotpAlert(null); setTotpCode(''); setIsRecovery(false); setRecoveryCode('')
        setStep('totp')
      } else if (data.step === 'mfa_setup_required') {
        setStep('mfa_setup')
        void startMfaSetup()
      } else {
        completeLogin(data.data)
      }
    } catch (err: any) {
      setOtpAlert(err.message)
    } finally {
      setOtpLoading(false)
    }
  }

  const resendOtp = async () => {
    setOtp(['', '', '', '', '', '']); setOtpAlert(null)
    try {
      const res = await fetch('/api/v2/users/auth/resend-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      startOtpTimer()
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch (err: any) {
      setOtpAlert(err.message)
    }
  }

  const submitTotp = async () => {
    setTotpAlert(null)
    const code = isRecovery ? recoveryCode.trim() : totpCode.trim()
    if (!code) { setTotpAlert(t('fields.password')); return }
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
      completeLogin(data.data)
    } catch (err: any) {
      setTotpAlert(err.message)
    } finally {
      setTotpLoading(false)
    }
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
    } catch (err: any) {
      setSetupAlert(err.message)
    }
  }

  const submitMfaSetup = async () => {
    setSetupAlert(null)
    if (setupTotpCode.trim().length !== 6) { setSetupAlert(t('login.mfa_setup_code_label')); return }
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
    } catch (err: any) {
      setSetupAlert(err.message)
    } finally {
      setSetupLoading(false)
    }
  }

  const timerMin = Math.floor(Math.max(otpTimerSecs, 0) / 60)
  const timerSecDisp = Math.max(otpTimerSecs, 0) % 60

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px rgba(227, 176, 75, 0.2)'
  }

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      position: 'relative',
      overflowX: 'hidden',
      paddingTop: 80,
      paddingBottom: 40,
      fontFamily: 'var(--font-nunito), Nunito, sans-serif'
    }}>

      {/* Motif géométrique discret */}
      <div className="login-bg" />

      {/* Bande multicolore camerounaise */}
      <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 5 }} />

      {/* En-tête commun */}
      <header style={{
        position: 'absolute', top: 5, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg,var(--primary),var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(180,83,42,0.22)', overflow: 'hidden'
          }}>
            <img src="/logo.svg" alt="ZekoulABia" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              ZekoulABia
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('login.tagline')}
            </span>
          </div>
        </div>
        <LanguageSwitch compact />
      </header>

      {/* Carte de formulaire principale */}
      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 440,
          width: 'calc(100% - 32px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '32px 28px',
          boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)',
        }}
      >
        {suspended ? (
          <div style={{ animation: 'edu-fadeUp 0.25s ease both' }}>
            <div style={{ background: 'var(--red-light)', border: '1px solid rgba(217,72,31,0.2)', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--red)', marginBottom: 8 }}><Ban size={24} strokeWidth={2} /></div>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--red)', marginBottom: 7, textAlign: 'center' }}>
                {t('login.suspended_title')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>
                {t('login.suspended_msg', { school: suspended.schoolName })}
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid rgba(217,72,31,0.12)', borderRadius: 7, padding: '9px 12px', marginBottom: 12, fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>
                {t('login.suspended_support')}{' '}
                <a href="mailto:zekoulabia.noreply@gmail.com" style={{ color: 'var(--primary)', fontWeight: 700 }}>zekoulabia.noreply@gmail.com</a>
              </div>
              <button
                onClick={() => setSuspended(null)}
                style={{ width: '100%', minHeight: 44, padding: '9px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('login.suspended_back')}
              </button>
            </div>
          </div>
        ) : step === 'credentials' ? (

          <>
            <div style={{ marginBottom: 24 }}>
              <span style={{ color: 'var(--text)', display: 'block', marginBottom: 10 }}><Hand size={28} strokeWidth={2} /></span>
              <h1 style={{
                fontFamily: 'var(--font-spectral),Spectral,serif',
                fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, margin: '0 0 6px'
              }}>
                {t('login.right_title')}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
                {t('login.right_subtitle')}
              </p>
            </div>

            {alert && (
              <div style={{
                fontSize: 13, marginBottom: 16, padding: '10px 14px',
                borderRadius: 8, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8,
                background: alert.type === 'error' ? 'var(--red-light)' : 'var(--amber-light)',
                border: alert.type === 'error' ? '1px solid rgba(217,72,31,0.2)' : '1px solid rgba(217,119,6,0.2)',
                color: alert.type === 'error' ? 'var(--red)' : 'var(--amber)'
              }}>
                <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /><span>{alert.msg}</span>
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', display: 'block', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                {t('fields.email')}
              </label>
              <input
                ref={emailRef} type="email" value={email}
                onChange={e => { setEmail(e.target.value); setAlert(null) }}
                onKeyDown={e => e.key === 'Enter' && submitCredentials()}
                onFocus={handleInputFocus} onBlur={handleInputBlur}
                placeholder={t('login.email_placeholder')}
                autoComplete="off"
                style={{
                  width: '100%', minHeight: 48, padding: '12px 14px',
                  background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10,
                  color: 'var(--text)', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, outline: 'none', transition: 'all 0.2s'
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
                  type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setAlert(null) }}
                  onKeyDown={e => e.key === 'Enter' && submitCredentials()}
                  onFocus={handleInputFocus} onBlur={handleInputBlur}
                  placeholder={t('login.password_placeholder')} autoComplete="new-password"
                  style={{
                    width: '100%', minHeight: 48, padding: '12px 44px 12px 14px',
                    background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10,
                    color: 'var(--text)', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, outline: 'none', transition: 'all 0.2s'
                  }}
                />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20, marginTop: -4 }}>
              <button
                type="button"
                onClick={() => { setForgotOpen(true); setForgotDone(false); setForgotError(''); setForgotEmail(email) }}
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>
                {t('auth.forgotPassword')}
              </button>
            </div>

            <button onClick={submitCredentials} disabled={loading}
              style={{
                width: '100%', minHeight: 48,
                background: 'var(--primary)',
                color: 'white', fontSize: 15, fontWeight: 800,
                border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background 0.2s',
                boxShadow: '0 4px 14px rgba(180,83,42,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.8 : 1
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = 'var(--primary-hover)')}
              onMouseLeave={e => !loading && (e.currentTarget.style.background = 'var(--primary)')}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? t('login.signing_in') : t('auth.signIn')}
            </button>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Link
                href="/concours/resultats"
                style={{
                  fontSize: 13, color: 'var(--text3)', textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, transition: 'color 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
              >
                <Award size={15} />
                Résultats du concours d'entrée
              </Link>
            </div>
          </>

        ) : step === 'choose_account' ? (

          <div>
            <button onClick={() => { setStep('credentials'); setAccountChoices(null); setPendingCredentials(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 16, padding: 0 }}>
              <ArrowLeft size={16} /> {t('login.back')}
            </button>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>{t('login.choose_account_title')}</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, margin: 0 }}>
                {t('login.choose_account_subtitle')}
              </p>
            </div>
            {accountChoices && accountChoices.map((account) => (
              <button
                key={account.userId}
                type="button"
                onClick={() => submitAccountChoice(account)}
                disabled={loading}
                style={{
                  width: '100%', textAlign: 'left', padding: '14px 16px', marginBottom: 10,
                  borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{account.schoolName}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>
                  {t(`login.role_${account.role.toLowerCase()}`) || account.role} · {account.nomComplet}
                </div>
              </button>
            ))}
          </div>

        ) : step === 'email_otp' ? (

          <div>
            <button onClick={() => { setStep('credentials'); if (otpTimerRef.current) clearInterval(otpTimerRef.current) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 16, padding: 0 }}>
              <ArrowLeft size={16} /> {t('login.back')}
            </button>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>{t('login.otp_title')}</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
                {t('login.otp_subtitle', { email: maskEmail(email) })}
              </p>
            </div>
            {otpAlert && (
              <div style={{ borderRadius: 9, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, background: 'var(--red-light)', border: '1px solid rgba(217,72,31,0.2)', color: 'var(--red)', fontSize: 13 }}>
                <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /><span>{otpAlert}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 14 }}>
              {otp.map((v, i) => (
                <input key={i}
                  ref={el => { otpRefs.current[i] = el }}
                  type="tel" maxLength={1} value={v}
                  onChange={e => handleOtpInput(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  onFocus={handleInputFocus} onBlur={handleInputBlur}
                  style={{ flex: 1, minHeight: 52, textAlign: 'center', fontSize: 22, fontWeight: 900, background: v ? 'var(--primary-light)' : 'var(--surface)', border: `1.5px solid ${v ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, outline: 'none', color: v ? 'var(--primary)' : 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s', minWidth: 0 }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: otpTimerSecs <= 60 ? 'var(--red)' : 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={15} /> {timerMin}:{String(timerSecDisp).padStart(2, '0')}
              </div>
              <button onClick={resendOtp} disabled={!otpResendEnabled}
                style={{ fontSize: 13, fontWeight: 700, color: otpResendEnabled ? 'var(--primary)' : 'var(--text3)', cursor: otpResendEnabled ? 'pointer' : 'default', background: 'none', border: 'none', fontFamily: 'inherit', padding: 0 }}>
                {t('login.otp_resend')}
              </button>
            </div>
            <button onClick={() => submitOtp()} disabled={otpLoading}
              style={{ width: '100%', minHeight: 48, background: 'var(--primary)', color: 'white', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 10, cursor: otpLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: otpLoading ? 0.8 : 1 }}
              onMouseEnter={e => !otpLoading && (e.currentTarget.style.background = 'var(--primary-hover)')}
              onMouseLeave={e => !otpLoading && (e.currentTarget.style.background = 'var(--primary)')}
            >
              {otpLoading ? <Loader2 size={18} className="animate-spin" /> : null}
              {t('login.otp_verify')}
            </button>
          </div>

        ) : step === 'totp' ? (

          <div>
            <button onClick={() => setStep('email_otp')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 16, padding: 0 }}>
              <ArrowLeft size={16} /> {t('login.back')}
            </button>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>{t('login.totp_title')}</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
                {isRecovery ? t('login.totp_subtitle_recovery') : t('login.totp_subtitle')}
              </p>
            </div>
            {totpAlert && (
              <div style={{ borderRadius: 9, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, background: 'var(--red-light)', border: '1px solid rgba(217,72,31,0.2)', color: 'var(--red)', fontSize: 13 }}>
                <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /><span>{totpAlert}</span>
              </div>
            )}
            {!isRecovery ? (
              <input type="tel" maxLength={6} value={totpCode} placeholder="123456" autoComplete="one-time-code"
                onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setTotpAlert(null) }}
                onKeyDown={e => e.key === 'Enter' && submitTotp()}
                onFocus={handleInputFocus} onBlur={handleInputBlur}
                style={{ width: '100%', minHeight: 48, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'inherit', fontSize: 22, fontWeight: 900, textAlign: 'center', outline: 'none', letterSpacing: 6, marginBottom: 16 }} />
            ) : (
              <input type="text" value={recoveryCode} placeholder="ABCD-1234-EFGH-5678" autoComplete="off"
                onChange={e => { setRecoveryCode(e.target.value); setTotpAlert(null) }}
                onKeyDown={e => e.key === 'Enter' && submitTotp()}
                onFocus={handleInputFocus} onBlur={handleInputBlur}
                style={{ width: '100%', minHeight: 48, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none', letterSpacing: 2, marginBottom: 16 }} />
            )}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <button onClick={() => { setIsRecovery(r => !r); setTotpAlert(null) }}
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                {isRecovery ? <><ArrowLeft size={15} /> {t('login.totp_use_app')}</> : <><KeyRound size={15} /> {t('login.totp_use_recovery')}</>}
              </button>
            </div>
            <button onClick={submitTotp} disabled={totpLoading}
              style={{ width: '100%', minHeight: 48, background: 'var(--primary)', color: 'white', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 10, cursor: totpLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: totpLoading ? 0.8 : 1 }}
              onMouseEnter={e => !totpLoading && (e.currentTarget.style.background = 'var(--primary-hover)')}
              onMouseLeave={e => !totpLoading && (e.currentTarget.style.background = 'var(--primary)')}
            >
              {totpLoading ? <Loader2 size={18} className="animate-spin" /> : null}
              {t('login.totp_verify')}
            </button>
          </div>

        ) : (

          /* ── step === 'mfa_setup' — configuration obligatoire (1re connexion) ── */
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
                    <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /><span>{setupAlert}</span>
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{t('login.mfa_setup_step1')}</div>
                {qrDataUri ? (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <img src={qrDataUri} alt="QR MFA" style={{ width: 160, height: 160, borderRadius: 12, border: '1.5px solid var(--border)', padding: 8, background: 'white' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} /></div>
                )}
                {manualKey && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 4 }}>{t('login.mfa_setup_manual_label')}</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)', background: 'var(--bg2)', padding: '10px 12px', borderRadius: 8, textAlign: 'center', fontSize: 14, letterSpacing: 1, wordBreak: 'break-all' }}>{manualKey}</div>
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{t('login.mfa_setup_code_label')}</div>
                <input type="tel" maxLength={6} value={setupTotpCode} placeholder="123456" autoComplete="one-time-code"
                  onChange={e => { setSetupTotpCode(e.target.value.replace(/\D/g, '')); setSetupAlert(null) }}
                  onKeyDown={e => e.key === 'Enter' && submitMfaSetup()}
                  onFocus={handleInputFocus} onBlur={handleInputBlur}
                  style={{ width: '100%', minHeight: 48, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'inherit', fontSize: 22, fontWeight: 900, textAlign: 'center', outline: 'none', letterSpacing: 6, marginBottom: 16 }} />
                <button onClick={submitMfaSetup} disabled={setupLoading || !qrDataUri}
                  style={{ width: '100%', minHeight: 48, background: 'var(--primary)', color: 'white', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 10, cursor: setupLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: setupLoading ? 0.8 : 1 }}
                  onMouseEnter={e => !setupLoading && (e.currentTarget.style.background = 'var(--primary-hover)')}
                  onMouseLeave={e => !setupLoading && (e.currentTarget.style.background = 'var(--primary)')}
                >
                  {setupLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                  {t('login.mfa_setup_confirm')}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--primary)', marginBottom: 14 }}><Shield size={36} strokeWidth={2} /></div>
                <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', textAlign: 'center' }}>
                  {t('login.mfa_setup_recovery_title')}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 16, textAlign: 'center' }}>
                  {t('login.mfa_setup_recovery_subtitle')}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, background: 'var(--bg2)', borderRadius: 12, padding: 14 }}>
                  {recoveryCodes.map(code => (
                    <div key={code} style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 6px', textAlign: 'center' }}>{code}</div>
                  ))}
                </div>
                <button onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
                  style={{ width: '100%', minHeight: 44, marginBottom: 16, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Copy size={16} /> Copier les codes
                </button>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
                  <input type="checkbox" checked={recoveryAck} onChange={e => setRecoveryAck(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, width: 18, height: 18 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{t('login.mfa_setup_recovery_confirm')}</span>
                </label>
                <button onClick={() => pendingLoginData && completeLogin(pendingLoginData)} disabled={!recoveryAck}
                  style={{ width: '100%', minHeight: 48, background: recoveryAck ? 'var(--primary)' : 'var(--text3)', color: 'white', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 10, cursor: recoveryAck ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                  onMouseEnter={e => recoveryAck && (e.currentTarget.style.background = 'var(--primary-hover)')}
                  onMouseLeave={e => recoveryAck && (e.currentTarget.style.background = 'var(--primary)')}
                >
                  {t('login.mfa_setup_continue')}
                </button>
              </>
            )}
          </div>

        )}
      </motion.main>

      {/* Footer Copyright */}
      <footer style={{ position: 'relative', zIndex: 1, marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
        {t('login.copyright', { year: String(new Date().getFullYear()) })}
      </footer>

      {/* ══ MODAL SUCCÈS (vert strictement réservé au statut positif) ══ */}
      {success && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            textAlign: 'center', maxWidth: 320, width: '88%',
            padding: '24px 20px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
            animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both'
          }}>
            <span style={{ color: success.color, marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
              <success.icon size={36} strokeWidth={2} />
            </span>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {t('login.success_greeting', { name: success.firstName })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.4, marginBottom: 8 }}>
              {t('messages.welcome')}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 12,
              fontSize: 12, fontWeight: 800, margin: '8px 0 14px',
              background: success.bg, color: success.color
            }}>
              <success.icon size={14} strokeWidth={2} /> {success.badge}
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', height: 4, marginBottom: 12 }}>
              <div style={{
                height: '100%', background: 'var(--success)',
                width: progress ? '100%' : '0%',
                transition: 'width 2s linear', borderRadius: 6
              }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 12 }}>
              {t('login.success_redirecting')}
            </div>
            <button
              onClick={() => router.push(success.dest)}
              style={{ width: '100%', minHeight: 44, padding: 10, background: 'var(--success)', color: 'white', fontSize: 13, fontWeight: 800, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t('login.success_goto')}
            </button>
          </div>
        </div>
      )}

      {/* ══ MODAL MOT DE PASSE OUBLIÉ ══ */}
      {forgotOpen && (
        <div
          onClick={() => !forgotLoading && setForgotOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: 400, maxWidth: '100%', boxShadow: '0 12px 36px rgba(0,0,0,0.14)', animation: 'popIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }}>

            {forgotDone ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--success)', marginBottom: 12 }}><Mail size={38} strokeWidth={2} /></div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('login.forgot_success_title')}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 18 }}>
                  {t('login.forgot_success_msg')}
                </div>
                <button onClick={() => setForgotOpen(false)}
                  style={{ width: '100%', minHeight: 44, padding: '10px 22px', borderRadius: 10, background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
                >
                  {t('login.forgot_back')}
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {t('login.forgot_title')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18, lineHeight: 1.45 }}>
                  {t('login.forgot_subtitle')}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                    {t('login.forgot_email_label')}
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleForgotSubmit() }}
                    onFocus={handleInputFocus} onBlur={handleInputBlur}
                    placeholder={t('login.forgot_email_placeholder')}
                    autoFocus
                    style={{ width: '100%', minHeight: 48, padding: '12px 14px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {forgotError && (
                  <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                    {forgotError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setForgotOpen(false)} disabled={forgotLoading}
                    style={{ flex: 1, minHeight: 44, padding: '10px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('login.forgot_cancel')}
                  </button>
                  <button onClick={handleForgotSubmit} disabled={forgotLoading}
                    style={{ flex: 1, minHeight: 44, padding: '10px', borderRadius: 10, fontSize: 14, fontWeight: 800, background: forgotLoading ? 'var(--text3)' : 'var(--primary)', color: 'white', border: 'none', cursor: forgotLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => !forgotLoading && (e.currentTarget.style.background = 'var(--primary-hover)')}
                    onMouseLeave={e => !forgotLoading && (e.currentTarget.style.background = 'var(--primary)')}
                  >
                    {forgotLoading ? t('login.forgot_sending') : t('login.forgot_send')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
