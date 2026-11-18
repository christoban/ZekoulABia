'use client'

import { ArrowLeft, KeyRound, Clock, EyeOff, Eye, Shield } from 'lucide-react'
import {
  Alert, Field, BackBtn, FormHeader, SubmitBtn, maskEmail,
  inputBaseStyle, handleFocus, handleBlur, type AlertState,
} from './LoginPrimitives'

interface Step1Props {
  email: string
  password: string
  showPwd: boolean
  loading: boolean
  alert: AlertState | null
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onToggleShowPwd: () => void
  onOpenForgot: () => void
  onSubmit: () => void
}

export function Step1Credentials({
  email, password, showPwd, loading, alert,
  onEmailChange, onPasswordChange, onToggleShowPwd, onOpenForgot, onSubmit,
}: Step1Props) {
  return (
    <div>
      <FormHeader title="Connexion Admin ZekoulABia" sub="Entrez vos identifiants pour accéder au panneau de contrôle." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--amber-light)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>
        <Shield size={16} /> Connexion chiffrée — URL d'accès privée
      </div>
      {alert && <Alert a={alert} />}
      <Field label="Adresse email">
        <input type="email" value={email} autoComplete="off" placeholder="admin@zekoulabia.cm"
          onChange={e => onEmailChange(e.target.value)}
          onFocus={handleFocus} onBlur={handleBlur}
          style={inputBaseStyle} />
      </Field>
      <Field label="Mot de passe">
        <div style={{ position: 'relative' }}>
          <input type={showPwd ? 'text' : 'password'} value={password} autoComplete="new-password" placeholder="••••••••••••"
            onChange={e => onPasswordChange(e.target.value)}
            onFocus={handleFocus} onBlur={handleBlur}
            style={{ ...inputBaseStyle, paddingRight: 44 }} />
          <button type="button" onClick={onToggleShowPwd}
            aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, marginTop: -4 }}>
        <button
          type="button"
          onClick={onOpenForgot}
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}
        >
          Mot de passe oublié ?
        </button>
      </div>
      <SubmitBtn loading={loading} onClick={onSubmit}>Se connecter →</SubmitBtn>
    </div>
  )
}

interface Step2Props {
  email: string
  otp: string[]
  otpRefs: React.MutableRefObject<(HTMLInputElement | null)[]>
  timerSecs: number
  resendEnabled: boolean
  loading: boolean
  alert: AlertState | null
  onBack: () => void
  onOtpInput: (idx: number, val: string) => void
  onOtpKey: (idx: number, e: React.KeyboardEvent) => void
  onResend: () => void
  onSubmit: () => void
}

export function Step2EmailOtp({
  email, otp, otpRefs, timerSecs, resendEnabled, loading, alert,
  onBack, onOtpInput, onOtpKey, onResend, onSubmit,
}: Step2Props) {
  const timerMin = Math.floor(timerSecs / 60)
  const timerSecDisp = timerSecs % 60

  return (
    <div>
      <BackBtn onClick={onBack} />
      <FormHeader
        title="Vérification par email"
        sub={<>Entrez le code à 6 chiffres envoyé à{' '}<span style={{ color: 'var(--primary)', fontWeight: 700 }}>{maskEmail(email)}</span><br />Validité : 10 minutes</>}
      />
      {alert && <Alert a={alert} />}
      <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 14 }}>
        {otp.map((v, i) => (
          <input key={i}
            ref={el => { otpRefs.current[i] = el }}
            type="tel" maxLength={1} value={v}
            onChange={e => onOtpInput(i, e.target.value)}
            onKeyDown={e => onOtpKey(i, e)}
            onFocus={handleFocus} onBlur={handleBlur}
            style={{ flex: 1, minHeight: 52, textAlign: 'center', fontSize: 22, fontWeight: 900, background: v ? 'var(--primary-light)' : 'var(--surface)', border: `1.5px solid ${v ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, outline: 'none', color: v ? 'var(--primary)' : 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s', minWidth: 0 }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: timerSecs <= 60 ? 'var(--red)' : 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={15} /> {timerMin}:{String(timerSecDisp).padStart(2, '0')}
        </div>
        <button onClick={onResend} disabled={!resendEnabled}
          style={{ fontSize: 13, fontWeight: 700, color: resendEnabled ? 'var(--primary)' : 'var(--text3)', cursor: resendEnabled ? 'pointer' : 'default', background: 'none', border: 'none', fontFamily: 'inherit', padding: 0 }}>
          Renvoyer le code
        </button>
      </div>
      <SubmitBtn loading={loading} onClick={onSubmit}>Vérifier le code →</SubmitBtn>
    </div>
  )
}

interface Step3Props {
  totpSecs: number
  isRecovery: boolean
  totpCode: string
  recoveryCode: string
  loading: boolean
  alert: AlertState | null
  onBack: () => void
  onTotpChange: (v: string) => void
  onRecoveryChange: (v: string) => void
  onToggleRecovery: () => void
  onSubmit: () => void
}

export function Step3MfaVerification({
  totpSecs, isRecovery, totpCode, recoveryCode, loading, alert,
  onBack, onTotpChange, onRecoveryChange, onToggleRecovery, onSubmit,
}: Step3Props) {
  const totpCircumference = 144
  const totpOffset = totpCircumference - (totpSecs / 30) * totpCircumference
  const totpColor = totpSecs > 10 ? 'var(--primary)' : 'var(--red)'

  return (
    <div>
      <BackBtn onClick={onBack} />
      <FormHeader
        title="Authentification à deux facteurs"
        sub={isRecovery
          ? 'Entrez un de vos codes de récupération à usage unique.'
          : "Entrez le code à 6 chiffres de votre application d'authentification."}
      />
      {alert && <Alert a={alert} />}

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
              onChange={e => onTotpChange(e.target.value.replace(/\D/g, ''))}
              onFocus={handleFocus} onBlur={handleBlur}
              style={{ ...inputBaseStyle, textAlign: 'center', fontSize: 22, fontWeight: 900, letterSpacing: 6 }} />
          </Field>
        </>
      )}

      {isRecovery && (
        <Field label="Code de récupération">
          <input type="text" value={recoveryCode} placeholder="ABCD-1234-EFGH-5678" autoComplete="off"
            onChange={e => onRecoveryChange(e.target.value)}
            onFocus={handleFocus} onBlur={handleBlur}
            style={{ ...inputBaseStyle, letterSpacing: 2, fontSize: 16, fontWeight: 700 }} />
        </Field>
      )}

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <button onClick={onToggleRecovery}
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
          {isRecovery ? <><ArrowLeft size={15} /> Utiliser le code TOTP</> : <><KeyRound size={15} /> Utiliser un code de récupération</>}
        </button>
      </div>

      <SubmitBtn loading={loading} onClick={onSubmit}>Vérifier →</SubmitBtn>
    </div>
  )
}
