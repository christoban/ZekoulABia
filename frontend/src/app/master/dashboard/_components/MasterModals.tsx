'use client'
import { useState, useRef, useEffect } from 'react'
import {
  X, EyeOff, Eye, Shield, AlertTriangle, CheckCircle2, XCircle, Ban, Siren,
  Trash2, Mail, ArrowLeft,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ModalId, ConfirmActionTarget } from '../_types'
import { inviteSchool, suspendSchool, rejectSchool, deleteSchool, changeSchoolPlan, approveSchool, fetchMasterMfaStatus, initiatePasswordChange, changePassword } from '../_api'

interface Props {
  open: ModalId
  schoolId: string | null
  suspendTarget: { id: string; name: string; subdomain: string } | null
  deleteTarget: { id: string; name: string } | null
  confirmActionTarget: ConfirmActionTarget | null
  mfaEnabled: boolean
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onActionDone: () => void
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
      {children}
    </div>
  )
}

function ModalWrap({ children, size = 'md' }: { children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const maxW = size === 'sm' ? 420 : size === 'lg' ? 640 : 460
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: 20,
      maxWidth: maxW, width: '92%', maxHeight: '85vh', overflowY: 'auto',
      position: 'relative', animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both'
    }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, sub, onClose, danger, icon: Icon }: { title: string; sub?: string; onClose: () => void; danger?: boolean; icon?: LucideIcon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 15, fontWeight: 700, color: danger ? '#dc2626' : '#1a1209', display: 'flex', alignItems: 'center', gap: 6 }}>
          {Icon && <Icon size={15} />}{title}
        </div>
        {sub && <div style={{ fontSize: 11, color: '#6b5c45', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #d4c8b8', background: 'none', cursor: 'pointer', color: '#a89478', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={13} /></button>
    </div>
  )
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18, paddingTop: 14, borderTop: '1px solid #e8e0d4' }}>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 10, fontWeight: 800, color: '#6b5c45', marginBottom: 6, display: 'block', letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 10, color: '#a89478', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function FieldInput({ placeholder, type = 'text', value, onChange, style, autoComplete = 'off', showToggle }: { placeholder?: string; type?: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; style?: React.CSSProperties; autoComplete?: string; showToggle?: boolean }) {
  const [show, setShow] = useState(false)
  const base: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#f0ebe3', border: '1px solid #d4c8b8', borderRadius: 8, color: '#1a1209', fontSize: 11, fontFamily: 'inherit', fontWeight: 600, outline: 'none', ...style }
  if (showToggle && type === 'password') {
    return (
      <div style={{ position: 'relative' }}>
        <input type={show ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={onChange} autoComplete={autoComplete}
          style={{ ...base, paddingRight: 40 }} />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a89478', cursor: 'pointer', padding: 3, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    )
  }
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange} autoComplete={autoComplete}
      style={base} />
  )
}

function BtnPrimary({ onClick, children, disabled, type = 'button' }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ padding: '9px 16px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: disabled ? '#6b7280' : 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: disabled ? 'none' : '0 2px 8px rgba(5,150,105,0.18)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

function BtnSecondary({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

function SchoolSummary({ initials: init, name, meta, danger }: { initials: string; name: string; meta: string; danger?: boolean }) {
  return (
    <div style={{ background: '#f0ebe3', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: danger ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#059669,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
        {init}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1209' }}>{name}</div>
        <div style={{ fontSize: 11, color: '#a89478', marginTop: 1 }}>{meta}</div>
      </div>
    </div>
  )
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fef3c7', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, padding: '10px 12px', fontSize: 11, color: '#92400e', fontWeight: 600, lineHeight: 1.6, marginBottom: 16, display: 'flex', gap: 8 }}>
      {children}
    </div>
  )
}

const PLAN_MAP: Record<string, string> = { deco: 'DISCOVERY', std: 'STANDARD', prem: 'PREMIUM' }

// ── Champs d'authentification sensible réutilisables ─────────────────────────
function SensitiveAuthFields({ mfaEnabled, password, onPassword, mfaCode, onMfaCode }: {
  mfaEnabled: boolean
  password: string
  onPassword: (v: string) => void
  mfaCode: string
  onMfaCode: (v: string) => void
}) {
  return (
    <div style={{ background: '#fef3c7', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, padding: '12px 14px', marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Shield size={13} /> Vérification d&apos;identité requise
      </div>
      {/* Honeypot — absorbe l'autofill Chrome/Firefox avant les vrais champs */}
      <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
      <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
      <Field label="Votre mot de passe master *">
        <FieldInput type="password" placeholder="••••••••••••" value={password} onChange={e => onPassword(e.target.value)} autoComplete="new-password" showToggle />
      </Field>
      {mfaEnabled && (
        <Field label="Code TOTP ou code de récupération *" hint="Requis car le MFA est actif">
          <FieldInput type="text" placeholder="123456" value={mfaCode} onChange={e => onMfaCode(e.target.value)}
            style={{ textAlign: 'center', fontSize: 12, fontWeight: 900, letterSpacing: 3 }} />
        </Field>
      )}
    </div>
  )
}

export default function MasterModals({ open, schoolId, suspendTarget, deleteTarget, confirmActionTarget, mfaEnabled, onClose, onToast, onActionDone }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<'deco' | 'std' | 'prem'>('std')
  const [suspendReason, setSuspendReason] = useState('')
  const [deleteInput, setDeleteInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [rejectFocused, setRejectFocused] = useState(false)
  const rejectRef = useRef<HTMLTextAreaElement>(null)

  // État d'authentification sensible — partagé entre tous les modals
  const [authPwd, setAuthPwd] = useState('')
  const [authMfa, setAuthMfa] = useState('')
  const resetAuth = () => { setAuthPwd(''); setAuthMfa('') }
  const buildAuth = () => ({
    password: authPwd.trim(),
    ...(mfaEnabled && authMfa.trim() ? { code: authMfa.trim() } : {}),
  })
  const validateAuth = (): string | null => {
    if (!authPwd.trim()) return 'Le mot de passe master est requis.'
    if (mfaEnabled && !authMfa.trim()) return 'Le code MFA est requis.'
    return null
  }

  // changePwd state — 2 étapes : vérification identité → OTP email → nouveau mdp
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

  const doAction = async (action: () => Promise<void>, successMsg: string, errMsg: string, skipAuthCheck = false) => {
    if (!skipAuthCheck) {
      const authErr = validateAuth()
      if (authErr) { onToast(authErr, 'error'); return }
    }
    setLoading(true)
    try {
      await action()
      onToast(successMsg)
      onActionDone()
      onClose()
      resetAuth()
    } catch (err: any) {
      onToast(err.message || errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      {open === 'invite' && (
        <Overlay onClose={onClose}>
          <ModalWrap>
            <ModalHeader title="Inviter un nouvel établissement" sub="Un lien d'activation valable 72h sera envoyé à l'administrateur" onClose={onClose} />
            <InviteForm
              selectedPlan={selectedPlan}
              onPlanChange={setSelectedPlan}
              loading={loading}
              onCancel={onClose}
              onDone={(msg) => { onToast(msg); onActionDone(); onClose() }}
              onError={(msg) => onToast(msg, 'error')}
            />
          </ModalWrap>
        </Overlay>
      )}

      {open === 'approve' && (
        <Overlay onClose={() => { onClose(); resetAuth() }}>
          <ModalWrap size="lg">
            <ModalHeader title="Confirmer l'approbation" sub="Validation de l'école" onClose={() => { onClose(); resetAuth() }} />
            <WarningBox><AlertTriangle size={17} style={{ flexShrink: 0 }} /> Cette action va approuver l'établissement et activer son espace. L'admin recevra un email de bienvenue.</WarningBox>
            <SensitiveAuthFields mfaEnabled={mfaEnabled} password={authPwd} onPassword={setAuthPwd} mfaCode={authMfa} onMfaCode={setAuthMfa} />
            <ModalFooter>
              <BtnSecondary onClick={() => { onClose(); resetAuth() }}>Annuler</BtnSecondary>
              <BtnPrimary disabled={loading} onClick={() => doAction(
                async () => {
                  if (!schoolId) throw new Error('ID école manquant')
                  await approveSchool(schoolId, buildAuth())
                },
                'École approuvée avec succès ! L\'admin a été notifié par email.',
                'Erreur lors de l\'approbation'
              )}>
                {loading ? '...' : <><CheckCircle2 size={17} /> Confirmer l'approbation</>}
              </BtnPrimary>
            </ModalFooter>
          </ModalWrap>
        </Overlay>
      )}

      {open === 'reject' && schoolId && (
        <Overlay onClose={() => { onClose(); resetAuth() }}>
          <ModalWrap size="sm">
            <ModalHeader title="Rejeter la demande" sub="L'administrateur sera notifié du rejet par email" onClose={() => { onClose(); resetAuth() }} />
            <Field label="Motif du rejet *" hint="Obligatoire — ce motif sera envoyé par email à l'école">
              <textarea
                ref={rejectRef}
                placeholder="Ex: Documents incomplets, Informations insuffisantes..."
                onFocus={() => setRejectFocused(true)}
                onBlur={() => setRejectFocused(false)}
                onInput={() => {
                  const el = rejectRef.current
                  if (!el) return
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 320) + 'px'
                }}
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10,
                  color: '#1a1209', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                  outline: 'none', resize: 'none', minHeight: 80, maxHeight: 320, overflowY: 'auto',
                  background: rejectFocused ? 'white' : '#f0ebe3',
                  border: rejectFocused ? '1.5px solid #2AA05F' : '1.5px solid #d4c8b8',
                  boxShadow: rejectFocused ? '0 0 0 3px rgba(48,189,153,0.1)' : 'none',
                  transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
                }} />
            </Field>
            <SensitiveAuthFields mfaEnabled={mfaEnabled} password={authPwd} onPassword={setAuthPwd} mfaCode={authMfa} onMfaCode={setAuthMfa} />
            <ModalFooter>
              <BtnSecondary onClick={() => { onClose(); resetAuth() }}>Annuler</BtnSecondary>
              <BtnPrimary disabled={loading} onClick={() => doAction(
                async () => {
                  const motif = rejectRef.current?.value?.trim()
                  if (!motif) throw new Error('Un motif de rejet est requis')
                  await rejectSchool(schoolId, motif, buildAuth())
                },
                'Demande rejetée',
                'Erreur lors du rejet'
              )}>
                {loading ? '...' : <><XCircle size={17} /> Confirmer le rejet</>}
              </BtnPrimary>
            </ModalFooter>
          </ModalWrap>
        </Overlay>
      )}

      {open === 'suspend' && suspendTarget && (
        <Overlay onClose={() => { onClose(); resetAuth(); setSuspendReason('') }}>
          <ModalWrap size="sm">
            <ModalHeader title="Suspendre l'établissement" sub={suspendTarget.name} onClose={() => { onClose(); resetAuth(); setSuspendReason('') }} />
            <SchoolSummary
              initials={suspendTarget.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              name={suspendTarget.name} meta={`${suspendTarget.subdomain}`} danger />
            <WarningBox><AlertTriangle size={17} style={{ flexShrink: 0 }} /> La suspension bloque immédiatement l&apos;accès à tous les utilisateurs. Action réversible via &quot;Réactiver&quot;.</WarningBox>
            <Field label="Motif de la suspension" hint="Sera enregistré dans les logs d'audit">
              <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                placeholder="Ex: Non-paiement, Violation des conditions..."
                style={{ width: '100%', padding: '9px 12px', background: '#f0ebe3', border: '1px solid #d4c8b8', borderRadius: 8, color: '#1a1209', fontSize: 11, fontFamily: 'inherit', fontWeight: 600, outline: 'none', resize: 'vertical', minHeight: 72 }} />
            </Field>
            <SensitiveAuthFields mfaEnabled={mfaEnabled} password={authPwd} onPassword={setAuthPwd} mfaCode={authMfa} onMfaCode={setAuthMfa} />
            <ModalFooter>
              <BtnSecondary onClick={() => { onClose(); resetAuth(); setSuspendReason('') }}>Annuler</BtnSecondary>
              <BtnPrimary disabled={loading} onClick={() => doAction(
                async () => { await suspendSchool(suspendTarget.id, suspendReason, buildAuth()) },
                `${suspendTarget.name} a été suspendue`,
                'Erreur lors de la suspension'
              )}>
                {loading ? '...' : <><Ban size={17} /> Confirmer la suspension</>}
              </BtnPrimary>
            </ModalFooter>
          </ModalWrap>
        </Overlay>
      )}

      {open === 'delete' && deleteTarget && (
        <Overlay onClose={() => { onClose(); setDeleteInput(''); resetAuth() }}>
          <ModalWrap size="sm">
            <ModalHeader title="Supprimer l'établissement" icon={AlertTriangle} sub={deleteTarget.name} onClose={() => { onClose(); setDeleteInput(''); resetAuth() }} danger />
            <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '16px 18px', marginBottom: 18, border: '2px solid #dc2626' }}>
              <div style={{ color: '#f87171', fontSize: 13, fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}><Siren size={15} /> ACTION IRRÉVERSIBLE</div>
              <div style={{ color: '#fca5a5', fontSize: 12.5, fontWeight: 600, lineHeight: 1.6 }}>
                Cette action supprimera <strong style={{ color: 'white' }}>définitivement</strong> l&apos;établissement et toutes ses données.
              </div>
            </div>
            <Field label="Confirmez en tapant le nom de l'école *"
              hint={deleteInput === deleteTarget.name ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> Confirmation valide</span> : 'Le nom doit correspondre exactement'}>
              {/* Honeypot — absorbe l'autofill Chrome sur les champs texte proches d'un champ password */}
              <input type="text" autoComplete="name" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
              <input type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} autoComplete="off"
                placeholder={`Tapez exactement : ${deleteTarget.name}`}
                style={{ width: '100%', padding: '9px 12px', background: '#f0ebe3', border: `1px solid ${deleteInput === deleteTarget.name ? '#dc2626' : '#d4c8b8'}`, borderRadius: 8, color: '#1a1209', fontSize: 11, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }} />
            </Field>
            <SensitiveAuthFields mfaEnabled={mfaEnabled} password={authPwd} onPassword={setAuthPwd} mfaCode={authMfa} onMfaCode={setAuthMfa} />
            <ModalFooter>
              <BtnSecondary onClick={() => { onClose(); setDeleteInput(''); resetAuth() }}>Annuler</BtnSecondary>
              <button type="button"
                disabled={deleteInput !== deleteTarget.name || loading}
                onClick={() => doAction(
                  async () => { await deleteSchool(deleteTarget.id, buildAuth()) },
                  `${deleteTarget.name} a été définitivement supprimée`,
                  'Erreur lors de la suppression'
                )}
                style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, background: deleteInput === deleteTarget.name && !loading ? '#dc2626' : '#6b7280', color: 'white', border: 'none', cursor: deleteInput === deleteTarget.name && !loading ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={14} /> Supprimer définitivement
              </button>
            </ModalFooter>
          </ModalWrap>
        </Overlay>
      )}

      {open === 'confirmAction' && confirmActionTarget && (
        <Overlay onClose={() => { onClose(); resetAuth() }}>
          <ModalWrap size="sm">
            <ModalHeader
              title={confirmActionTarget.title}
              icon={confirmActionTarget.icon}
              sub={confirmActionTarget.description}
              onClose={() => { onClose(); resetAuth() }}
              danger={confirmActionTarget.danger}
            />
            <SensitiveAuthFields mfaEnabled={mfaEnabled} password={authPwd} onPassword={setAuthPwd} mfaCode={authMfa} onMfaCode={setAuthMfa} />
            <ModalFooter>
              <BtnSecondary onClick={() => { onClose(); resetAuth() }}>Annuler</BtnSecondary>
              <BtnPrimary disabled={loading} onClick={() => doAction(
                async () => { await confirmActionTarget.execute(buildAuth()) },
                confirmActionTarget.successMsg,
                'Erreur lors de l\'action'
              )}>
                {loading ? '...' : <><confirmActionTarget.icon size={17} /> Confirmer</>}
              </BtnPrimary>
            </ModalFooter>
          </ModalWrap>
        </Overlay>
      )}

      {open === 'changePwd' && (
        <Overlay onClose={() => { onClose(); resetPwdState() }}>
          <ModalWrap size="sm">
            <ModalHeader
              title="Changer le mot de passe"
              sub={pwdStep === 1 ? 'Étape 1 / 2 — Vérification d\'identité' : 'Étape 2 / 2 — Code email + nouveau mot de passe'}
              onClose={() => { onClose(); resetPwdState() }}
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
                  <BtnSecondary onClick={() => { onClose(); resetPwdState() }}>Annuler</BtnSecondary>
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
                      } catch (err: any) {
                        onToast(err.message || 'Erreur de vérification', 'error')
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
                        onClose()
                        resetPwdState()
                      } catch (err: any) {
                        onToast(err.message || 'Erreur lors du changement de mot de passe', 'error')
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
      )}
    </>
  )
}

function InviteForm({ selectedPlan, onPlanChange, loading, onCancel, onDone, onError }: {
  selectedPlan: 'deco' | 'std' | 'prem'
  onPlanChange: (p: 'deco' | 'std' | 'prem') => void
  loading: boolean
  onCancel: () => void
  onDone: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [step, setStep] = useState<'details' | 'confirm'>('details')
  const [email, setEmail] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchMasterMfaStatus()
      .then(d => setMfaEnabled(d.mfaEnabled))
      .catch(() => setMfaEnabled(false))
  }, [])

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !schoolName) { onError('Email et nom de l\'école requis'); return }
    if (!email.includes('@')) { onError('Format email invalide'); return }
    setStep('confirm')
  }

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) { onError('Le mot de passe master est requis.'); return }
    if (mfaEnabled && !mfaCode.trim()) { onError('Le code MFA est requis.'); return }

    setSubmitting(true)
    try {
      await inviteSchool({
        email,
        schoolName,
        plan: PLAN_MAP[selectedPlan],
        sensitiveAuth: { password: password.trim(), ...(mfaEnabled && { code: mfaCode.trim() }) },
      })
      onDone(`Invitation envoyée à ${email}`)
    } catch (err: any) {
      onError(err.message || 'Erreur lors de l\'invitation')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'details') {
    return (
      <form onSubmit={handleDetailsSubmit}>
        <Field label="Email de l'administrateur *" hint="L'administrateur recevra le lien d'invitation">
          <FieldInput type="email" placeholder="directeur@lyceedebafia.cm" value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <Field label="Nom de l'établissement *">
          <FieldInput placeholder="Lycée de Bafia" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
        </Field>
        <Field label="Plan tarifaire">
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'deco' as const, name: 'Découverte', desc: 'Gratuit · 50 élèves max' },
              { id: 'std' as const, name: 'Standard', desc: '300 élèves · Toutes fonctions' },
              { id: 'prem' as const, name: 'Premium', desc: 'Illimité · IA + Mobile Money' },
            ].map(plan => (
              <div key={plan.id} onClick={() => onPlanChange(plan.id)} style={{
                flex: 1, padding: 10, border: `1.5px solid ${selectedPlan === plan.id ? '#059669' : '#d4c8b8'}`,
                borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                background: selectedPlan === plan.id ? '#d1fae5' : 'white',
                transition: 'all 0.15s'
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1209' }}>{plan.name}</div>
                <div style={{ fontSize: 10, color: '#a89478', marginTop: 2 }}>{plan.desc}</div>
              </div>
            ))}
          </div>
        </Field>
        <ModalFooter>
          <button type="button" onClick={onCancel} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button type="submit" disabled={loading} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: loading ? '#6b7280' : 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 2px 8px rgba(5,150,105,0.18)' }}>
            Continuer →
          </button>
        </ModalFooter>
      </form>
    )
  }

  return (
    <form onSubmit={handleConfirmSubmit} autoComplete="off">
      {/* Honeypot */}
      <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
      <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
      <div style={{ background: '#f0ebe3', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#a89478', marginBottom: 4 }}>Établissement</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1209' }}>{schoolName}</div>
        <div style={{ fontSize: 12, color: '#a89478', marginTop: 10, marginBottom: 4 }}>Email</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1209' }}>{email}</div>
      </div>

      <Field label="Mot de passe master *" hint="Confirmez votre identité pour envoyer l'invitation">
        <FieldInput type="password" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" showToggle />
      </Field>

      {mfaEnabled && (
        <Field label="Code MFA *">
          <FieldInput type="tel" placeholder="123456" value={mfaCode} onChange={e => setMfaCode(e.target.value)} style={{ textAlign: 'center', fontSize: 14, fontWeight: 900, letterSpacing: 3 }} />
        </Field>
      )}

      <ModalFooter>
        <button type="button" onClick={() => setStep('details')} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={13} /> Retour</button>
        <button type="submit" disabled={submitting || loading} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: submitting || loading ? '#6b7280' : 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: submitting || loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: submitting || loading ? 'none' : '0 2px 8px rgba(5,150,105,0.18)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {submitting ? '...' : <><Mail size={16} /> Envoyer l'invitation</>}
        </button>
      </ModalFooter>
    </form>
  )
}
