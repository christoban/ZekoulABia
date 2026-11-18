'use client'
import { useState, useRef } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, Ban, Siren, Trash2 } from 'lucide-react'
import type { ModalId, ConfirmActionTarget } from '../_types'
import { suspendSchool, rejectSchool, deleteSchool, approveSchool } from '../_api'
import {
  Overlay, ModalWrap, ModalHeader, ModalFooter, Field,
  BtnPrimary, BtnSecondary, SchoolSummary, WarningBox, SensitiveAuthFields,
} from './modals/MasterModalPrimitives'
import InviteSchoolModal from './modals/InviteSchoolModal'
import ChangePasswordModal from './modals/ChangePasswordModal'

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
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      {open === 'invite' && (
        <InviteSchoolModal
          selectedPlan={selectedPlan}
          onPlanChange={setSelectedPlan}
          loading={loading}
          onClose={onClose}
          onToast={onToast}
          onActionDone={onActionDone}
        />
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
                  background: rejectFocused ? 'white' : 'var(--bg2)',
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
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg2)', border: '1px solid #d4c8b8', borderRadius: 8, color: '#1a1209', fontSize: 11, fontFamily: 'inherit', fontWeight: 600, outline: 'none', resize: 'vertical', minHeight: 72 }} />
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
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg2)', border: `1px solid ${deleteInput === deleteTarget.name ? '#dc2626' : '#d4c8b8'}`, borderRadius: 8, color: '#1a1209', fontSize: 11, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }} />
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
        <ChangePasswordModal mfaEnabled={mfaEnabled} onClose={onClose} onToast={onToast} />
      )}
    </>
  )
}
