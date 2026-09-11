'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ArrowLeft, KeyRound, School, BarChart3, Shield, Check, EyeOff, Eye, Clock } from 'lucide-react'

// URL relative → proxy Next.js (next.config.ts)
const API_BASE = ''

type AlertState = { msg: string; type: 'error' | 'success' }

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return (local?.[0] ?? '') + '***@' + (domain ?? '')
}

// ── Sub-components defined at module level to avoid remount on render ──

function Alert({ a }: { a: AlertState }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700,
      marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
      background: a.type === 'error' ? '#fee2e2' : '#d1fae5',
      border: a.type === 'error' ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(5,150,105,0.2)',
      color: a.type === 'error' ? '#b91c1c' : '#065f46'
    }}>
      <span style={{ display: 'flex', alignItems: 'center' }}>{a.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}</span><span>{a.msg}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 800, color: '#6b5c45', marginBottom: 6, display: 'block', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#a89478', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 16, padding: 0, transition: 'color 0.15s' }}>
      <ArrowLeft size={13} /> Retour
    </button>
  )
}

function FormHeader({ title, sub }: { title: string; sub: React.ReactNode }) {
  return (
    <div className="mb-3 md:mb-4">
      <div className="text-[20px] md:text-[26px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: '#1a1209', marginBottom: 6, lineHeight: 1.15 }}>{title}</div>
      <div className="text-[12px] md:text-[15px]" style={{ color: '#6b5c45', fontWeight: 500, lineHeight: 1.4 }}>{sub}</div>
    </div>
  )
}

function SubmitBtn({ loading, onClick, children }: { loading: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading} className="edu-submit-btn text-[13px] md:text-[13px] py-2 md:py-3" style={{
      width: '100%', background: 'linear-gradient(135deg,#059669,#047857)',
      color: 'white', fontWeight: 800, border: 'none', borderRadius: 10,
      cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
      boxShadow: '0 2px 8px rgba(5,150,105,0.18)', marginTop: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: loading ? 0.85 : 1
    }}>
      {loading
        ? <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        : children}
    </button>
  )
}

const fieldInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'white',
  border: '1.5px solid #d4c8b8', borderRadius: 10, color: '#1a1209',
  fontSize: 13, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.2s'
}

// ── Main component ──

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

  // Stable refs for Enter key handler
  const stepRef = useRef<1 | 2 | 3>(1)
  const handlersRef = useRef({ s1: () => {}, s2: () => {}, s3: () => {} })
  useEffect(() => { stepRef.current = step }, [step])

  // Empêcher le remplissage automatique du navigateur (sécurité)
  useEffect(() => {
    const t = setTimeout(() => { setEmail(''); setPassword('') }, 50)
    return () => clearTimeout(t)
  }, [])

  // TOTP interval
  useEffect(() => {
    if (step === 3 && !isRecovery) {
      setTotpSecs(30)
      totpRef.current = setInterval(() => setTotpSecs(s => s > 1 ? s - 1 : 30), 1000)
      return () => { if (totpRef.current) clearInterval(totpRef.current) }
    }
    if (totpRef.current) clearInterval(totpRef.current)
  }, [step, isRecovery])

  // Enter key (stable effect using refs)
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
        setAlert2({ msg: 'Email code expired — Le code a expiré', type: 'error' })
      }
    }, 1000)
  }

  const handleStep1 = async () => {
    setAlert1(null)
    if (!email || !password) { setAlert1({ msg: 'Email and password are required', type: 'error' }); return }
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
    if (code.length !== 6) { setAlert2({ msg: 'Invalid email code format — 6 chiffres requis', type: 'error' }); return }
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
    if (!code) { setAlert3({ msg: 'MFA code required — Champ obligatoire', type: 'error' }); return }
    if (!isRecovery && code.length !== 6) { setAlert3({ msg: 'Invalid MFA code — 6 chiffres requis', type: 'error' }); return }
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

  // Update handler refs each render (after functions are defined)
  handlersRef.current.s1 = handleStep1
  handlersRef.current.s2 = handleStep2
  handlersRef.current.s3 = handleStep3

  const timerMin = Math.floor(timerSecs / 60)
  const timerSecDisp = timerSecs % 60
  const totpCircumference = 144
  const totpOffset = totpCircumference - (totpSecs / 30) * totpCircumference
  const totpColor = totpSecs > 10 ? '#059669' : '#dc2626'

  return (
    <>
      <style>{`
        .edu-step:not(:last-child)::after {
          content: '';
          position: absolute;
          top: 13px;
          left: calc(50% + 13px);
          width: calc(100% - 26px);
          height: 2px;
          background: #d4c8b8;
          transition: background 0.4s;
        }
        .edu-step.s-done:not(:last-child)::after,
        .edu-step.s-active:not(:last-child)::after { background: #047857; }
        .edu-feature:hover {
          background: rgba(255,255,255,0.09) !important;
          border-color: rgba(255,255,255,0.14) !important;
          transform: translateX(4px);
        }
        .edu-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(5,150,105,0.35) !important;
          filter: brightness(1.05);
        }
        .edu-submit-btn:active:not(:disabled) { transform: translateY(0); }
        .edu-field:focus {
          border-color: #059669 !important;
          background: #f0ece6 !important;
          box-shadow: 0 0 0 3px rgba(5,150,105,0.08);
        }
        .edu-otp:focus {
          border-color: #059669 !important;
          background: #f0fdf4 !important;
          box-shadow: 0 0 0 3px rgba(5,150,105,0.08);
        }
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        @keyframes edu-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes edu-fadeDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div className="overflow-y-auto md:overflow-hidden" style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>

        {/* ══ LEFT PANEL — vitrine, cachée sous md : la priorité mobile est le formulaire ══ */}
        <div className="hidden md:flex md:w-[50vw]" style={{ minWidth: 0, background: '#1a2e1e', flexDirection: 'column', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          {/* Bande africaine */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, zIndex: 2, background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 16px,#22c55e 16px,#22c55e 32px,#ef4444 32px,#ef4444 48px,#60a5fa 48px,#60a5fa 64px,#d4a843 64px,#d4a843 80px)' }} />
          {/* Cercle déco */}
          <div style={{ position: 'absolute', bottom: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ padding: 28, display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 1, overflow: 'hidden' }}>
            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, paddingTop: 4, animation: 'edu-fadeDown 0.6s ease both' }}>
              <div style={{ width: 44, height: 44, borderRadius: 9, background: "linear-gradient(135deg,#f59e0b,#22c55e)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(34,197,94,0.2)", flexShrink: 0, overflow: "hidden" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "65%", height: "65%", objectFit: "contain" }} /></div>
              <div>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'white' }}>ZekoulABia</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Plateforme Multi-Établissements · Cameroun</div>
              </div>
            </div>

            {/* Heading */}
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 'clamp(22px, 3vw, 26px)', fontWeight: 700, lineHeight: 1.15, color: 'white', marginBottom: 10, animation: 'edu-fadeDown 0.6s 0.1s ease both' }}>
              Accès<br />
              <span style={{ color: '#4ade80' }}>Administrateur</span><br />
              Plateforme
            </div>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, fontWeight: 500, maxWidth: 320, marginBottom: 24, animation: 'edu-fadeDown 0.6s 0.2s ease both' }}>
              Espace réservé exclusivement à l&apos;administrateur système ZekoulABia. Connexion sécurisée à trois facteurs.
            </p>

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'edu-fadeDown 0.6s 0.3s ease both' }}>
              {[
                { bg: 'rgba(34,197,94,0.1)',  icon: KeyRound, title: 'Authentification triple facteur', desc: 'Email + OTP + TOTP' },
                { bg: 'rgba(96,165,250,0.1)',  icon: School, title: 'Gestion multi-établissements',  desc: 'Invite, approuve, supervise' },
                { bg: 'rgba(245,158,11,0.1)',  icon: BarChart3, title: 'Hub de contrôle centralisé',    desc: 'Toutes les écoles en un lieu' },
                { bg: 'rgba(212,168,67,0.1)',  icon: Shield, title: 'Audit complet',                 desc: 'Chaque action tracée et sécurisée' },
              ].map((f, i) => (
                <div key={i} className="edu-feature" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, transition: 'all 0.2s' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><f.icon size={18} /></div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                    <strong style={{ color: 'white', fontWeight: 700 }}>{f.title}</strong> — {f.desc}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.15)', fontWeight: 500, animation: 'edu-fadeDown 0.6s 0.4s ease both' }}>
              © 2026 ZekoulABia · Tous droits réservés · Accès réservé au personnel autorisé
            </div>
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="w-full md:w-[50vw] px-5 md:px-0 py-6 md:py-0" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f3ee', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,0.05) 0%,transparent 70%)', pointerEvents: 'none' }} />

          <div className="w-full md:w-[500px]" style={{ maxWidth: 500, margin: '0 auto', position: 'relative', zIndex: 1, animation: 'edu-fadeUp 0.5s ease both' }}>

            {/* STEPPER — version compacte mobile : texte + barre de progression */}
            <div className="md:hidden" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Étape {step} sur 3</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#a89478' }}>{['Identifiants', 'Vérif. email', 'Double auth.'][step - 1]}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#e5decf', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(step / 3) * 100}%`, background: 'linear-gradient(90deg,#059669,#047857)', borderRadius: 2, transition: 'width 0.3s ease' }} />
              </div>
            </div>

            {/* STEPPER — version complète desktop */}
            <div className="hidden md:block">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
                {([{ n: 1, label: 'Identifiants' }, { n: 2, label: 'Vérif. email' }, { n: 3, label: 'Double auth.' }] as { n: 1 | 2 | 3; label: string }[]).map(({ n, label }) => {
                  const active = step === n, done = step > n
                  return (
                    <div key={n}
                      className={`edu-step${active ? ' s-active' : ''}${done ? ' s-done' : ''}`}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, position: 'relative' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, zIndex: 1, border: `3px solid ${done ? '#047857' : active ? '#059669' : '#d4c8b8'}`, color: done ? 'white' : active ? '#059669' : '#a89478', background: done ? '#047857' : active ? 'rgba(5,150,105,0.08)' : 'white', transition: 'all 0.3s' }}>
                        {done ? <Check size={13} /> : n}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', color: done ? '#047857' : active ? '#059669' : '#a89478' }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── ÉTAPE 1 ── */}
            {step === 1 && (
              <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
                <FormHeader title="Connexion Admin ZekoulABia" sub="Entrez vos identifiants pour accéder au panneau de contrôle." />
                <div className="text-[12px] md:text-[14px] px-3 py-2 md:px-3 md:py-2.5" style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fef3c7', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, marginBottom: 14, fontWeight: 700, color: '#92400e' }}>
                  <Shield size={14} /> Connexion chiffrée — URL d&apos;accès privée
                </div>
                {alert1 && <Alert a={alert1} />}
                <Field label="Adresse email">
                  <input type="email" value={email} autoComplete="off" placeholder="admin@zekoulabia.cm"
                    className="edu-field"
                    onChange={e => { setEmail(e.target.value); setAlert1(null) }}
                    style={fieldInputStyle} />
                </Field>
                <Field label="Mot de passe">
                  <div style={{ position: 'relative' }}>
                    <input type={showPwd ? 'text' : 'password'} value={password} autoComplete="new-password" placeholder="••••••••••••"
                      className="edu-field"
                      onChange={e => { setPassword(e.target.value); setAlert1(null) }}
                      style={fieldInputStyle} />
                    <button type="button" onClick={() => setShowPwd(s => !s)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a89478', cursor: 'pointer', padding: 2, transition: 'color 0.15s' }}>
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
                <SubmitBtn loading={loading1} onClick={handleStep1}>Se connecter →</SubmitBtn>
              </div>
            )}

            {/* ── ÉTAPE 2 ── */}
            {step === 2 && (
              <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
                <BackBtn onClick={() => { setStep(1); if (timerRef.current) clearInterval(timerRef.current) }} />
                <FormHeader
                  title="Vérification par email"
                  sub={<>Entrez le code à 6 chiffres envoyé à{' '}<span style={{ color: '#059669', fontWeight: 700 }}>{maskEmail(email)}</span><br />Validité : 10 minutes</>}
                />
                {alert2 && <Alert a={alert2} />}
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  {otp.map((v, i) => (
                    <input key={i}
                      ref={el => { otpRefs.current[i] = el }}
                      type="tel" maxLength={1} value={v}
                      className="edu-otp"
                      onChange={e => handleOtpInput(i, e.target.value)}
                      onKeyDown={e => handleOtpKey(i, e)}
                      style={{ flex: 1, height: 48, textAlign: 'center', fontSize: 20, fontWeight: 900, background: v ? '#f0fdf4' : 'white', border: `1.5px solid ${v ? '#047857' : '#d4c8b8'}`, borderRadius: 10, outline: 'none', color: v ? '#059669' : '#1a1209', fontFamily: 'inherit', transition: 'all 0.2s', caretColor: '#059669', minWidth: 0, maxWidth: 100 }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: timerSecs <= 60 ? '#dc2626' : '#d97706', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={13} /> {timerMin}:{String(timerSecDisp).padStart(2, '0')}
                  </div>
                  <button onClick={resendOtp} disabled={!resendEnabled}
                    style={{ fontSize: 12, fontWeight: 700, color: resendEnabled ? '#059669' : '#a89478', cursor: resendEnabled ? 'pointer' : 'default', background: 'none', border: 'none', fontFamily: 'inherit' }}>
                    Renvoyer le code
                  </button>
                </div>
                <div style={{ marginTop: 20 }}>
                  <SubmitBtn loading={loading2} onClick={handleStep2}>Vérifier le code →</SubmitBtn>
                </div>
              </div>
            )}

            {/* ── ÉTAPE 3 ── */}
            {step === 3 && (
              <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
                <BackBtn onClick={() => setStep(2)} />
                <FormHeader
                  title="Authentification à deux facteurs"
                  sub={isRecovery
                    ? 'Entrez un de vos codes de récupération à usage unique.'
                    : "Entrez le code à 6 chiffres de votre application d'authentification."}
                />
                {alert3 && <Alert a={alert3} />}

                {/* TOTP mode */}
                {!isRecovery && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                      <div style={{ position: 'relative', width: 44, height: 44 }}>
                        <svg width="44" height="44" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="28" cy="28" r="23" fill="none" stroke="#e8e0d4" strokeWidth="4" />
                          <circle cx="28" cy="28" r="23" fill="none" stroke={totpColor} strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={totpCircumference} strokeDashoffset={totpOffset}
                            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
                        </svg>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 16, fontWeight: 900, color: totpColor, fontFamily: 'inherit' }}>{totpSecs}</div>
                      </div>
                    </div>
                    <Field label="Code TOTP (6 chiffres)">
                      <input type="tel" maxLength={6} value={totpCode} placeholder="123456" autoComplete="one-time-code"
                        className="edu-field"
                        onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setAlert3(null) }}
                        style={{ ...fieldInputStyle, textAlign: 'center', fontSize: 20, fontWeight: 900, letterSpacing: 5 }} />
                    </Field>
                  </>
                )}

                {/* Recovery mode */}
                {isRecovery && (
                  <Field label="Code de récupération">
                    <input type="text" value={recoveryCode} placeholder="ABCD-1234-EFGH-5678" autoComplete="off"
                      className="edu-field"
                      onChange={e => { setRecoveryCode(e.target.value); setAlert3(null) }}
                      style={{ ...fieldInputStyle, letterSpacing: 2, fontSize: 16, fontWeight: 700 }} />
                  </Field>
                )}

                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <button onClick={() => setIsRecovery(r => !r)}
                    style={{ fontSize: 12, fontWeight: 700, color: '#059669', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {isRecovery ? <><ArrowLeft size={13} /> Utiliser le code TOTP</> : <><KeyRound size={13} /> Utiliser un code de récupération</>}
                  </button>
                </div>

                <SubmitBtn loading={loading3} onClick={handleStep3}>Vérifier →</SubmitBtn>
              </div>
            )}

          </div>
        </div>

      </div>
    </>
  )
}
