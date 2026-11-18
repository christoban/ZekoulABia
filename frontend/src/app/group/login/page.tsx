'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import LanguageSwitch from '@/components/LanguageSwitch'
import type { AlertState } from './_components/GroupLoginPrimitives'
import {
  GroupStep1Credentials,
  GroupStep2Otp,
  GroupStep3Mfa,
} from './_components/GroupLoginSteps'

const API_BASE = ''

export default function GroupOwnerLogin() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading1, setLoading1] = useState(false)
  const [alert1, setAlert1] = useState<AlertState | null>(null)

  // Step 2
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [timerSecs, setTimerSecs] = useState(600)
  const [resendEnabled, setResendEnabled] = useState(false)
  const [loading2, setLoading2] = useState(false)
  const [alert2, setAlert2] = useState<AlertState | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerSecsRef = useRef(600)

  // Step 3
  const [totpSecs, setTotpSecs] = useState(30)
  const [isRecovery, setIsRecovery] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [loading3, setLoading3] = useState(false)
  const [alert3, setAlert3] = useState<AlertState | null>(null)
  const totpRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stable refs for Enter key handler
  const stepRef = useRef<1 | 2 | 3>(1)
  const handlersRef = useRef({ s1: () => {}, s2: () => {}, s3: () => {} })
  useEffect(() => { stepRef.current = step }, [step])

  useEffect(() => {
    const t = setTimeout(() => { setEmail(''); setPassword('') }, 50)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (step === 3 && !isRecovery) {
      setTotpSecs(30)
      totpRef.current = setInterval(() => setTotpSecs(s => (s > 1 ? s - 1 : 30)), 1000)
      return () => { if (totpRef.current) clearInterval(totpRef.current) }
    }
    if (totpRef.current) clearInterval(totpRef.current)
  }, [step, isRecovery])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (stepRef.current === 1) handlersRef.current.s1()
        else if (stepRef.current === 2) handlersRef.current.s2()
        else handlersRef.current.s3()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerSecsRef.current = 600
    setTimerSecs(600)
    setResendEnabled(false)
    timerRef.current = setInterval(() => {
      timerSecsRef.current -= 1
      setTimerSecs(timerSecsRef.current)
      if (timerSecsRef.current === 120) setResendEnabled(true)
      if (timerSecsRef.current <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        setAlert2({ msg: 'Le code a expiré', type: 'error' })
      }
    }, 1000)
  }

  const handleStep1 = async () => {
    setAlert1(null)
    if (!email || !password) { setAlert1({ msg: 'Email et mot de passe requis', type: 'error' }); return }
    if (!email.includes('@')) { setAlert1({ msg: 'Format email invalide', type: 'error' }); return }
    setLoading1(true)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      startTimer()
      setStep(2)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err: unknown) {
      setAlert1({ msg: err instanceof Error ? err.message : 'Erreur', type: 'error' })
    } finally {
      setLoading1(false)
    }
  }

  const submitVerifyOtp = async (code: string) => {
    setAlert2(null)
    setLoading2(true)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, otp: code }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      if (timerRef.current) clearInterval(timerRef.current)
      if (data.mfaRequired) {
        setStep(3)
      } else {
        setAlert2({ msg: 'Authentification réussie — Redirection...', type: 'success' })
        setTimeout(() => router.push('/group/dashboard'), 1500)
      }
    } catch (err: unknown) {
      setAlert2({ msg: err instanceof Error ? err.message : 'Erreur', type: 'error' })
    } finally {
      setLoading2(false)
    }
  }

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < 5) setTimeout(() => otpRefs.current[idx + 1]?.focus(), 0)
    if (digit && idx === 5 && next.join('').length === 6) setTimeout(() => void submitVerifyOtp(next.join('')), 50)
  }

  const handleOtpKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      const next = [...otp]
      next[idx - 1] = ''
      setOtp(next)
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const handleStep2 = async () => {
    const code = otp.join('')
    if (code.length !== 6) {
      setAlert2({ msg: 'Code invalide — 6 chiffres requis', type: 'error' })
      return
    }
    await submitVerifyOtp(code)
  }

  const resendOtp = async () => {
    setOtp(['', '', '', '', '', ''])
    setAlert2(null)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      startTimer()
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch (err: unknown) {
      setAlert2({ msg: err instanceof Error ? err.message : 'Erreur', type: 'error' })
    }
  }

  const handleStep3 = async () => {
    setAlert3(null)
    const code = isRecovery ? recoveryCode.trim() : totpCode.trim()
    if (!code) { setAlert3({ msg: 'Code MFA requis', type: 'error' }); return }
    if (!isRecovery && code.length !== 6) { setAlert3({ msg: 'Code invalide — 6 chiffres requis', type: 'error' }); return }
    setLoading3(true)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/auth/verify-mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      if (totpRef.current) clearInterval(totpRef.current)
      setAlert3({ msg: 'Authentification réussie — Redirection vers le dashboard...', type: 'success' })
      setTimeout(() => router.push('/group/dashboard'), 1500)
    } catch (err: unknown) {
      setAlert3({ msg: err instanceof Error ? err.message : 'Erreur', type: 'error' })
    } finally {
      setLoading3(false)
    }
  }

  handlersRef.current.s1 = handleStep1
  handlersRef.current.s2 = handleStep2
  handlersRef.current.s3 = handleStep3

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
      fontFamily: 'var(--font-nunito), Nunito, sans-serif',
    }}>
      {/* Motif géométrique discret */}
      <div className="login-bg" />

      {/* Bande multicolore camerounaise */}
      <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 5 }} />

      {/* En-tête commun */}
      <header style={{
        position: 'absolute', top: 5, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg,var(--primary),var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(180,83,42,0.22)', overflow: 'hidden',
          }}>
            <img src="/logo.svg" alt="ZekoulABia" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              ZekoulABia
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              Espace Fondateur de Groupe
            </span>
          </div>
        </div>
        <LanguageSwitch compact />
      </header>

      {/* Form Card */}
      <main style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 480,
        width: 'calc(100% - 32px)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)',
      }}>
        {/* Stepper */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {([{ n: 1, label: 'Identifiants' }, { n: 2, label: 'Vérif. email' }, { n: 3, label: 'Double auth.' }] as { n: 1 | 2 | 3; label: string }[]).map(({ n, label }) => {
              const active = step === n, done = step > n
              return (
                <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, position: 'relative' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, zIndex: 1,
                    border: `2px solid ${done || active ? 'var(--primary)' : 'var(--border)'}`,
                    color: done ? 'white' : active ? 'var(--primary)' : 'var(--text3)',
                    background: done ? 'var(--primary)' : active ? 'var(--primary-light)' : 'var(--surface)',
                    transition: 'all 0.3s',
                  }}>
                    {done ? <Check size={16} /> : n}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', color: done || active ? 'var(--primary)' : 'var(--text3)' }}>{label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {step === 1 && (
          <GroupStep1Credentials
            email={email}
            password={password}
            showPwd={showPwd}
            loading={loading1}
            alert={alert1}
            onEmailChange={val => { setEmail(val); setAlert1(null) }}
            onPasswordChange={val => { setPassword(val); setAlert1(null) }}
            onToggleShowPwd={() => setShowPwd(s => !s)}
            onSubmit={handleStep1}
          />
        )}

        {step === 2 && (
          <GroupStep2Otp
            email={email}
            otp={otp}
            timerSecs={timerSecs}
            resendEnabled={resendEnabled}
            loading={loading2}
            alert={alert2}
            setOtpRef={(i, el) => { otpRefs.current[i] = el }}
            onBack={() => { setStep(1); if (timerRef.current) clearInterval(timerRef.current) }}
            onOtpInput={handleOtpInput}
            onOtpKey={handleOtpKey}
            onResend={resendOtp}
            onSubmit={handleStep2}
          />
        )}

        {step === 3 && (
          <GroupStep3Mfa
            totpSecs={totpSecs}
            isRecovery={isRecovery}
            totpCode={totpCode}
            recoveryCode={recoveryCode}
            loading={loading3}
            alert={alert3}
            onBack={() => setStep(2)}
            onTotpChange={val => { setTotpCode(val); setAlert3(null) }}
            onRecoveryChange={val => { setRecoveryCode(val); setAlert3(null) }}
            onToggleRecovery={() => setIsRecovery(r => !r)}
            onSubmit={handleStep3}
          />
        )}
      </main>
    </div>
  )
}
