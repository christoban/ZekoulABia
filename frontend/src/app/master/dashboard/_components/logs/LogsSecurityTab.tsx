'use client'

import { useState } from 'react'
import {
  CheckCircle2, XCircle, RotateCw, KeyRound, Smartphone,
  AlertTriangle, EyeOff, Eye, ArrowLeft, Download, Globe,
} from 'lucide-react'
import { mfaSetup, mfaEnable, mfaDisable, mfaRegenCodes } from '../../_api'

type MfaFlow = 'enable-qr' | 'enable-verify' | 'enable-codes' | 'disable' | 'regen' | 'regen-codes' | null

function downloadRecoveryCodes(codes: string[]): void {
  const content = [
    'CODES DE RÉCUPÉRATION — ZEKOULABIA MASTER ADMIN',
    '='.repeat(48),
    `Générés le : ${new Date().toLocaleString('fr-CM')}`,
    '',
    'IMPORTANT : Chaque code est à usage unique.',
    'Conservez ce fichier dans un endroit sûr et confidentiel.',
    "Supprimez ce fichier après l'avoir imprimé ou stocké dans un gestionnaire de mots de passe.",
    '',
    ...codes.map((code, i) => `  ${String(i + 1).padStart(2, '0')}.  ${code}`),
    '',
    "Ces codes vous permettent de vous connecter si vous n'avez plus accès",
    "à votre application d'authentification (Google Authenticator, Authy…).",
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zekoulabia-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const inpStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
  outline: 'none', boxSizing: 'border-box',
}
const btnGreenStyle: React.CSSProperties = {
  padding: '9px 16px', background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white',
  border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer',
  fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(142,42,58,0.18)',
}
const btnGrayStyle: React.CSSProperties = {
  padding: '9px 14px', background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)',
  borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
}
const btnRedStyle: React.CSSProperties = {
  padding: '9px 14px', background: 'var(--red-light)', color: 'var(--red)',
  border: '1px solid rgba(220,38,38,0.2)', borderRadius: 9, fontSize: 13, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit',
}
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: 'var(--text2)', marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px',
}

function PasswordInput({
  label,
  value,
  show,
  onToggleShow,
  onChange,
}: {
  label: string
  value: string
  show: boolean
  onToggleShow: () => void
  onChange: (val: string) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={fieldLabelStyle}>{label}</label>
      <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
      <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inpStyle, paddingRight: 40 }}
          type={show ? 'text' : 'password'}
          placeholder="••••••••••••"
          value={value}
          autoComplete="new-password"
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onToggleShow}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center' }}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  )
}

function RecoveryCodesResult({
  title,
  subtitle,
  codes,
  finishLabel,
  onFinish,
}: {
  title: string
  subtitle: React.ReactNode
  codes: string[]
  finishLabel: string
  onFinish: () => void
}) {
  return (
    <div>
      <div style={{ padding: '14px 16px', background: 'var(--amber-light)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, marginBottom: 16 }}>
        <strong style={{ color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={16} /> {title}</strong>
        <p style={{ color: 'var(--amber)', fontSize: 12, marginTop: 4, marginBottom: 0, lineHeight: 1.5 }}>{subtitle}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        {codes.map((code, i) => (
          <div key={i} style={{ background: 'var(--bg2)', borderRadius: 6, padding: '7px 10px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--text)', textAlign: 'center', letterSpacing: 1 }}>
            {code}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...btnGrayStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => downloadRecoveryCodes(codes)}>
          <Download size={16} /> Télécharger (.txt)
        </button>
        <button type="button" style={{ ...btnGreenStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={onFinish}>
          <CheckCircle2 size={16} /> {finishLabel}
        </button>
      </div>
    </div>
  )
}

/** Onglet Sécurité du compte (Mot de passe + flux MFA TOTP) */
export default function LogsSecurityTab({ mfaEnabled, onChangePwd, onMfaChange }: {
  mfaEnabled: boolean
  onChangePwd: () => void
  onMfaChange: () => void
}) {
  const [flow, setFlow] = useState<MfaFlow>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [qrDataUri, setQrDataUri] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [disablePwd, setDisablePwd] = useState('')
  const [disableMfa, setDisableMfa] = useState('')
  const [showEnablePwd, setShowEnablePwd] = useState(false)
  const [showDisablePwd, setShowDisablePwd] = useState(false)

  const reset = () => {
    setFlow(null); setError(''); setLoading(false)
    setQrDataUri(''); setManualKey(''); setTotpCode(''); setPassword('')
    setDisablePwd(''); setDisableMfa(''); setRecoveryCodes([])
  }

  async function startEnableMfa() {
    setLoading(true); setError('')
    try {
      const data = await mfaSetup()
      setQrDataUri(data.qrDataUri); setManualKey(data.manualKey); setFlow('enable-qr')
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  async function handleEnableVerify() {
    if (!totpCode.trim() || totpCode.trim().length !== 6) { setError('Entrez le code à 6 chiffres de votre application.'); return }
    if (!password.trim()) { setError('Le mot de passe est requis.'); return }
    setLoading(true); setError('')
    try {
      const data = await mfaEnable(totpCode.trim(), password.trim())
      setRecoveryCodes(data.recoveryCodes); setFlow('enable-codes')
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  async function handleDisableOrRegen(mode: 'disable' | 'regen') {
    if (!disablePwd.trim()) { setError('Mot de passe requis.'); return }
    if (!disableMfa.trim()) { setError('Code MFA requis.'); return }
    setLoading(true); setError('')
    try {
      if (mode === 'disable') {
        await mfaDisable(disablePwd.trim(), disableMfa.trim())
        reset()
        onMfaChange()
      } else {
        const data = await mfaRegenCodes(disablePwd.trim(), disableMfa.trim())
        setRecoveryCodes(data.recoveryCodes)
        setFlow('regen-codes')
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={17} />
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Mot de passe</span>
        </div>
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14, marginTop: 0 }}>
            Modifiez votre mot de passe master. Vous devrez saisir votre mot de passe actuel{mfaEnabled ? ' et votre code MFA' : ''}.
          </p>
          <button type="button" style={{ ...btnGreenStyle, display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={onChangePwd}>
            <KeyRound size={16} /> Changer le mot de passe
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={17} />
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Authentification à deux facteurs (MFA)</span>
          </div>
          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, background: mfaEnabled ? 'rgba(142,42,58,0.1)' : 'rgba(220,38,38,0.08)', color: mfaEnabled ? 'var(--primary)' : '#dc2626', border: `1px solid ${mfaEnabled ? 'rgba(142,42,58,0.25)' : 'rgba(220,38,38,0.2)'}`, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {mfaEnabled ? <><CheckCircle2 size={14} /> Actif</> : <><XCircle size={14} /> Inactif</>}
          </span>
        </div>

        <div style={{ padding: '12px 14px' }}>
          {error && (
            <div style={{ padding: '8px 10px', background: 'var(--red-light)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          {!flow && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14, marginTop: 0 }}>
                {mfaEnabled
                  ? 'Le MFA est actif. Toutes les actions sensibles nécessitent votre code TOTP (Google Authenticator, Authy…).'
                  : 'Le MFA n\'est pas activé. Activez-le pour renforcer la sécurité de ce compte d\'administration critique.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!mfaEnabled && (
                  <button type="button" style={{ ...btnGreenStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={startEnableMfa}>
                    {loading ? '…' : <><Smartphone size={16} /> Activer le MFA</>}
                  </button>
                )}
                {mfaEnabled && (
                  <>
                    <button type="button" style={{ ...btnGrayStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { setError(''); setFlow('regen') }}>
                      <RotateCw size={16} /> Régénérer les codes de récupération
                    </button>
                    <button type="button" style={{ ...btnRedStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { setError(''); setFlow('disable') }}>
                      <AlertTriangle size={16} /> Désactiver le MFA
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {flow === 'enable-qr' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, marginTop: 0, lineHeight: 1.6 }}>
                <strong>Étape 1 / 2</strong> — Scannez ce QR code avec votre application d&apos;authentification (Google Authenticator, Authy, etc.) ou entrez la clé manuellement.
              </p>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                {qrDataUri && <img src={qrDataUri} alt="QR Code MFA" style={{ width: 140, height: 140, borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', padding: 4 }} />}
              </div>
              <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Clé manuelle</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace', letterSpacing: 1.5 }}>{manualKey}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" style={btnGrayStyle} onClick={reset}>Annuler</button>
                <button type="button" style={btnGreenStyle} onClick={() => { setError(''); setFlow('enable-verify') }}>J&apos;ai scanné → Continuer</button>
              </div>
            </div>
          )}

          {flow === 'enable-verify' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, marginTop: 0, lineHeight: 1.6 }}>
                <strong>Étape 2 / 2</strong> — Entrez le code à 6 chiffres affiché dans votre application et confirmez avec votre mot de passe.
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabelStyle}>Code TOTP (6 chiffres) *</label>
                <input
                  style={{ ...inpStyle, textAlign: 'center', fontSize: 14, fontWeight: 900, letterSpacing: 4 }}
                  type="tel" maxLength={6} value={totpCode} placeholder="123456"
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
              <PasswordInput label="Votre mot de passe actuel *" value={password} show={showEnablePwd} onToggleShow={() => setShowEnablePwd(s => !s)} onChange={setPassword} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" style={{ ...btnGrayStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { setError(''); setFlow('enable-qr') }}>
                  <ArrowLeft size={15} /> Retour
                </button>
                <button type="button" style={{ ...btnGreenStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={handleEnableVerify}>
                  {loading ? '…' : <><CheckCircle2 size={16} /> Activer le MFA</>}
                </button>
              </div>
            </div>
          )}

          {flow === 'enable-codes' && (
            <RecoveryCodesResult
              title="Sauvegardez ces codes maintenant !"
              subtitle={<>Ces codes de récupération ne seront affichés <strong>qu&apos;une seule fois</strong>. Conservez-les dans un endroit sûr. Chaque code est à usage unique.</>}
              codes={recoveryCodes}
              finishLabel="J'ai sauvegardé mes codes → Terminer"
              onFinish={() => { reset(); onMfaChange() }}
            />
          )}

          {(flow === 'disable' || flow === 'regen') && (
            <div>
              {flow === 'disable' ? (
                <div style={{ padding: '12px 14px', background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, marginBottom: 16, fontSize: 14, color: 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} /> La désactivation du MFA affaiblit la sécurité de ce compte. Soyez certain de votre choix.
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, marginTop: 0, lineHeight: 1.7 }}>
                  La régénération invalide tous les codes de récupération existants. Confirmez votre identité.
                </p>
              )}
              <PasswordInput label="Mot de passe actuel *" value={disablePwd} show={showDisablePwd} onToggleShow={() => setShowDisablePwd(s => !s)} onChange={setDisablePwd} />
              <div style={{ marginBottom: 16 }}>
                <label style={fieldLabelStyle}>Code MFA actuel *</label>
                <input
                  style={{ ...inpStyle, textAlign: 'center', fontSize: 15, fontWeight: 900, letterSpacing: 4 }}
                  type="tel" maxLength={6} placeholder="123456" value={disableMfa} autoComplete="one-time-code"
                  onChange={e => setDisableMfa(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" style={btnGrayStyle} onClick={reset}>Annuler</button>
                {flow === 'disable' ? (
                  <button type="button" style={{ ...btnRedStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={() => handleDisableOrRegen('disable')}>
                    {loading ? '…' : <><AlertTriangle size={16} /> Confirmer la désactivation</>}
                  </button>
                ) : (
                  <button type="button" style={{ ...btnGreenStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={() => handleDisableOrRegen('regen')}>
                    {loading ? '…' : <><RotateCw size={16} /> Régénérer les codes</>}
                  </button>
                )}
              </div>
            </div>
          )}

          {flow === 'regen-codes' && (
            <RecoveryCodesResult
              title="Nouveaux codes — sauvegardez-les maintenant !"
              subtitle="Les anciens codes sont désormais invalides."
              codes={recoveryCodes}
              finishLabel="J'ai sauvegardé → Fermer"
              onFinish={reset}
            />
          )}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={20} />
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>Activité récente</span>
        </div>
        <div style={{ padding: '10px 12px' }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>
            Consultez l&apos;onglet <strong style={{ color: 'var(--text)' }}>Authentification</strong> pour voir toutes les connexions et événements de sécurité en temps réel.
          </p>
        </div>
      </div>
    </div>
  )
}
