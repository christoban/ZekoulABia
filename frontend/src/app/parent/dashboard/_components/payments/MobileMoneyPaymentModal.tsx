'use client'

import type { Dispatch, SetStateAction } from 'react'
import { AlertTriangle, Smartphone, Check, Circle, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'
import { fmtCFA, type PaymentModalState } from './types'

interface Props {
  modal: PaymentModalState
  setModal: Dispatch<SetStateAction<PaymentModalState>>
  isOnline: boolean
  verifyingInvoiceId: string | null
  onSubmit: () => void
  onVerify: (invoiceId: string, campayRef?: string) => void
}

export default function MobileMoneyPaymentModal({
  modal,
  setModal,
  isOnline,
  verifyingInvoiceId,
  onSubmit,
  onVerify,
}: Props) {
  if (!modal.open) return null

  return (
    <div
      onClick={() => {
        if (modal.step !== 'WAITING_USSD' && !modal.loading) {
          setModal((m) => ({ ...m, open: false }))
        }
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="px-4 py-4 md:px-6 md:py-5"
        style={{ background: 'var(--surface)', borderRadius: 14, width: 440, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
      >
        {/* ÉTAPE 1 : FORMULAIRE DE SAISIE */}
        {modal.step === 'FORM' && (
          <>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Règlement Mobile Money
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{modal.label}</div>

            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Reste total dû</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{fmtCFA(modal.maxAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Montant à régler</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min={100}
                    max={modal.maxAmount}
                    value={modal.amount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0
                      setModal((s) => ({ ...s, amount: Math.min(val, s.maxAmount) }))
                    }}
                    style={{
                      width: 130,
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 800,
                      textAlign: 'right',
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--green)',
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>FCFA</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>Opérateur Mobile Money</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['MTN_MOMO', 'ORANGE_MONEY'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModal((s) => ({ ...s, method: m }))}
                  className="h-10 sm:h-9"
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: '1.5px solid',
                    borderColor: modal.method === m ? 'var(--green)' : 'var(--border)',
                    background: modal.method === m ? 'var(--green-light)' : 'var(--surface)',
                    color: modal.method === m ? 'var(--green)' : 'var(--text3)',
                    transition: 'all 0.12s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Circle size={8} fill={m === 'MTN_MOMO' ? 'var(--amber)' : 'var(--orange)'} stroke="none" />
                  {m === 'MTN_MOMO' ? 'MTN MoMo' : 'Orange Money'}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>Numéro de débit Mobile Money</div>
            <input
              className="h-11 sm:h-9"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--border)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }}
              type="tel"
              placeholder="Ex: 677000000"
              value={modal.phone}
              onChange={(e) => setModal((m) => ({ ...m, phone: e.target.value }))}
            />

            {modal.error && (
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{modal.error}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setModal((m) => ({ ...m, open: false }))}
                disabled={modal.loading}
                className="h-11 sm:h-9"
                style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Annuler
              </button>
              <button
                onClick={onSubmit}
                disabled={modal.loading || !isOnline}
                className="h-11 sm:h-9"
                style={{
                  flex: 2,
                  padding: '7px 12px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
                  color: 'white',
                  border: 'none',
                  cursor: modal.loading ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: modal.loading || !isOnline ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {modal.loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Initiation du paiement…
                  </>
                ) : (
                  <>
                    <Smartphone size={13} strokeWidth={2} />
                    Confirmer le paiement
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 2 : ATTENTE DU CODE PIN USSD SUR LE TÉLÉPHONE */}
        {modal.step === 'WAITING_USSD' && (
          <div className="py-2 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: 'var(--primary-light)' }}>
              <Smartphone size={32} className="animate-pulse" style={{ color: 'var(--primary)' }} />
            </div>

            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Validez sur votre téléphone
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 16 }}>
              Un pop-up ou message d’autorisation a été envoyé au <strong>{modal.phone}</strong>.<br />
              Composez votre <strong>code PIN secret</strong> pour valider le règlement de <strong>{fmtCFA(modal.amount)}</strong>.
            </p>

            <div className="flex items-center justify-center gap-2 p-3 rounded-xl mb-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
                Détection automatique du paiement ({modal.pollingCount * 3}s écoulées)…
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => onVerify(modal.invoiceId, modal.campayRef)}
                disabled={verifyingInvoiceId === modal.invoiceId}
                className="w-full h-10 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'linear-gradient(135deg,var(--green),#15803d)', border: 'none' }}
              >
                {verifyingInvoiceId === modal.invoiceId ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Vérification en cours…
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    J’ai validé mon code PIN (Vérifier maintenant)
                  </>
                )}
              </button>

              <button
                onClick={() => setModal((m) => ({ ...m, open: false }))}
                className="w-full h-9 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ background: 'transparent', color: 'var(--text3)', border: 'none' }}
              >
                Fermer (la vérification continuera)
              </button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 : CONFIRMATION DU SUCCÈS */}
        {modal.step === 'SUCCESS' && (
          <div className="py-3 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: 'var(--green-light)' }}>
              <CheckCircle2 size={36} style={{ color: 'var(--green)' }} />
            </div>

            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Paiement confirmé avec succès !
            </div>

            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 18 }}>
              Le débit a été validé par l’opérateur Mobile Money. Votre facture a été mise à jour et un reçu a été enregistré.
            </p>

            <button
              onClick={() => setModal((m) => ({ ...m, open: false }))}
              className="w-full h-10 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', border: 'none' }}
            >
              Terminer
            </button>
          </div>
        )}

        {/* ÉTAPE 4 : ÉCHEC OU DÉPASSEMENT DE DÉLAI */}
        {modal.step === 'FAILED' && (
          <div className="py-2 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: 'var(--red-light)' }}>
              <AlertTriangle size={32} style={{ color: 'var(--red)' }} />
            </div>

            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Paiement non confirmé
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--red)', lineHeight: 1.5, marginBottom: 16 }}>
              {modal.error || 'Le délai de validation a expiré ou la transaction a été annulée.'}
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => onVerify(modal.invoiceId, modal.campayRef)}
                disabled={verifyingInvoiceId === modal.invoiceId}
                className="w-full h-10 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', border: 'none' }}
              >
                {verifyingInvoiceId === modal.invoiceId ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Vérification en cours…
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} />
                    Vérifier à nouveau auprès de l’opérateur
                  </>
                )}
              </button>

              <button
                onClick={() => setModal((m) => ({ ...m, step: 'FORM', error: '' }))}
                className="w-full h-9 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)' }}
              >
                Recommencer la saisie
              </button>

              <button
                onClick={() => setModal((m) => ({ ...m, open: false }))}
                className="w-full h-8 rounded-lg text-xs font-medium cursor-pointer"
                style={{ background: 'transparent', color: 'var(--text3)', border: 'none' }}
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
