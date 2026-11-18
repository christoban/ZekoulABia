'use client'

import { CheckCircle2, Wallet } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { fmtCFA } from '@/components/finance/ModalOverlay'
import type { FinanceFeePlan as FeePlan } from '@/features/finance/financeShared'

interface FinanceFeePlansTabProps {
  plans: FeePlan[]
  validatingPlanId: string | null
  onValidatePlan: (planId: string, planName: string) => void
}

export default function FinanceFeePlansTab({ plans, validatingPlanId, onValidatePlan }: FinanceFeePlansTabProps) {
  const t = useT('finance')

  const FEE_TYPE_LABEL: Record<string, string> = {
    TUITION: t('fee_type.TUITION'),
    REGISTRATION: t('fee_type.REGISTRATION'),
    EXAM: t('fee_type.EXAM'),
    UNIFORM: t('fee_type.UNIFORM'),
    TRANSPORT: t('fee_type.TRANSPORT'),
    CAUTION: t('fee_type.CAUTION'),
    OTHER: t('fee_type.OTHER'),
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] md:text-[14px] font-bold text-[var(--text)]">{t('tabs.plans')}</div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid var(--blue)' }}>
          Supervision &amp; validation directrice des tarifs
        </span>
      </div>

      {plans.length === 0 ? (
        <div className="px-4 py-8 md:px-6 md:py-10" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <Wallet size={32} strokeWidth={1.5} />
          </div>
          <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            {t('empty_states.no_plans_title')}
          </div>
          <div className="text-xs md:text-[13px] mb-3" style={{ color: 'var(--text3)' }}>
            {t('empty_states.no_plans_description')}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((plan) => (
            <div key={plan.id} className="p-3 md:p-3.5 rounded-xl border border-[var(--border)] shadow-xs md:shadow-none" style={{ background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="text-[13px] md:text-[14.5px]" style={{ fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                  {plan.name}
                </div>
                <span className="text-[10px] md:text-[11px]" style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 12, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
                  {FEE_TYPE_LABEL[plan.feeType] ?? plan.feeType}
                </span>
              </div>
              <div className="text-[16px] md:text-[20px]" style={{ fontWeight: 900, color: 'var(--green)', marginBottom: 4 }}>
                {fmtCFA(plan.amount)}
              </div>
              {plan.description && (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.4 }}>{plan.description}</div>
              )}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                {plan.status && (
                  <span
                    className="text-[10px] md:text-[11px]"
                    style={{
                      background: plan.status === 'PUBLISHED' ? 'var(--green-light)' : plan.status === 'PENDING_VALIDATION' ? 'var(--amber-light)' : 'var(--bg2)',
                      color: plan.status === 'PUBLISHED' ? 'var(--green)' : plan.status === 'PENDING_VALIDATION' ? 'var(--amber)' : 'var(--text2)',
                      padding: '2px 6px', borderRadius: 6, fontWeight: 700,
                    }}
                  >
                    {plan.status === 'PUBLISHED' ? 'Publié & Actif' : plan.status === 'PENDING_VALIDATION' ? 'En attente de validation' : 'Brouillon'}
                  </span>
                )}
                {plan.level && (
                  <span className="text-[10px] md:text-[11px]" style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>
                    {t('badges.level').replace('{level}', plan.level)}
                  </span>
                )}
                {plan.isRefundable && (
                  <span className="text-[10px] md:text-[11px]" style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>
                    {t('badges.refundable')}
                  </span>
                )}
                {plan.dueDate && (
                  <span className="text-[10px] md:text-[11px]" style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>
                    {t('badges.due_date').replace('{date}', new Date(plan.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }))}
                  </span>
                )}
              </div>

              <div style={{ paddingTop: 10, marginTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {plan.status === 'PUBLISHED' ? '⚡ Facturation automatique active' : plan.status === 'PENDING_VALIDATION' ? "⏳ Soumis par l'Intendant" : "✏️ Brouillon de l'Intendant"}
                </span>
                {plan.status !== 'PUBLISHED' && plan.amount > 0 && (
                  <button
                    onClick={() => onValidatePlan(plan.id, plan.name)}
                    disabled={validatingPlanId === plan.id}
                    style={{
                      padding: '5px 10px', borderRadius: 8, background: 'var(--green)', color: '#fff', border: 'none',
                      fontSize: 11.5, fontWeight: 700, cursor: validatingPlanId === plan.id ? 'wait' : 'pointer',
                      opacity: validatingPlanId === plan.id ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                    }}
                  >
                    <CheckCircle2 size={13} />
                    {validatingPlanId === plan.id ? 'Validation...' : 'Valider & Publier'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
