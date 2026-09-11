'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2, XCircle, Ban, Trash2, Mail, RotateCw, KeyRound, Smartphone,
  AlertTriangle, EyeOff, Eye, ArrowLeft, Download, Search, Shield, Zap, Info, Globe, Bot,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Badge from './Badge'
import type { AuditLogDto } from '../_types'
import type { EmailLogDto, AIActionAuditLogDto } from '../_api'
import { fetchLogs, fetchEmailLogs, fetchAIActionAuditLog, mfaSetup, mfaEnable, mfaDisable, mfaRegenCodes, resetUserMfa } from '../_api'

interface Props {
  logs: AuditLogDto[]
  loading: boolean
  onChangePwd: () => void
  mfaEnabled: boolean
}

type LogTab = 'auth' | 'actions' | 'emails' | 'security' | 'ai-security'

// ── Labels & badges pour le journal Sécurité IA ─────────────────────────────

const AI_OUTCOME_BADGE: Record<AIActionAuditLogDto['outcome'], 'event-success' | 'event-warning' | 'event-error'> = {
  SUCCES: 'event-success',
  REFUSE: 'event-error',
  ERREUR: 'event-warning',
}

const AI_OUTCOME_LABEL: Record<AIActionAuditLogDto['outcome'], string> = {
  SUCCES: 'Réussie',
  REFUSE: 'Refusée',
  ERREUR: 'Erreur',
}

// ── Labels & badges pour les événements auth ────────────────────────────────

const AUTH_LABELS: Record<string, string> = {
  'success:login_otp_sent':                       'Code OTP envoyé',
  'success:otp_verified':                         'Email vérifié',
  'success:mfa_verified':                         'MFA validé',
  'success:mfa_login_totp':                       'Connexion MFA (TOTP)',
  'success:mfa_login_recovery_code':              'Connexion MFA (code récup.)',
  'success:recovery_codes_regenerated':           'Codes de récupération regénérés',
  'success:password_changed_from_security_dashboard': 'Mot de passe modifié',
  'success:logout':                               'Déconnexion',
  'success:otp_resend':                           'Code OTP renvoyé',
  'success:sensitive_auth_passed_no_mfa':         'Vérif. identité réussie (sans MFA)',
  'success:sensitive_auth_passed_totp':           'Vérif. identité réussie (TOTP)',
  'success:sensitive_auth_passed_recovery_code':  'Vérif. identité réussie (code récup.)',
  'failure:login_failed':                         'Échec de connexion',
  'failure:login_invalid_password':               'Mot de passe invalide',
  'failure:otp_verification_failed':              'Échec vérification OTP',
  'failure:mfa_verification_failed':              'Échec vérification MFA',
  'failure:sensitive_auth_invalid_password':      'Vérif. identité échouée — mot de passe',
  'failure:sensitive_auth_invalid_mfa_code':      'Vérif. identité échouée — code MFA',
  'failure:sensitive_auth_missing_factors':       'Vérif. identité — champ manquant',
}

const AUTH_BADGE: Record<string, 'event-success' | 'event-warning' | 'event-error' | 'event-info'> = {
  'success:login_otp_sent':                   'event-info',
  'success:otp_verified':                     'event-success',
  'success:mfa_verified':                     'event-success',
  'success:mfa_login_totp':                   'event-success',
  'success:mfa_login_recovery_code':          'event-warning',
  'success:recovery_codes_regenerated':       'event-success',
  'success:password_changed_from_security_dashboard': 'event-success',
  'success:logout':                           'event-info',
  'success:otp_resend':                       'event-info',
  'success:sensitive_auth_passed_no_mfa':     'event-success',
  'success:sensitive_auth_passed_totp':       'event-success',
  'success:sensitive_auth_passed_recovery_code': 'event-warning',
  'failure:login_failed':                     'event-error',
  'failure:login_invalid_password':           'event-error',
  'failure:otp_verification_failed':          'event-error',
  'failure:mfa_verification_failed':          'event-error',
  'failure:sensitive_auth_invalid_password':  'event-error',
  'failure:sensitive_auth_invalid_mfa_code':  'event-error',
  'failure:sensitive_auth_missing_factors':   'event-error',
}

// ── Labels & badges pour les actions métier ─────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  'action:school_approved':      'École approuvée',
  'action:school_rejected':      'École rejetée',
  'action:school_suspended':     'École suspendue',
  'action:school_reactivated':   'École réactivée',
  'action:school_deleted':       'École supprimée',
  'action:school_invite_sent':   'Invitation envoyée',
  'action:school_invite_resent': 'Invitation renvoyée',
  'action:school_reexamined':    'Demande réexaminée',
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  'action:school_approved':      CheckCircle2,
  'action:school_rejected':      XCircle,
  'action:school_suspended':     Ban,
  'action:school_reactivated':   CheckCircle2,
  'action:school_deleted':       Trash2,
  'action:school_invite_sent':   Mail,
  'action:school_invite_resent': Mail,
  'action:school_reexamined':    RotateCw,
}

const ACTION_BADGE: Record<string, 'event-success' | 'event-warning' | 'event-error' | 'event-info'> = {
  'action:school_approved':      'event-success',
  'action:school_rejected':      'event-error',
  'action:school_suspended':     'event-warning',
  'action:school_reactivated':   'event-success',
  'action:school_deleted':       'event-error',
  'action:school_invite_sent':   'event-info',
  'action:school_invite_resent': 'event-info',
  'action:school_reexamined':    'event-info',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 8px', fontSize: 11, color: '#6b5c45', verticalAlign: 'middle',
}

// ── Composant SecurityTab (MFA + mot de passe) ───────────────────────────────

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

function SecurityTab({ mfaEnabled, onChangePwd, onMfaChange }: {
  mfaEnabled: boolean
  onChangePwd: () => void
  onMfaChange: () => void
}) {
  const [flow, setFlow] = useState<MfaFlow>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Enable MFA state
  const [qrDataUri, setQrDataUri] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])

  // Disable / regen state
  const [disablePwd, setDisablePwd] = useState('')
  const [disableMfa, setDisableMfa] = useState('')

  // Show/hide password toggles
  const [showEnablePwd, setShowEnablePwd] = useState(false)
  const [showDisablePwd, setShowDisablePwd] = useState(false)

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', background: '#f0ebe3', border: '1px solid #d4c8b8',
    borderRadius: 6, color: '#1a1209', fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
    outline: 'none', boxSizing: 'border-box',
  }
  const btnGreen: React.CSSProperties = {
    padding: '7px 14px', background: 'linear-gradient(135deg,#059669,#047857)', color: 'white',
    border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
    fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(5,150,105,0.18)',
  }
  const btnGray: React.CSSProperties = {
    padding: '7px 12px', background: 'white', color: '#6b5c45', border: '1px solid #d4c8b8',
    borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  }
  const btnRed: React.CSSProperties = {
    padding: '7px 12px', background: '#fef2f2', color: '#dc2626',
    border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, fontSize: 11, fontWeight: 800,
    cursor: 'pointer', fontFamily: 'inherit',
  }

  const reset = () => {
    setFlow(null); setError(''); setLoading(false)
    setQrDataUri(''); setManualKey(''); setTotpCode(''); setPassword('')
    setDisablePwd(''); setDisableMfa(''); setRecoveryCodes([])
  }

  async function startEnableMfa() {
    setLoading(true); setError('')
    try {
      const data = await mfaSetup()
      setQrDataUri(data.qrDataUri)
      setManualKey(data.manualKey)
      setFlow('enable-qr')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleEnableVerify() {
    if (!totpCode.trim() || totpCode.trim().length !== 6) { setError('Entrez le code à 6 chiffres de votre application.'); return }
    if (!password.trim()) { setError('Le mot de passe est requis.'); return }
    setLoading(true); setError('')
    try {
      const data = await mfaEnable(totpCode.trim(), password.trim())
      setRecoveryCodes(data.recoveryCodes)
      setFlow('enable-codes')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleDisable() {
    if (!disablePwd.trim()) { setError('Mot de passe requis.'); return }
    if (!disableMfa.trim()) { setError('Code MFA requis.'); return }
    setLoading(true); setError('')
    try {
      await mfaDisable(disablePwd.trim(), disableMfa.trim())
      reset()
      onMfaChange()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleRegenCodes() {
    if (!disablePwd.trim()) { setError('Mot de passe requis.'); return }
    if (!disableMfa.trim()) { setError('Code MFA requis.'); return }
    setLoading(true); setError('')
    try {
      const data = await mfaRegenCodes(disablePwd.trim(), disableMfa.trim())
      setRecoveryCodes(data.recoveryCodes)
      setFlow('regen-codes')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const fieldLabel: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#6b5c45', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }

  return (
    <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Mot de passe ── */}
      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 6 }}>
          <KeyRound size={15} />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#1a1209' }}>Mot de passe</span>
        </div>
        <div style={{ padding: '12px' }}>
          <p style={{ fontSize: 11, color: '#6b5c45', lineHeight: 1.6, marginBottom: 10, marginTop: 0 }}>
            Modifiez votre mot de passe master. Vous devrez saisir votre mot de passe actuel{mfaEnabled ? ' et votre code MFA' : ''}.
          </p>
          <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={onChangePwd}><KeyRound size={16} /> Changer le mot de passe</button>
        </div>
      </div>

      {/* ── MFA ── */}
      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Smartphone size={15} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1a1209' }}>Authentification à deux facteurs (MFA)</span>
          </div>
          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 800, background: mfaEnabled ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)', color: mfaEnabled ? '#059669' : '#dc2626', border: `1px solid ${mfaEnabled ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.2)'}`, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {mfaEnabled ? <><CheckCircle2 size={13} /> Actif</> : <><XCircle size={13} /> Inactif</>}
          </span>
        </div>

        <div style={{ padding: '12px' }}>
          {error && (
            <div style={{ padding: '7px 10px', background: '#fef2f2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={13} style={{ flexShrink: 0 }} /> {error}</div>
          )}

          {/* ── Pas de flow actif ── */}
          {!flow && (
            <>
              <p style={{ fontSize: 13, color: '#6b5c45', lineHeight: 1.7, marginBottom: 16, marginTop: 0 }}>
                {mfaEnabled
                  ? 'Le MFA est actif. Toutes les actions sensibles nécessitent votre code TOTP (Google Authenticator, Authy…).'
                  : 'Le MFA n\'est pas activé. Activez-le pour renforcer la sécurité de ce compte d\'administration critique.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!mfaEnabled && (
                  <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={startEnableMfa}>
                    {loading ? '…' : <><Smartphone size={16} /> Activer le MFA</>}
                  </button>
                )}
                {mfaEnabled && (
                  <>
                    <button style={{ ...btnGray, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { setError(''); setFlow('regen') }}><RotateCw size={16} /> Régénérer les codes de récupération</button>
                    <button style={{ ...btnRed, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { setError(''); setFlow('disable') }}><AlertTriangle size={16} /> Désactiver le MFA</button>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── ENABLE : QR code ── */}
          {flow === 'enable-qr' && (
            <div>
              <p style={{ fontSize: 13, color: '#6b5c45', marginBottom: 16, marginTop: 0, lineHeight: 1.7 }}>
                <strong>Étape 1 / 2</strong> — Scannez ce QR code avec votre application d&apos;authentification (Google Authenticator, Authy, etc.) ou entrez la clé manuellement.
              </p>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                {qrDataUri && <img src={qrDataUri} alt="QR Code MFA" style={{ width: 140, height: 140, borderRadius: 8, border: '1px solid #e8e0d4' }} />}
              </div>
              <div style={{ background: '#f0ebe3', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', marginBottom: 6 }}>Clé manuelle</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1209', wordBreak: 'break-all', fontFamily: 'monospace', letterSpacing: 1.5 }}>{manualKey}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={btnGray} onClick={reset}>Annuler</button>
                <button style={btnGreen} onClick={() => { setError(''); setFlow('enable-verify') }}>J&apos;ai scanné → Continuer</button>
              </div>
            </div>
          )}

          {/* ── ENABLE : Vérification ── */}
          {flow === 'enable-verify' && (
            <div>
              <p style={{ fontSize: 13, color: '#6b5c45', marginBottom: 16, marginTop: 0, lineHeight: 1.7 }}>
                <strong>Étape 2 / 2</strong> — Entrez le code à 6 chiffres affiché dans votre application et confirmez avec votre mot de passe.
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>Code TOTP (6 chiffres) *</label>
                <input style={{ ...inp, textAlign: 'center', fontSize: 14, fontWeight: 900, letterSpacing: 4 }}
                  type="tel" maxLength={6} value={totpCode} placeholder="123456"
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={fieldLabel}>Votre mot de passe actuel *</label>
                <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 40 }} type={showEnablePwd ? 'text' : 'password'} placeholder="••••••••••••" value={password}
                    autoComplete="new-password" onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowEnablePwd(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a89478', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                    {showEnablePwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...btnGray, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { setError(''); setFlow('enable-qr') }}><ArrowLeft size={15} /> Retour</button>
                <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={handleEnableVerify}>
                  {loading ? '…' : <><CheckCircle2 size={16} /> Activer le MFA</>}
                </button>
              </div>
            </div>
          )}

          {/* ── ENABLE : Codes de récupération (affichage unique) ── */}
          {flow === 'enable-codes' && (
            <div>
              <div style={{ padding: '14px 16px', background: '#fef3c7', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, marginBottom: 16 }}>
                <strong style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={16} /> Sauvegardez ces codes maintenant !</strong>
                <p style={{ color: '#92400e', fontSize: 11, marginTop: 4, marginBottom: 0, lineHeight: 1.5 }}>
                  Ces codes de récupération ne seront affichés <strong>qu&apos;une seule fois</strong>. Conservez-les dans un endroit sûr. Chaque code est à usage unique.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                {recoveryCodes.map((code, i) => (
                  <div key={i} style={{ background: '#f0ebe3', borderRadius: 6, padding: '7px 10px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1a1209', textAlign: 'center', letterSpacing: 1 }}>
                    {code}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button style={{ ...btnGray, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => downloadRecoveryCodes(recoveryCodes)}>
                  <Download size={16} /> Télécharger (.txt)
                </button>
                <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { reset(); onMfaChange() }}><CheckCircle2 size={16} /> J&apos;ai sauvegardé mes codes → Terminer</button>
              </div>
            </div>
          )}

          {/* ── DISABLE MFA ── */}
          {flow === 'disable' && (
            <div>
              <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, marginBottom: 16, fontSize: 14, color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} /> La désactivation du MFA affaiblit la sécurité de ce compte. Soyez certain de votre choix.
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>Mot de passe actuel *</label>
                <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 40 }} type={showDisablePwd ? 'text' : 'password'} placeholder="••••••••••••" value={disablePwd}
                    autoComplete="new-password" onChange={e => setDisablePwd(e.target.value)} />
                  <button type="button" onClick={() => setShowDisablePwd(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a89478', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                    {showDisablePwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={fieldLabel}>Code MFA actuel *</label>
                <input style={{ ...inp, textAlign: 'center', fontSize: 15, fontWeight: 900, letterSpacing: 4 }}
                  type="tel" maxLength={6} placeholder="123456" value={disableMfa} autoComplete="one-time-code"
                  onChange={e => setDisableMfa(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={btnGray} onClick={reset}>Annuler</button>
                <button style={{ ...btnRed, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={handleDisable}>
                  {loading ? '…' : <><AlertTriangle size={16} /> Confirmer la désactivation</>}
                </button>
              </div>
            </div>
          )}

          {/* ── REGEN codes : saisie ── */}
          {flow === 'regen' && (
            <div>
              <p style={{ fontSize: 13, color: '#6b5c45', marginBottom: 16, marginTop: 0, lineHeight: 1.7 }}>
                La régénération invalide tous les codes de récupération existants. Confirmez votre identité.
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>Mot de passe actuel *</label>
                <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 40 }} type={showDisablePwd ? 'text' : 'password'} placeholder="••••••••••••" value={disablePwd}
                    autoComplete="new-password" onChange={e => setDisablePwd(e.target.value)} />
                  <button type="button" onClick={() => setShowDisablePwd(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a89478', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                    {showDisablePwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={fieldLabel}>Code MFA actuel *</label>
                <input style={{ ...inp, textAlign: 'center', fontSize: 15, fontWeight: 900, letterSpacing: 4 }}
                  type="tel" maxLength={6} placeholder="123456" value={disableMfa} autoComplete="one-time-code"
                  onChange={e => setDisableMfa(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={btnGray} onClick={reset}>Annuler</button>
                <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={handleRegenCodes}>
                  {loading ? '…' : <><RotateCw size={16} /> Régénérer les codes</>}
                </button>
              </div>
            </div>
          )}

          {/* ── REGEN codes : résultat ── */}
          {flow === 'regen-codes' && (
            <div>
              <div style={{ padding: '14px 16px', background: '#fef3c7', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, marginBottom: 16 }}>
                <strong style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={16} /> Nouveaux codes — sauvegardez-les maintenant !</strong>
                <p style={{ color: '#92400e', fontSize: 14, marginTop: 6, marginBottom: 0 }}>Les anciens codes sont désormais invalides.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                {recoveryCodes.map((code, i) => (
                  <div key={i} style={{ background: '#f0ebe3', borderRadius: 6, padding: '7px 10px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1a1209', textAlign: 'center', letterSpacing: 1 }}>
                    {code}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button style={{ ...btnGray, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => downloadRecoveryCodes(recoveryCodes)}>
                  <Download size={16} /> Télécharger (.txt)
                </button>
                <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={reset}><CheckCircle2 size={16} /> J&apos;ai sauvegardé → Fermer</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Activité récente ── */}
      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={20} />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#1a1209' }}>Activité récente</span>
        </div>
        <div style={{ padding: '10px 12px' }}>
          <p style={{ fontSize: 11, color: '#a89478', margin: 0 }}>
            Consultez l&apos;onglet <strong style={{ color: '#1a1209' }}>Authentification</strong> pour voir toutes les connexions et événements de sécurité en temps réel.
          </p>
        </div>
      </div>

    </div>
  )
}

// ── Débloque un compte Admin/Staff/Teacher ayant perdu son authenticator ET ses codes de
// récupération — geste sensible, gardé par mot de passe + MFA Master (requireMasterSensitiveAuth).
function AccountMfaResetPanel() {
  const [subdomain, setSubdomain] = useState('')
  const [targetEmail, setTargetEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8',
    borderRadius: 10, color: '#1a1209', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
    outline: 'none', boxSizing: 'border-box',
  }
  const btnRed: React.CSSProperties = {
    padding: '11px 22px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 10,
    fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  }

  const submit = async () => {
    setError(''); setDone(false)
    if (!subdomain.trim() || !targetEmail.trim() || !password.trim()) {
      setError('Sous-domaine, email du compte et votre mot de passe sont requis'); return
    }
    setLoading(true)
    try {
      await resetUserMfa(subdomain.trim().toLowerCase(), targetEmail.trim().toLowerCase(), password, totpCode)
      setDone(true)
      setPassword(''); setTotpCode('')
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la réinitialisation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #d4c8b8', overflow: 'hidden', marginTop: 24 }}>
      <div style={{ padding: '16px 22px', borderBottom: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 10 }}>
        <KeyRound size={20} color="#dc2626" />
        <span style={{ fontSize: 12, fontWeight: 800, color: '#1a1209' }}>Débloquer le MFA d&apos;un compte</span>
      </div>
      <div style={{ padding: '12px' }}>
        <p style={{ fontSize: 11, color: '#6b5c45', marginTop: 0, marginBottom: 10, lineHeight: 1.5 }}>
          À utiliser uniquement si un Admin/Staff/Enseignant a perdu l&apos;accès à son application d&apos;authentification
          ET à ses codes de récupération. Le compte devra reconfigurer entièrement son MFA (nouveau QR) à sa prochaine connexion.
        </p>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: '#fef2f2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 10 }}>
            <AlertTriangle size={15} /> {error}
          </div>
        )}
        {done && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: '#f0fdf4', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 6, fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 10 }}>
            <CheckCircle2 size={15} /> MFA réinitialisé — le compte devra le reconfigurer à sa prochaine connexion.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <input placeholder="Sous-domaine de l'école" value={subdomain} onChange={e => setSubdomain(e.target.value)} style={inp} />
          <input placeholder="Email du compte bloqué" value={targetEmail} onChange={e => setTargetEmail(e.target.value)} style={inp} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <input type="password" placeholder="Votre mot de passe Master" value={password} onChange={e => setPassword(e.target.value)} style={inp} />
          <input placeholder="Votre code MFA (si activé)" value={totpCode} onChange={e => setTotpCode(e.target.value)} style={inp} />
        </div>
        <button onClick={submit} disabled={loading} style={{ ...btnRed, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Réinitialisation…' : 'Réinitialiser le MFA de ce compte'}
        </button>
      </div>
    </div>
  )
}

function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: '16px 8px', textAlign: 'center', color: '#a89478', fontSize: 11 }}>
        {msg}
      </td>
    </tr>
  )
}

export default function SectionLogs({ logs: initialLogs, loading: initialLoading, onChangePwd, mfaEnabled }: Props) {
  const [tab, setTab] = useState<LogTab>('auth')

  // Logs actions
  const [actionLogs, setActionLogs] = useState<AuditLogDto[]>([])
  const [actionLoading, setActionLoading] = useState(false)

  // Email logs
  const [emailLogs, setEmailLogs] = useState<EmailLogDto[]>([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSearch, setEmailSearch] = useState('')

  // Sécurité IA — journal transversal des actions du copilot / équivalents UI
  const [aiLogs, setAiLogs] = useState<AIActionAuditLogDto[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiOutcomeFilter, setAiOutcomeFilter] = useState<'' | AIActionAuditLogDto['outcome']>('REFUSE')
  const [aiOriginFilter, setAiOriginFilter] = useState<'' | AIActionAuditLogDto['origin']>('')

  const loadAiLogs = useCallback(async (outcome: '' | AIActionAuditLogDto['outcome'], origin: '' | AIActionAuditLogDto['origin']) => {
    setAiLoading(true)
    try {
      const res = await fetchAIActionAuditLog({ outcome: outcome || undefined, origin: origin || undefined, limit: 100 })
      setAiLogs(res.data)
    } catch { /* silencieux */ }
    finally { setAiLoading(false) }
  }, [])

  const loadActionLogs = useCallback(async () => {
    setActionLoading(true)
    try {
      const res = await fetchLogs({ type: 'actions', limit: 100 })
      setActionLogs(res.data)
    } catch { /* silencieux */ }
    finally { setActionLoading(false) }
  }, [])

  const loadEmailLogs = useCallback(async (search?: string) => {
    setEmailLoading(true)
    try {
      const res = await fetchEmailLogs({ search: search?.trim() || undefined, limit: 100 })
      setEmailLogs(res.data)
    } catch { /* silencieux */ }
    finally { setEmailLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'actions' && actionLogs.length === 0) loadActionLogs()
    if (tab === 'emails' && emailLogs.length === 0) loadEmailLogs()
    if (tab === 'ai-security' && aiLogs.length === 0) loadAiLogs(aiOutcomeFilter, aiOriginFilter)
  }, [tab, actionLogs.length, emailLogs.length, aiLogs.length, loadActionLogs, loadEmailLogs, loadAiLogs, aiOutcomeFilter, aiOriginFilter])

  // Auth logs viennent du parent (déjà chargés)
  const authLogs = initialLogs.filter(l => !l.action.startsWith('action:'))

  return (
    <div style={{ padding: '12px 16px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: '#1a1209' }}>
            Logs &amp; Sécurité
          </div>
          <div style={{ fontSize: 12, color: '#a89478', marginTop: 2 }}>Audit complet des actions et connexions</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#f0ebe3', padding: 3, borderRadius: 8, marginBottom: 12, width: 'fit-content' }}>
        {([
          { id: 'auth'        as const, label: 'Authentification', icon: KeyRound },
          { id: 'actions'     as const, label: 'Actions admin', icon: Zap },
          { id: 'emails'      as const, label: 'Logs emails', icon: Mail },
          { id: 'ai-security' as const, label: 'Sécurité IA', icon: Bot },
          { id: 'security'    as const, label: 'Sécurité du compte', icon: Shield },
        ] as { id: LogTab; label: string; icon: LucideIcon }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: tab === t.id ? 'white' : 'transparent',
            color: tab === t.id ? '#1a1209' : '#a89478',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.12s',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}><t.icon size={13} />{t.label}</button>
        ))}
      </div>

      {/* ── ONGLET AUTHENTIFICATION ─────────────────────────────────────────── */}
      {tab === 'auth' && (
        <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8e0d4', fontSize: 11, color: '#a89478', fontWeight: 600 }}>
            Connexions, OTP, MFA — toutes les tentatives d&apos;authentification du compte master
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr>
                  {['Date / Heure', 'Événement', 'Compte', 'IP'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialLoading
                  ? <EmptyRow cols={4} msg="Chargement..." />
                  : authLogs.length === 0
                    ? <EmptyRow cols={4} msg="Aucun log d'authentification" />
                    : authLogs.map((log, i) => (
                      <tr key={log.id} style={{ borderBottom: i < authLogs.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                        <td style={tdStyle}>{new Date(log.createdAt).toLocaleString('fr-CM')}</td>
                        <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                          <Badge type={AUTH_BADGE[log.action] ?? 'event-info'}>
                            {AUTH_LABELS[log.action] ?? log.action}
                          </Badge>
                        </td>
                        <td style={tdStyle}>{log.masterUser?.email ?? log.description ?? '—'}</td>
                        <td style={tdStyle}>{log.ipAddress ?? '—'}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ONGLET ACTIONS ADMIN ────────────────────────────────────────────── */}
      {tab === 'actions' && (
        <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8e0d4', fontSize: 11, color: '#a89478', fontWeight: 600 }}>
            Approbations, rejets, suspensions, invitations — toutes les actions décisives sur les écoles
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr>
                  {['Date / Heure', 'Action', 'Détail', 'IP'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actionLoading
                  ? <EmptyRow cols={4} msg="Chargement..." />
                  : actionLogs.length === 0
                    ? <EmptyRow cols={4} msg="Aucune action enregistrée" />
                    : actionLogs.map((log, i) => (
                      <tr key={log.id} style={{ borderBottom: i < actionLogs.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                        <td style={tdStyle}>{new Date(log.createdAt).toLocaleString('fr-CM')}</td>
                        <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                          <Badge type={ACTION_BADGE[log.action] ?? 'event-info'}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              {ACTION_ICONS[log.action] && (() => { const Icon = ACTION_ICONS[log.action]; return <Icon size={13} /> })()}
                              {ACTION_LABELS[log.action] ?? log.action.replace('action:', '')}
                            </span>
                          </Badge>
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 320, wordBreak: 'break-word' }}>{log.description ?? '—'}</td>
                        <td style={tdStyle}>{log.ipAddress ?? '—'}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ONGLET LOGS EMAILS ──────────────────────────────────────────────── */}
      {tab === 'emails' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Barre de recherche */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #e8e0d4', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
              <Search size={13} color="#a89478" />
              <input
                type="text"
                value={emailSearch}
                onChange={e => setEmailSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadEmailLogs(emailSearch)}
                placeholder="Rechercher par email ou sujet..."
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: '#1a1209', fontFamily: 'inherit', fontWeight: 600, width: '100%' }}
              />
            </div>
            <button onClick={() => loadEmailLogs(emailSearch)}
              style={{ padding: '7px 12px', background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Rechercher
            </button>
          </div>

          <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8e0d4', fontSize: 11, color: '#a89478', fontWeight: 600 }}>
              Emails envoyés à travers toutes les écoles (OTP, bulletins, paiements, etc.)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    {['Date', 'Destinataire', 'Sujet', 'École', 'Statut', 'Provider'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {emailLoading
                    ? <EmptyRow cols={6} msg="Chargement..." />
                    : emailLogs.length === 0
                      ? <EmptyRow cols={6} msg="Aucun email enregistré. Les emails des écoles actives apparaissent ici." />
                      : emailLogs.map((log, i) => (
                        <tr key={log.id} style={{ borderBottom: i < emailLogs.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString('fr-CM')}</td>
                          <td style={tdStyle}>{log.to}</td>
                          <td style={{ ...tdStyle, maxWidth: 240, wordBreak: 'break-word' }}>{log.subject}</td>
                          <td style={tdStyle}>{log.school?.name ?? '—'}</td>
                          <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                            <Badge type={log.status === 'sent' ? 'event-success' : 'event-error'}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                {log.status === 'sent' ? <><CheckCircle2 size={13} /> Envoyé</> : <><XCircle size={13} /> Échoué</>}
                              </span>
                            </Badge>
                          </td>
                          <td style={{ ...tdStyle, color: '#a89478', fontSize: 13 }}>{log.provider ?? '—'}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>

          {/* Note : master admin emails (invitations, approbations) loggés dans Actions admin */}
          <div style={{ padding: '8px 10px', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, fontSize: 11, color: '#1e40af', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} style={{ flexShrink: 0 }} /> Les emails d&apos;invitation et d&apos;approbation envoyés par le master admin sont tracés dans l&apos;onglet <strong>Actions admin</strong>.
          </div>
        </div>
      )}
      {/* ── ONGLET SÉCURITÉ IA ──────────────────────────────────────────────── */}
      {tab === 'ai-security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '8px 10px', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, fontSize: 11, color: '#1e40af', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} style={{ flexShrink: 0 }} /> Toutes écoles confondues. Concentré par défaut sur les tentatives <strong>refusées</strong> — le détail métier de chaque école reste dans son propre journal (« Journal d&apos;établissement », côté admin).
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={aiOutcomeFilter} onChange={e => { const v = e.target.value as typeof aiOutcomeFilter; setAiOutcomeFilter(v); loadAiLogs(v, aiOriginFilter) }}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e8e0d4', fontSize: 11, fontWeight: 700, color: '#1a1209', fontFamily: 'inherit', background: 'white' }}>
              <option value="">Tous les résultats</option>
              <option value="REFUSE">Refusées</option>
              <option value="ERREUR">Erreurs</option>
              <option value="SUCCES">Réussies</option>
            </select>
            <select value={aiOriginFilter} onChange={e => { const v = e.target.value as typeof aiOriginFilter; setAiOriginFilter(v); loadAiLogs(aiOutcomeFilter, v) }}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e8e0d4', fontSize: 11, fontWeight: 700, color: '#1a1209', fontFamily: 'inherit', background: 'white' }}>
              <option value="">Toute origine</option>
              <option value="AI_ASSISTANT">Copilot IA</option>
              <option value="UI_DIRECT">Interface classique</option>
            </select>
          </div>

          <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8e0d4', fontSize: 11, color: '#a89478', fontWeight: 600 }}>
              Actions sensibles exécutées via le copilot IA ou leur équivalent en interface classique
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>
                    {['Date / Heure', 'Action', 'Origine', 'Résultat', 'Rôle', 'École', 'Motif'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aiLoading
                    ? <EmptyRow cols={7} msg="Chargement..." />
                    : aiLogs.length === 0
                      ? <EmptyRow cols={7} msg="Aucune entrée pour ce filtre" />
                      : aiLogs.map((log, i) => (
                        <tr key={log.id} style={{ borderBottom: i < aiLogs.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString('fr-CM')}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209' }}>{log.actionName}</td>
                          <td style={tdStyle}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              {log.origin === 'AI_ASSISTANT' ? <Bot size={14} /> : <Zap size={14} />}
                              {log.origin === 'AI_ASSISTANT' ? 'Copilot IA' : 'Interface classique'}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                            <Badge type={AI_OUTCOME_BADGE[log.outcome]}>{AI_OUTCOME_LABEL[log.outcome]}</Badge>
                          </td>
                          <td style={tdStyle}>{log.actorRole}</td>
                          <td style={tdStyle}>{log.schoolId ?? '—'}</td>
                          <td style={{ ...tdStyle, maxWidth: 280, wordBreak: 'break-word', color: '#a89478', fontSize: 13 }}>{log.refusalReason ?? '—'}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ONGLET SÉCURITÉ DU COMPTE ───────────────────────────────────────── */}
      {tab === 'security' && (
        <>
          <SecurityTab
            mfaEnabled={mfaEnabled}
            onChangePwd={onChangePwd}
            onMfaChange={() => {
              // Rafraîchit le statut MFA dans le parent via re-fetch
              window.location.reload()
            }}
          />
          <AccountMfaResetPanel />
        </>
      )}

    </div>
  )
}
