'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ArrowLeft, KeyRound, Clock, EyeOff, Eye, Check, Shield } from 'lucide-react'
import PasswordStrengthBar, { getPasswordStrength } from '@/components/PasswordStrengthBar'
import LanguageSwitch from '@/components/LanguageSwitch'

const API_BASE = ''

type AlertState = { msg: string; type: 'error' | 'success' }

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return (local?.[0] ?? '') + '***@' + (domain ?? '')
}

function Alert({ a }: { a: AlertState }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
      marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
      background: a.type === 'error' ? 'var(--red-light)' : 'var(--green-light)',
      border: a.type === 'error' ? '1px solid rgba(217,72,31,0.2)' : '1px solid rgba(47,143,91,0.2)',
      color: a.type === 'error' ? 'var(--red)' : 'var(--success)'
    }}>
      <span style={{ display: 'flex', alignItems: 'center' }}>{a.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}</span><span>{a.msg}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, display: 'block', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 16, padding: 0 }}>
      <ArrowLeft size={16} /> Retour
    </button>
  )
}

function FormHeader({ title, sub }: { title: string; sub: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h1 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', lineHeight: 1.2 }}>{title}</h1>
      <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.4 }}>{sub}</div>
    </div>
  )
}

function SubmitBtn({ loading, onClick, children }: { loading: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width: '100%', minHeight: 48, padding: 12, background: 'var(--primary)',
      color: 'white', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 10,
      cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s',
      boxShadow: '0 4px 14px rgba(180,83,42,0.22)', marginTop: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.85 : 1
    }}
    onMouseEnter={e => !loading && (e.currentTarget.style.background = 'var(--primary-hover)')}
    onMouseLeave={e => !loading && (e.currentTarget.style.background = 'var(--primary)')}
    >
      {loading ? <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : children}
    </button>
  )
}

const inputBaseStyle: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '12px 14px', background: 'var(--surface)',
  border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)',
  fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.2s'
}

export default function SuperAdminLogin() {
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

  // Récupération MDP Master
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotStep, setForgotStep] = useState<1 | 2>(1)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotPwd, setForgotPwd] = useState('')
  const [forgotConfirm, setForgotConfirm] = useState('')
  const [showForgotPwd, setShowForgotPwd] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotAlert, setForgotAlert] = useState<AlertState | null>(null)
  const [forgotDone, setForgotDone] = useState(false)

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
      totpRef.current = setInterval(() => setTotpSecs(s => s > 1 ? s - 1 : 30), 1000)
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
        clearInterval(timerRef.current!)
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
      const res = await fetch(`${API_BASE}/api/v2/master/auth/login`, {
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
    } catch (err: any) {
      setAlert1({ msg: err.message, type: 'error' })
    } finally {
      setLoading1(false)
    }
  }

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[idx] = digit; setOtp(next)
    if (digit && idx < 5) setTimeout(() => otpRefs.current[idx + 1]?.focus(), 0)
    if (digit && idx === 5 && next.join('').length === 6) setTimeout(() => autoSubmit2(next), 50)
  }

  const handleOtpKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      const next = [...otp]; next[idx - 1] = ''; setOtp(next)
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const autoSubmit2 = async (vals: string[]) => {
    const code = vals.join('')
    setAlert2(null); setLoading2(true)
    try {
      const res = await fetch(`${API_BASE}/api/v2/master/auth/verify-otp`, {
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
        setTimeout(() => router.push('/master/dashboard'), 1500)
      }
    } catch (err: any) {
      setAlert2({ msg: err.message, type: 'error' })
    } finally {
      setLoading2(false)
    }
  }

  const handleStep2 = async () => {
    const code = otp.join('')
    setAlert2(null)
    if (code.length !== 6) { setAlert2({ msg: 'Code invalide — 6 chiffres requis', type: 'error' }); return }
    setLoading2(true)
    try {
      const res = await fetch(`${API_BASE}/api/v2/master/auth/verify-otp`, {
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
        setTimeout(() => router.push('/master/dashboard'), 1500)
      }
    } catch (err: any) {
      setAlert2({ msg: err.message, type: 'error' })
    } finally {
      setLoading2(false)
    }
  }

  const resendOtp = async () => {
    setOtp(['', '', '', '', '', '']); setAlert2(null)
    try {
      const res = await fetch(`${API_BASE}/api/v2/master/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      startTimer()
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch (err: any) {
      setAlert2({ msg: err.message, type: 'error' })
    }
  }

  const handleStep3 = async () => {
    setAlert3(null)
    const code = isRecovery ? recoveryCode.trim() : totpCode.trim()
    if (!code) { setAlert3({ msg: 'Code MFA requis', type: 'error' }); return }
    if (!isRecovery && code.length !== 6) { setAlert3({ msg: 'Code invalide — 6 chiffres requis', type: 'error' }); return }
    setLoading3(true)
    try {
      const res = await fetch(`${API_BASE}/api/v2/master/auth/verify-mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      if (totpRef.current) clearInterval(totpRef.current)
      setAlert3({ msg: 'Authentification réussie — Redirection vers le dashboard...', type: 'success' })
      setTimeout(() => router.push('/master/dashboard'), 1500)
    } catch (err: any) {
      setAlert3({ msg: err.message, type: 'error' })
    } finally {
      setLoading3(false)
    }
  }

  const handleForgotSend = async () => {
    setForgotAlert(null)
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) { setForgotAlert({ msg: 'Email invalide', type: 'error' }); return }
    setForgotLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v2/master/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Erreur')
      setForgotStep(2)
      setForgotAlert({ msg: 'Code envoyé à ' + maskEmail(forgotEmail), type: 'success' })
    } catch (err: any) { setForgotAlert({ msg: err.message, type: 'error' }) }
    finally { setForgotLoading(false) }
  }

  const handleForgotConfirm = async () => {
    setForgotAlert(null)
    if (!forgotOtp.trim() || forgotOtp.trim().length < 6) { setForgotAlert({ msg: 'Code OTP requis (6 chiffres)', type: 'error' }); return }
    if (getPasswordStrength(forgotPwd) < 5) { setForgotAlert({ msg: 'Le mot de passe ne respecte pas toutes les règles de sécurité', type: 'error' }); return }
    if (forgotPwd !== forgotConfirm) { setForgotAlert({ msg: 'Les mots de passe ne correspondent pas', type: 'error' }); return }
    setForgotLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v2/master/auth/forgot-password/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase(), otp: forgotOtp.trim(), newPassword: forgotPwd }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Erreur')
      setForgotDone(true)
      setForgotAlert({ msg: 'Mot de passe réinitialisé — vous pouvez vous connecter', type: 'success' })
      setTimeout(() => { setForgotOpen(false); setEmail(forgotEmail.trim().toLowerCase()); setPassword('') }, 1800)
    } catch (err: any) { setForgotAlert({ msg: err.message, type: 'error' }) }
    finally { setForgotLoading(false) }
  }

  handlersRef.current.s1 = handleStep1
  handlersRef.current.s2 = handleStep2
  handlersRef.current.s3 = handleStep3

  const timerMin = Math.floor(timerSecs / 60)
  const timerSecDisp = timerSecs % 60
  const totpCircumference = 144
  const totpOffset = totpCircumference - (totpSecs / 30) * totpCircumference
  const totpColor = totpSecs > 10 ? 'var(--primary)' : 'var(--red)'

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px rgba(227, 176, 75, 0.2)'
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
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
              Accès Administrateur Plateforme
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
                  <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, zIndex: 1, border: `2px solid ${done || active ? 'var(--primary)' : 'var(--border)'}`, color: done ? 'white' : active ? 'var(--primary)' : 'var(--text3)', background: done ? 'var(--primary)' : active ? 'var(--primary-light)' : 'var(--surface)', transition: 'all 0.3s' }}>
                    {done ? <Check size={16} /> : n}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', color: done || active ? 'var(--primary)' : 'var(--text3)' }}>{label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Étape 1 */}
        {step === 1 && (
          <div>
            <FormHeader title="Connexion Admin ZekoulABia" sub="Entrez vos identifiants pour accéder au panneau de contrôle." />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--amber-light)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>
              <Shield size={16} /> Connexion chiffrée — URL d'accès privée
            </div>
            {alert1 && <Alert a={alert1} />}
            <Field label="Adresse email">
              <input type="email" value={email} autoComplete="off" placeholder="admin@zekoulabia.cm"
                onChange={e => { setEmail(e.target.value); setAlert1(null) }}
                onFocus={handleFocus} onBlur={handleBlur}
                style={inputBaseStyle} />
            </Field>
            <Field label="Mot de passe">
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} value={password} autoComplete="new-password" placeholder="••••••••••••"
                  onChange={e => { setPassword(e.target.value); setAlert1(null) }}
                  onFocus={handleFocus} onBlur={handleBlur}
                  style={{ ...inputBaseStyle, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, marginTop: -4 }}>
              <button
                type="button"
                onClick={() => { setForgotOpen(true); setForgotStep(1); setForgotAlert(null); setForgotDone(false); setForgotEmail(email); setForgotOtp(''); setForgotPwd(''); setForgotConfirm('') }}
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}
              >
                Mot de passe oublié ?
              </button>
            </div>
            <SubmitBtn loading={loading1} onClick={handleStep1}>Se connecter →</SubmitBtn>
          </div>
        )}

        {/* Étape 2 */}
        {step === 2 && (
          <div>
            <BackBtn onClick={() => { setStep(1); if (timerRef.current) clearInterval(timerRef.current) }} />
            <FormHeader
              title="Vérification par email"
              sub={<>Entrez le code à 6 chiffres envoyé à{' '}<span style={{ color: 'var(--primary)', fontWeight: 700 }}>{maskEmail(email)}</span><br />Validité : 10 minutes</>}
            />
            {alert2 && <Alert a={alert2} />}
            <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 14 }}>
              {otp.map((v, i) => (
                <input key={i}
                  ref={el => { otpRefs.current[i] = el }}
                  type="tel" maxLength={1} value={v}
                  onChange={e => handleOtpInput(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  onFocus={handleFocus} onBlur={handleBlur}
                  style={{ flex: 1, minHeight: 52, textAlign: 'center', fontSize: 22, fontWeight: 900, background: v ? 'var(--primary-light)' : 'var(--surface)', border: `1.5px solid ${v ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, outline: 'none', color: v ? 'var(--primary)' : 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s', minWidth: 0 }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: timerSecs <= 60 ? 'var(--red)' : 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={15} /> {timerMin}:{String(timerSecDisp).padStart(2, '0')}
              </div>
              <button onClick={resendOtp} disabled={!resendEnabled}
                style={{ fontSize: 13, fontWeight: 700, color: resendEnabled ? 'var(--primary)' : 'var(--text3)', cursor: resendEnabled ? 'pointer' : 'default', background: 'none', border: 'none', fontFamily: 'inherit', padding: 0 }}>
                Renvoyer le code
              </button>
            </div>
            <SubmitBtn loading={loading2} onClick={handleStep2}>Vérifier le code →</SubmitBtn>
          </div>
        )}

        {/* Étape 3 */}
        {step === 3 && (
          <div>
            <BackBtn onClick={() => setStep(2)} />
            <FormHeader
              title="Authentification à deux facteurs"
              sub={isRecovery
                ? 'Entrez un de vos codes de récupération à usage unique.'
                : "Entrez le code à 6 chiffres de votre application d'authentification."}
            />
            {alert3 && <Alert a={alert3} />}

            {!isRecovery && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <div style={{ position: 'relative', width: 52, height: 52 }}>
                    <svg width="52" height="52" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="28" cy="28" r="23" fill="none" stroke="var(--border)" strokeWidth="4" />
                      <circle cx="28" cy="28" r="23" fill="none" stroke={totpColor} strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={totpCircumference} strokeDashoffset={totpOffset}
                        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 18, fontWeight: 900, color: totpColor, fontFamily: 'inherit' }}>{totpSecs}</div>
                  </div>
                </div>
                <Field label="Code TOTP (6 chiffres)">
                  <input type="tel" maxLength={6} value={totpCode} placeholder="123456" autoComplete="one-time-code"
                    onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setAlert3(null) }}
                    onFocus={handleFocus} onBlur={handleBlur}
                    style={{ ...inputBaseStyle, textAlign: 'center', fontSize: 22, fontWeight: 900, letterSpacing: 6 }} />
                </Field>
              </>
            )}

            {isRecovery && (
              <Field label="Code de récupération">
                <input type="text" value={recoveryCode} placeholder="ABCD-1234-EFGH-5678" autoComplete="off"
                  onChange={e => { setRecoveryCode(e.target.value); setAlert3(null) }}
                  onFocus={handleFocus} onBlur={handleBlur}
                  style={{ ...inputBaseStyle, letterSpacing: 2, fontSize: 16, fontWeight: 700 }} />
              </Field>
            )}

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <button onClick={() => setIsRecovery(r => !r)}
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                {isRecovery ? <><ArrowLeft size={15} /> Utiliser le code TOTP</> : <><KeyRound size={15} /> Utiliser un code de récupération</>}
              </button>
            </div>

            <SubmitBtn loading={loading3} onClick={handleStep3}>Vérifier →</SubmitBtn>
          </div>
        )}
      </main>

      {/* ── MODAL RÉCUPÉRATION MDP MASTER ── */}
      {forgotOpen && (
        <div onClick={() => !forgotLoading && setForgotOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: 420, maxWidth: '100%', padding: 24, boxShadow: '0 12px 36px rgba(0,0,0,0.14)' }}>
            {forgotDone ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--success)', marginBottom: 12 }}><CheckCircle2 size={38} /></div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Mot de passe réinitialisé !</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18 }}>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</div>
                <button onClick={() => setForgotOpen(false)} style={{ width: '100%', minHeight: 44, padding: '10px', background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 14, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
              </div>
            ) : forgotStep === 1 ? (
              <>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Mot de passe oublié ?</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.4, marginBottom: 16 }}>Entrez votre email. Un code de vérification vous sera envoyé (valide 15 min).</div>
                {forgotAlert && <Alert a={forgotAlert} />}
                <Field label="Email Master">
                  <input type="email" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setForgotAlert(null) }} onFocus={handleFocus} onBlur={handleBlur} placeholder="admin@zekoulabia.cm" style={inputBaseStyle} />
                </Field>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={() => setForgotOpen(false)} style={{ flex: 1, minHeight: 44, padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 14, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                  <button onClick={handleForgotSend} disabled={forgotLoading} style={{ flex: 1, minHeight: 44, padding: '10px', background: forgotLoading ? 'var(--text3)' : 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 14, border: 'none', borderRadius: 10, cursor: forgotLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: forgotLoading ? 0.7 : 1 }}>{forgotLoading ? 'Envoi…' : 'Envoyer le code →'}</button>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setForgotStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14, padding: 0 }}><ArrowLeft size={16} /> Retour</button>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Réinitialiser le mot de passe</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Code envoyé à <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{maskEmail(forgotEmail)}</span></div>
                {forgotAlert && <Alert a={forgotAlert} />}
                <Field label="Code OTP (6 chiffres)">
                  <input type="tel" maxLength={6} value={forgotOtp} onChange={e => { setForgotOtp(e.target.value.replace(/\D/g, '')); setForgotAlert(null) }} onFocus={handleFocus} onBlur={handleBlur} placeholder="123456" style={{ ...inputBaseStyle, textAlign: 'center', letterSpacing: 4, fontSize: 20, fontWeight: 900 }} />
                </Field>
                <Field label="Nouveau mot de passe">
                  <div style={{ position: 'relative' }}>
                    <input type={showForgotPwd ? 'text' : 'password'} value={forgotPwd} onChange={e => { setForgotPwd(e.target.value); setForgotAlert(null) }} onFocus={handleFocus} onBlur={handleBlur} placeholder="••••••••••••" style={{ ...inputBaseStyle, paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowForgotPwd(s => !s)} aria-label={showForgotPwd ? "Masquer" : "Afficher"} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{showForgotPwd ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                  </div>
                  {forgotPwd && <PasswordStrengthBar password={forgotPwd} />}
                </Field>
                <Field label="Confirmer le mot de passe">
                  <input type={showForgotPwd ? 'text' : 'password'} value={forgotConfirm} onChange={e => { setForgotConfirm(e.target.value); setForgotAlert(null) }} onFocus={handleFocus} onBlur={handleBlur} placeholder="••••••••••••" style={inputBaseStyle} />
                </Field>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={() => setForgotOpen(false)} style={{ flex: 1, minHeight: 44, padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 14, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                  <button onClick={handleForgotConfirm} disabled={forgotLoading} style={{ flex: 1, minHeight: 44, padding: '10px', background: forgotLoading ? 'var(--text3)' : 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 14, border: 'none', borderRadius: 10, cursor: forgotLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: forgotLoading ? 0.7 : 1 }}>{forgotLoading ? '…' : 'Réinitialiser →'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
