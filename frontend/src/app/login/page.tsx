'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, ChevronRight, Search, School, Presentation, Users, GraduationCap, User, Ban, Hand, AlertTriangle, Check, Mail, Clock, ArrowLeft, KeyRound, Shield, Copy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import LanguageSwitch from '@/components/LanguageSwitch'
import { useT } from '@/lib/i18n'

// ── Configuration d'affichage par rôle (icônes, badges, couleurs, redirections) ──
type SuccessInfo = { icon: LucideIcon; badge: string; color: string; bg: string; dest: string; firstName: string }

const ROLE_CONFIG: Record<string, Omit<SuccessInfo, 'firstName'>> = {
  ADMIN:   { icon: School,       badge: 'Administrateur', color: 'var(--green)', bg: 'var(--green-light)', dest: '/admin/dashboard' },
  TEACHER: { icon: Presentation, badge: 'Enseignant',      color: 'var(--blue)', bg: 'var(--blue-light)', dest: '/teacher/dashboard' },
  PARENT:  { icon: Users,        badge: 'Parent',          color: 'var(--amber)', bg: 'var(--amber-light)', dest: '/parent/dashboard' },
  STUDENT: { icon: GraduationCap,badge: 'Élève',           color: 'var(--purple)', bg: 'var(--purple-light)', dest: '/student/dashboard' },
  STAFF:   { icon: Search,       badge: 'Staff',           color: 'var(--teal)', bg: 'var(--teal-light)', dest: '/staff/dashboard' },
}

const ROLE_SELECTOR = [
  { role: 'ADMIN',   icon: School,       label: 'login.role_admin', shortLabel: 'login.role_admin_short', color: 'var(--green)', bg: 'var(--green-light)', border: 'rgba(5,150,105,0.3)' },
  { role: 'TEACHER', icon: Presentation, label: 'login.role_teacher', shortLabel: 'login.role_teacher_short', color: 'var(--blue)', bg: 'var(--blue-light)', border: 'rgba(29,78,216,0.3)'  },
  { role: 'PARENT',  icon: Users,        label: 'login.role_parent', shortLabel: 'login.role_parent_short', color: 'var(--amber)', bg: 'var(--amber-light)', border: 'rgba(180,83,9,0.3)'   },
  { role: 'STUDENT', icon: GraduationCap,label: 'login.role_student', shortLabel: 'login.role_student_short', color: 'var(--purple)', bg: 'var(--purple-light)', border: 'rgba(124,58,237,0.3)' },
  { role: 'STAFF',   icon: Search,       label: 'login.role_staff', shortLabel: 'login.role_staff_short', color: 'var(--teal)', bg: 'var(--teal-light)', border: 'rgba(13,148,136,0.3)' },
]

const ROLES = [
  { icon: School,       nameKey:'login.role_admin',  descKey:'login.role_admin_desc' },
  { icon: Presentation, nameKey:'login.role_teacher', descKey:'login.role_teacher_desc' },
  { icon: Users,        nameKey:'login.role_parent', descKey:'login.role_parent_desc' },
  { icon: GraduationCap,nameKey:'login.role_student', descKey:'login.role_student_desc' },
  { icon: Search,       nameKey:'login.role_staff',  descKey:'login.role_staff_desc' },
]

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
  const [loading, setLoading]                   = useState(false)
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

  // ── Étape TOTP (Admin/Staff/Teacher, MFA déjà configuré) ──
  const [totpCode, setTotpCode] = useState('')
  const [isRecovery, setIsRecovery] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)
  const [totpAlert, setTotpAlert] = useState<string | null>(null)

  // ── Étape configuration MFA obligatoire (1re connexion Admin/Staff/Teacher) ──
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

  // Empêcher le remplissage automatique du navigateur (sécurité)
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

  // ── Finalise la connexion (appelé après OTP seul, ou après TOTP, ou après activation MFA) ──
  const completeLogin = (data: LoginData) => {
    const { role, nomComplet, userId, permissions, roleMismatch, mustChangePassword, redirectTo } = data
    const config = ROLE_CONFIG[role] ?? { icon: User, badge: role, color: 'var(--text3)', bg: 'var(--bg2)', dest: '/' }
    const dest = mustChangePassword ? '/change-password' : (redirectTo ?? config.dest)
    const firstName = nomComplet?.split(' ')[0] ?? 'Bienvenue'

    localStorage.setItem('zekoulabia_user', JSON.stringify({
      userId, role, nomComplet, firstName,
      permissions: permissions ?? [],
      mustChangePassword: mustChangePassword ?? false,
    }))

    setSuccess({ ...config, dest, firstName })
  }

  // ── Étape 1 : identifiants ──
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
        // Backward compat: role mismatch within same school
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

  // ── Choisir un compte (multi-comptes) ──
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

  // ── Étape 2 : code email ──
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

  // ── Étape 3 : TOTP (MFA déjà configuré) ──
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

  // ── Étape 4 : configuration MFA obligatoire (1re connexion) ──
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

  return (
    <div className="overflow-y-auto xl:overflow-hidden" style={{
      display: 'flex', minHeight: '100dvh',
      background: 'var(--bg)',
      fontFamily: 'var(--font-nunito), Nunito, sans-serif'
    }}>

      {/* ══ PANNEAU GAUCHE — vitrine, cachée sous xl : en dessous, le panneau droit devient trop
          etroit pour la grille des roles (le mot "Administrateur" wrap), donc on repousse
          l-apparition du panneau gauche a un point ou la moitie d-ecran restante reste large ══ */}
      <div className="hidden xl:flex xl:w-[48%]" style={{
        background: 'var(--sidebar)',
        flexDirection: 'column',
        position: 'relative', overflow: 'hidden', flexShrink: 0
      }}>
        <AnimatedBackground variant="stars" style={{ zIndex: 0 }} />

        <div style={{
          height: 6, flexShrink: 0, position: 'relative', zIndex: 1,
          background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 16px,var(--green) 16px,var(--green) 32px,var(--red) 32px,var(--red) 48px,#60a5fa 48px,#60a5fa 64px,#d4a843 64px,#d4a843 80px)'
        }} />

        <div style={{
          position: 'absolute', bottom: -80, right: -80,
          width: 300, height: 300, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)'
        }} />
        <div style={{
          position: 'absolute', top: 100, left: -60,
          width: 200, height: 200, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)'
        }} />

        <div style={{
          padding: '44px', display: 'flex', flexDirection: 'column',
          flex: 1, position: 'relative', zIndex: 1
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 60 }}>
            <div style={{ width: 64, height: 64, borderRadius: 14, background: "linear-gradient(135deg,var(--amber),var(--green))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(34,197,94,0.25)", overflow: "hidden" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "65%", height: "65%", objectFit: "contain" }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 36, fontWeight: 700, color: 'white' }}>ZekoulABia</div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{t('login.tagline')}</div>
            </div>
            <LanguageSwitch style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }} />
          </div>

          <div style={{
            fontFamily: 'var(--font-spectral),Spectral,serif',
            fontSize: 48, fontWeight: 700, lineHeight: 1.2,
            color: 'white', marginBottom: 14
          }}>
            {t('login.left_title_1')}<br />
            {t('login.left_title_2')} <span style={{ color: '#4ade80' }}>{t('login.left_title_highlight')}</span><br />
            {t('login.left_title_3')}
          </div>

          <p style={{
            fontSize: 19, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7,
            fontWeight: 500, maxWidth: 400, marginBottom: 48
          }}>
            {t('login.left_subtitle')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ROLES.map((role, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, cursor: 'default',
                transition: 'all 0.2s'
              }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.14)', transform: 'translateX(4px)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', transform: 'none' })}
              >
                <div style={{
                  width: 50, height: 50, color: 'white',
                  background: 'rgba(255,255,255,0.06)', borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}><role.icon size={26} strokeWidth={2} /></div>
                <div>
                  <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{t(role.nameKey)}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15, fontWeight: 500 }}>{t(role.descKey)}</div>
                </div>
                <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', display: 'flex' }}><ChevronRight size={20} strokeWidth={2} /></div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', fontSize: 16, color: 'rgba(255,255,255,0.2)', fontWeight: 500, paddingTop: 16 }}>
            {t('login.copyright')}
          </div>
        </div>
      </div>

      {/* ══ PANNEAU DROIT ══ */}
      <div className="px-4 py-4 md:p-10" style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', position: 'relative', overflowY: 'auto',
      }}>
        {/* Le panneau gauche (qui porte normalement le selecteur de langue) est cache sous xl */}
        <div className="xl:hidden" style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
          <LanguageSwitch compact />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: 530, position: 'relative', zIndex: 1 }}>

          {suspended ? (
            <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
              <style>{`@keyframes edu-fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }`}</style>
              <div style={{ background: 'var(--red-light)', border: '2px solid rgba(220,38,38,0.25)', borderRadius: 16, padding: '32px 36px', boxShadow: '0 4px 24px rgba(220,38,38,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--red)', marginBottom: 16 }}><Ban size={40} strokeWidth={2} /></div>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--red)', marginBottom: 12, textAlign: 'center' }}>
                  {t('login.suspended_title')}
                </div>
                <div style={{ fontSize: 15, color: 'var(--red)', fontWeight: 600, lineHeight: 1.7, marginBottom: 20 }}>
                  {t('login.suspended_msg', { school: suspended.schoolName })}
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                  {t('login.suspended_support')}{' '}
                  <a href="mailto:support@zekoulabia.cm" style={{ color: 'var(--green)', fontWeight: 700 }}>support@zekoulabia.cm</a>
                </div>
                <button
                  onClick={() => setSuspended(null)}
                  style={{ width: '100%', padding: '12px 0', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, fontSize: 15, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t('login.suspended_back')}
                </button>
              </div>
            </div>
          ) : step === 'credentials' ? (

          <>{/* Welcome */}
          <div className="mb-5 md:mb-8">
            <span className="[&>svg]:w-6 [&>svg]:h-6 md:[&>svg]:w-11 md:[&>svg]:h-11 mb-2 md:mb-[10px]" style={{ color: 'var(--text)', display: 'block' }}><Hand strokeWidth={2} /></span>
            <div className="text-[19px] md:text-[36px] mb-1 md:mb-1.5" style={{
              fontFamily: 'var(--font-spectral),Spectral,serif',
              fontWeight: 700, color: 'var(--text)', lineHeight: 1.2
            }}>
              {t('login.right_title')}
            </div>
            <div className="text-[11.5px] md:text-[18px]" style={{ color: 'var(--text2)', fontWeight: 500, lineHeight: 1.4 }}>
              {t('login.right_subtitle')}
            </div>
          </div>

          {alert && (
            <div className="text-[13px] md:text-[17px] mb-3 md:mb-4 px-3 py-2.5 md:px-3.5 md:py-3" style={{
              borderRadius: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8,
              background: alert.type === 'error' ? 'var(--red-light)' : 'var(--orange-light)',
              border: alert.type === 'error' ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(234,88,12,0.2)',
              color: alert.type === 'error' ? 'var(--red)' : 'var(--orange)'
            }}>
              <AlertTriangle size={17} strokeWidth={2} className="shrink-0" /><span>{alert.msg}</span>
            </div>
          )}

          {/* Email */}
          <div className="mb-4 md:mb-[18px]">
            <label className="text-[12px] md:text-[15px] mb-1 md:mb-[7px]" style={{ fontWeight: 800, color: 'var(--text2)', display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {t('fields.email')}
            </label>
            <input
              ref={emailRef} type="email" value={email}
              onChange={e => { setEmail(e.target.value); setAlert(null) }}
              onKeyDown={e => e.key === 'Enter' && submitCredentials()}
              placeholder={t('login.email_placeholder')}
              autoComplete="off"
              className="text-[13px] md:text-[14px] px-3 py-2.5 md:px-4 md:py-[19px]"
              style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.2s' }}
            />
          </div>

          {/* Mot de passe */}
          <div className="mb-4 md:mb-[18px]">
            <label className="text-[12px] md:text-[15px] mb-1 md:mb-[7px]" style={{ fontWeight: 800, color: 'var(--text2)', display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {t('fields.password')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setAlert(null) }}
                onKeyDown={e => e.key === 'Enter' && submitCredentials()}
                placeholder={t('login.password_placeholder')} autoComplete="new-password"
                className="text-[13px] md:text-[14px] px-3 py-2.5 md:px-4 md:py-[19px]"
                style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.2s' }}
              />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="mb-4 md:mb-[18px]" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
            <button
              type="button"
              onClick={() => { setForgotOpen(true); setForgotDone(false); setForgotError(''); setForgotEmail(email) }}
              className="text-[12.5px] md:text-[15px]"
              style={{ fontWeight: 700, color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              {t('auth.forgotPassword')}
            </button>
          </div>

          <button onClick={submitCredentials} disabled={loading}
            className="text-[15px] md:text-[19px] py-2.5 md:py-[14px]"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg,var(--green),var(--green2))',
              color: 'white', fontWeight: 800,
              border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(5,150,105,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loading ? 0.8 : 1
            }}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? t('login.signing_in') : t('auth.signIn')}
          </button>

        </>
        ) : step === 'choose_account' ? (

          <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
            <style>{`@keyframes edu-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <button onClick={() => { setStep('credentials'); setAccountChoices(null); setPendingCredentials(null) }}
              className="text-[13px] md:text-[15px] mb-4 md:mb-5"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>
              <ArrowLeft size={16} /> {t('login.back')}
            </button>
            <div className="mb-4 md:mb-5">
              <div className="text-[22px] md:text-[30px] mb-1.5 md:mb-2" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('login.choose_account_title')}</div>
              <div className="text-[13px] md:text-[16px]" style={{ color: 'var(--text2)', fontWeight: 500, lineHeight: 1.5 }}>
                {t('login.choose_account_subtitle')}
              </div>
            </div>
            {accountChoices && accountChoices.map((account) => (
              <button
                key={account.userId}
                type="button"
                onClick={() => submitAccountChoice(account)}
                disabled={loading}
                className="w-full text-left p-4 mb-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg2)]"
              >
                <div className="font-semibold">{account.schoolName}</div>
                <div className="text-sm text-[var(--text3)]">
                  {t(`login.role_${account.role.toLowerCase()}`) || account.role} · {account.nomComplet}
                </div>
              </button>
            ))}
          </div>

        ) : step === 'email_otp' ? (

          <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
            <style>{`@keyframes edu-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <button onClick={() => { setStep('credentials'); if (otpTimerRef.current) clearInterval(otpTimerRef.current) }}
              className="text-[13px] md:text-[15px] mb-4 md:mb-5"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>
              <ArrowLeft size={16} /> {t('login.back')}
            </button>
            <div className="mb-4 md:mb-5">
              <div className="text-[22px] md:text-[30px] mb-1.5 md:mb-2" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('login.otp_title')}</div>
              <div className="text-[13px] md:text-[16px]" style={{ color: 'var(--text2)', fontWeight: 500, lineHeight: 1.5 }}>
                {t('login.otp_subtitle', { email: maskEmail(email) })}
              </div>
            </div>
            {otpAlert && (
              <div className="text-[13px] md:text-[15px] mb-3 md:mb-4 px-3 py-2.5 md:px-3.5 md:py-3" style={{ borderRadius: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--red)' }}>
                <AlertTriangle size={16} strokeWidth={2} className="shrink-0" /><span>{otpAlert}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              {otp.map((v, i) => (
                <input key={i}
                  ref={el => { otpRefs.current[i] = el }}
                  type="tel" maxLength={1} value={v}
                  onChange={e => handleOtpInput(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  className="h-12 sm:h-[68px] text-[18px] sm:text-[24px]"
                  style={{ flex: 1, textAlign: 'center', fontWeight: 900, background: v ? 'var(--green-light)' : 'var(--surface)', border: `1.5px solid ${v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, outline: 'none', color: v ? 'var(--green)' : 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s', minWidth: 0, maxWidth: 100 }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <div className="text-[12.5px] md:text-[14.5px]" style={{ fontWeight: 700, color: otpTimerSecs <= 60 ? 'var(--red)' : 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={15} /> {timerMin}:{String(timerSecDisp).padStart(2, '0')}
              </div>
              <button onClick={resendOtp} disabled={!otpResendEnabled}
                className="text-[12.5px] md:text-[14.5px]"
                style={{ fontWeight: 700, color: otpResendEnabled ? 'var(--green)' : 'var(--text3)', cursor: otpResendEnabled ? 'pointer' : 'default', background: 'none', border: 'none', fontFamily: 'inherit' }}>
                {t('login.otp_resend')}
              </button>
            </div>
            <button onClick={() => submitOtp()} disabled={otpLoading}
              className="text-[15px] md:text-[17px] py-2.5 md:py-[14px] mt-4 md:mt-5"
              style={{ width: '100%', background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', fontWeight: 800, border: 'none', borderRadius: 10, cursor: otpLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: otpLoading ? 0.8 : 1 }}>
              {otpLoading ? <Loader2 size={18} className="animate-spin" /> : null}
              {t('login.otp_verify')}
            </button>
          </div>

        ) : step === 'totp' ? (

          <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
            <button onClick={() => setStep('email_otp')}
              className="text-[13px] md:text-[15px] mb-4 md:mb-5"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>
              <ArrowLeft size={16} /> {t('login.back')}
            </button>
            <div className="mb-4 md:mb-5">
              <div className="text-[21px] md:text-[28px] mb-1.5 md:mb-2" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('login.totp_title')}</div>
              <div className="text-[13px] md:text-[16px]" style={{ color: 'var(--text2)', fontWeight: 500, lineHeight: 1.5 }}>
                {isRecovery ? t('login.totp_subtitle_recovery') : t('login.totp_subtitle')}
              </div>
            </div>
            {totpAlert && (
              <div className="text-[13px] md:text-[15px] mb-3 md:mb-4 px-3 py-2.5 md:px-3.5 md:py-3" style={{ borderRadius: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--red)' }}>
                <AlertTriangle size={16} strokeWidth={2} className="shrink-0" /><span>{totpAlert}</span>
              </div>
            )}
            {!isRecovery ? (
              <input type="tel" maxLength={6} value={totpCode} placeholder="123456" autoComplete="one-time-code"
                onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setTotpAlert(null) }}
                onKeyDown={e => e.key === 'Enter' && submitTotp()}
                className="text-[22px] md:text-[28px] tracking-[4px] md:tracking-[8px] px-3 py-2.5 md:px-4 md:py-[19px]"
                style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 900, textAlign: 'center', outline: 'none' }} />
            ) : (
              <input type="text" value={recoveryCode} placeholder="ABCD-1234-EFGH-5678" autoComplete="off"
                onChange={e => { setRecoveryCode(e.target.value); setTotpAlert(null) }}
                onKeyDown={e => e.key === 'Enter' && submitTotp()}
                className="text-[15px] md:text-[20px] tracking-[1px] md:tracking-[2px] px-3 py-2.5 md:px-4 md:py-[19px]"
                style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 700, textAlign: 'center', outline: 'none' }} />
            )}
            <div className="my-2.5 md:my-[14px]" style={{ textAlign: 'center' }}>
              <button onClick={() => { setIsRecovery(r => !r); setTotpAlert(null) }}
                className="text-[12.5px] md:text-[14.5px]"
                style={{ fontWeight: 700, color: 'var(--green)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {isRecovery ? <><ArrowLeft size={14} /> {t('login.totp_use_app')}</> : <><KeyRound size={14} /> {t('login.totp_use_recovery')}</>}
              </button>
            </div>
            <button onClick={submitTotp} disabled={totpLoading}
              className="text-[15px] md:text-[17px] py-2.5 md:py-[14px]"
              style={{ width: '100%', background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', fontWeight: 800, border: 'none', borderRadius: 10, cursor: totpLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: totpLoading ? 0.8 : 1 }}>
              {totpLoading ? <Loader2 size={18} className="animate-spin" /> : null}
              {t('login.totp_verify')}
            </button>
          </div>

        ) : (

          /* ── step === 'mfa_setup' — configuration obligatoire (1re connexion) ── */
          <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
            {!recoveryCodes ? (
              <>
                <div className="text-[12.5px] md:text-[14px] px-3 py-2.5 md:px-4 md:py-3" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--amber-light)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, marginBottom: 18, fontWeight: 700, color: 'var(--amber)' }}>
                  <Shield size={16} /> {t('login.mfa_setup_subtitle')}
                </div>
                <div className="text-[21px] md:text-[26px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>
                  {t('login.mfa_setup_title')}
                </div>
                {setupAlert && (
                  <div className="text-[13px] md:text-[15px] mb-3 md:mb-4 px-3 py-2.5 md:px-3.5 md:py-3" style={{ borderRadius: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--red)' }}>
                    <AlertTriangle size={16} strokeWidth={2} className="shrink-0" /><span>{setupAlert}</span>
                  </div>
                )}
                <div className="text-[13px] md:text-[14.5px]" style={{ fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>{t('login.mfa_setup_step1')}</div>
                {qrDataUri ? (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <img src={qrDataUri} alt="QR MFA" className="w-[150px] h-[150px] md:w-[180px] md:h-[180px]" style={{ borderRadius: 12, border: '1.5px solid var(--border)', padding: 8, background: 'white' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={24} className="animate-spin" /></div>
                )}
                {manualKey && (
                  <div style={{ marginBottom: 18 }}>
                    <div className="text-[11px] md:text-[12.5px]" style={{ color: 'var(--text3)', fontWeight: 700, marginBottom: 5 }}>{t('login.mfa_setup_manual_label')}</div>
                    <div className="text-[12px] md:text-[14px] px-2.5 py-2 md:px-3.5 md:py-2.5" style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)', background: 'var(--bg2)', borderRadius: 8, textAlign: 'center', letterSpacing: 1, wordBreak: 'break-all' }}>{manualKey}</div>
                  </div>
                )}
                <div className="text-[13px] md:text-[14.5px]" style={{ fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>{t('login.mfa_setup_code_label')}</div>
                <input type="tel" maxLength={6} value={setupTotpCode} placeholder="123456" autoComplete="one-time-code"
                  onChange={e => { setSetupTotpCode(e.target.value.replace(/\D/g, '')); setSetupAlert(null) }}
                  onKeyDown={e => e.key === 'Enter' && submitMfaSetup()}
                  className="text-[22px] md:text-[28px] tracking-[4px] md:tracking-[8px] px-3 py-3 md:px-4 md:py-[19px]"
                  style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 900, textAlign: 'center', outline: 'none', marginBottom: 18 }} />
                <button onClick={submitMfaSetup} disabled={setupLoading || !qrDataUri}
                  className="text-[15px] md:text-[17px] py-2.5 md:py-[14px]"
                  style={{ width: '100%', background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', fontWeight: 800, border: 'none', borderRadius: 10, cursor: setupLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: setupLoading ? 0.8 : 1 }}>
                  {setupLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                  {t('login.mfa_setup_confirm')}
                </button>
              </>
            ) : (
              <>
                <div className="[&>svg]:w-8 [&>svg]:h-8 md:[&>svg]:w-10 md:[&>svg]:h-10" style={{ display: 'flex', justifyContent: 'center', color: 'var(--green)', marginBottom: 14 }}><Shield strokeWidth={2} /></div>
                <div className="text-[20px] md:text-[24px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textAlign: 'center' }}>
                  {t('login.mfa_setup_recovery_title')}
                </div>
                <div className="text-[13px] md:text-[14.5px]" style={{ color: 'var(--text2)', lineHeight: 1.6, marginBottom: 18, textAlign: 'center' }}>
                  {t('login.mfa_setup_recovery_subtitle')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18, background: 'var(--bg2)', borderRadius: 12, padding: 16 }}>
                  {recoveryCodes.map(code => (
                    <div key={code} className="text-[11px] md:text-[13px] px-2 py-1.5 md:px-2.5 md:py-2" style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, textAlign: 'center' }}>{code}</div>
                  ))}
                </div>
                <button onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
                  className="text-[12px] md:text-[13.5px] py-2 md:py-2.5"
                  style={{ width: '100%', marginBottom: 18, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <Copy size={14} /> Copier les codes
                </button>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
                  <input type="checkbox" checked={recoveryAck} onChange={e => setRecoveryAck(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, width: 18, height: 18 }} />
                  <span className="text-[12.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('login.mfa_setup_recovery_confirm')}</span>
                </label>
                <button onClick={() => pendingLoginData && completeLogin(pendingLoginData)} disabled={!recoveryAck}
                  className="text-[15px] md:text-[17px] py-2.5 md:py-[14px]"
                  style={{ width: '100%', background: recoveryAck ? 'linear-gradient(135deg,var(--green),var(--green2))' : 'var(--text3)', color: 'white', fontWeight: 800, border: 'none', borderRadius: 10, cursor: recoveryAck ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                  {t('login.mfa_setup_continue')}
                </button>
              </>
            )}
          </div>

        )}

        </motion.div>
      </div>

      {/* ══ MODAL SUCCÈS ══ */}
      {success && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="px-7 py-7 md:px-10 md:py-10" style={{
            background: 'var(--surface)', borderRadius: 20,
            textAlign: 'center', maxWidth: 360, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both'
          }}>
            <span style={{ color: success.color, marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <success.icon size={56} strokeWidth={2} />
            </span>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {t('login.success_greeting', { name: success.firstName })}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.6, marginBottom: 8 }}>
              {t('messages.welcome')}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 20,
              fontSize: 13, fontWeight: 800, margin: '12px 0 20px',
              background: success.bg, color: success.color
            }}>
              <success.icon size={14} strokeWidth={2} /> {success.badge}
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: 8, overflow: 'hidden', height: 6, marginBottom: 16 }}>
              <div style={{
                height: '100%', background: 'var(--green)',
                width: progress ? '100%' : '0%',
                transition: 'width 2s linear', borderRadius: 8
              }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 14 }}>
              {t('login.success_redirecting')}
            </div>
            <button
              onClick={() => router.push(success.dest)}
              style={{ width: '100%', padding: 12, background: 'var(--green)', color: 'white', fontSize: 14, fontWeight: 800, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t('login.success_goto')}
            </button>
          </div>
        </div>
      )}

      {/* ══ MODAL MOT DE PASSE OUBLIÉ ══ */}
      {forgotOpen && (
        <div
          onClick={() => !forgotLoading && setForgotOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-7 py-7 md:px-10 md:py-9"
            style={{ background: 'var(--surface)', borderRadius: 20, width: 440, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>

            {forgotDone ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--green)', marginBottom: 14 }}><Mail size={52} strokeWidth={2} /></div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>{t('login.forgot_success_title')}</div>
                <div style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 24 }}>
                  {t('login.forgot_success_msg')}
                </div>
                <button onClick={() => setForgotOpen(false)}
                  style={{ padding: '11px 28px', borderRadius: 11, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t('login.forgot_back')}
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                  {t('login.forgot_title')}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 24, lineHeight: 1.6 }}>
                  {t('login.forgot_subtitle')}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>
                    {t('login.forgot_email_label')}
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleForgotSubmit() }}
                    placeholder={t('login.forgot_email_placeholder')}
                    autoFocus
                    style={{ width: '100%', padding: '12px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }}
                  />
                </div>

                  {forgotError && (
                  <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                    {forgotError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setForgotOpen(false)} disabled={forgotLoading}
                    style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('login.forgot_cancel')}
                  </button>
                  <button onClick={handleForgotSubmit} disabled={forgotLoading}
                    style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: forgotLoading ? 'var(--text3)' : 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: forgotLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
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
