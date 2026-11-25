'use client'
import { useState } from 'react'
import { CheckCircle2, Mail, ArrowLeft } from 'lucide-react'
import { initiatePasswordChange, changePassword } from '../../_api'
import { Overlay, ModalWrap, ModalHeader, ModalFooter, Field, FieldInput, BtnPrimary, BtnSecondary } from './MasterModalPrimitives'

interface ChangePasswordModalProps {
  mfaEnabled: boolean
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function ChangePasswordModal({ mfaEnabled, onClose, onToast }: ChangePasswordModalProps) {
  const [pwdStep, setPwdStep] = useState<1 | 2>(1)
  const [currentPwd, setCurrentPwd] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  const resetPwdState = () => {
    setPwdStep(1)
    setCurrentPwd('')
    setMfaCode('')
    setEmailOtp('')
    setNewPwd('')
    setConfirmPwd('')
    setPwdLoading(false)
  }

  const handleClose = () => {
    onClose()
    resetPwdState()
  }

  return (
    <Overlay onClose={handleClose}>
      <ModalWrap size="sm">
        <ModalHeader
          title="Changer le mot de passe"
          sub={pwdStep === 1 ? 'Étape 1 / 2 — Vérification d\'identité' : 'Étape 2 / 2 — Code email + nouveau mot de passe'}
          onClose={handleClose}
        />

        {/* ── Étape 1 : mot de passe actuel + MFA → déclenche l'envoi d'un OTP par email ── */}
        {pwdStep === 1 && (
          <>
            {/* Honeypot */}
            <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
            <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
            <Field label="Mot de passe actuel *">
              <FieldInput type="password" placeholder="••••••••••••" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} autoComplete="new-password" showToggle />
            </Field>
            {mfaEnabled && (
              <Field label="Code TOTP ou code de récupération *" hint="Requis car le MFA est actif sur ce compte">
                <FieldInput
                  type="text"
                  placeholder="123456  ou  ABCD-1234-EFGH-5678"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  style={{ textAlign: 'center', fontSize: 12, letterSpacing: 2 }}
                />
              </Field>
            )}
            <ModalFooter>
              <BtnSecondary onClick={handleClose}>Annuler</BtnSecondary>
              <BtnPrimary
                disabled={pwdLoading}
                onClick={async () => {
                  if (!currentPwd.trim()) { onToast('Le mot de passe actuel est requis.', 'error'); return }
                  if (mfaEnabled && !mfaCode.trim()) { onToast('Le code MFA est requis.', 'error'); return }
                  setPwdLoading(true)
                  try {
                    await initiatePasswordChange({ currentPassword: currentPwd, mfaCode: mfaCode || undefined })
                    onToast('Code de vérification envoyé par email.', 'info')
                    setPwdStep(2)
                  } catch (err: unknown) {
                    onToast(err instanceof Error ? err.message : 'Erreur de vérification', 'error')
                  } finally {
                    setPwdLoading(false)
                  }
                }}
              >
                {pwdLoading ? '...' : 'Continuer →'}
              </BtnPrimary>
            </ModalFooter>
          </>
        )}

        {/* ── Étape 2 : code OTP reçu par email + nouveau mot de passe ── */}
        {pwdStep === 2 && (
          <>
            <div style={{ padding: '8px 10px', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, marginBottom: 12, fontSize: 11, color: '#1e40af', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={16} style={{ flexShrink: 0 }} /> Un code de vérification a été envoyé à votre adresse email. Saisissez-le ci-dessous.
            </div>
            <Field label="Code de vérification email *" hint="Valable 15 minutes — vérifiez vos spams">
              <FieldInput
                type="text"
                placeholder="123456"
                value={emailOtp}
                onChange={e => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ textAlign: 'center', fontSize: 15, fontWeight: 900, letterSpacing: 4 }}
              />
            </Field>
            <Field label="Nouveau mot de passe *" hint="Minimum 12 caractères">
              <FieldInput type="password" placeholder="Minimum 12 caractères" value={newPwd} onChange={e => setNewPwd(e.target.value)} autoComplete="new-password" showToggle />
            </Field>
            <Field label="Confirmer le mot de passe *">
              <FieldInput type="password" placeholder="Répétez le nouveau mot de passe" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} autoComplete="new-password" showToggle />
            </Field>
            <ModalFooter>
              <BtnSecondary onClick={() => { setPwdStep(1); setEmailOtp('') }}><ArrowLeft size={15} /> Retour</BtnSecondary>
              <BtnPrimary
                disabled={pwdLoading}
                onClick={async () => {
                  if (!emailOtp.trim() || emailOtp.length !== 6) { onToast('Code de vérification à 6 chiffres requis.', 'error'); return }
                  if (newPwd.length < 12) { onToast('Minimum 12 caractères requis.', 'error'); return }
                  if (newPwd !== confirmPwd) { onToast('Les mots de passe ne correspondent pas.', 'error'); return }
                  setPwdLoading(true)
                  try {
                    await changePassword({ otp: emailOtp.trim(), newPassword: newPwd })
                    onToast('Mot de passe modifié avec succès.')
                    handleClose()
                  } catch (err: unknown) {
                    onToast(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe', 'error')
                  } finally {
                    setPwdLoading(false)
                  }
                }}
              >
                {pwdLoading ? '...' : <><CheckCircle2 size={17} /> Confirmer le changement</>}
              </BtnPrimary>
            </ModalFooter>
          </>
        )}
      </ModalWrap>
    </Overlay>
  )
}
