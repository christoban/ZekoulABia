'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Wallet } from 'lucide-react'
import FeePlanCreateModal from '@/components/finance/FeePlanCreateModal'
import BulkInvoiceModal from '@/components/finance/BulkInvoiceModal'
import SingleInvoiceModal from '@/components/finance/SingleInvoiceModal'
import { fmtCFA } from '@/components/finance/ModalOverlay'

interface FeePlan {
  id: string
  name: string
  amount: number
  currency: string
  feeType: string
  level: string | null
  description: string | null
  isRefundable: boolean
  dueDate: string | null
  createdAt: string
  status?: string
}

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onInvoiceCreated?: () => void
}

const FEE_TYPE_LABELS: Record<string, string> = {
  TUITION: 'Scolarité',
  REGISTRATION: 'Inscription',
  EXAM: 'Examen',
  UNIFORM: 'Uniforme',
  TRANSPORT: 'Transport',
  CAUTION: 'Caution',
  OTHER: 'Autre',
}

export default function SectionPlansStaff({ onToast, onInvoiceCreated }: Props) {
  const t = useT('staff')
  const [plans, setPlans] = useState<FeePlan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [singleInvoiceOpen, setSingleInvoiceOpen] = useState(false)
  const [bulkModal, setBulkModal] = useState<{ open: boolean; planId: string; planName: string }>({
    open: false,
    planId: '',
    planName: '',
  })

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setPlans(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={sTitle}>{t('finance.plansTitle') || 'Plans de frais'}</div>
          <div style={sSub}>{t('finance.plansSubtitle') || "Créez, gérez et facturez les tarifs de l'établissement"}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnPrim} onClick={() => setCreateOpen(true)}>
            {t('finance.createPlan') || 'Nouveau plan'}
          </button>
          <button style={btnSec} onClick={fetchPlans}>
            {t('finance.refresh')}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid var(--border)',
              borderTopColor: 'var(--green)',
              borderRadius: '50%',
              animation: 'edu-spin 0.7s linear infinite',
            }}
          />
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            background: 'var(--red-light)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <AlertTriangle size={15} strokeWidth={2} />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, fontSize: 13 }}>{error}</span>
          <button
            onClick={fetchPlans}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--red)',
              border: '1.5px solid rgba(220,38,38,0.3)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {t('finance.refresh')}
          </button>
        </div>
      )}

      {!loading && !error && plans.length === 0 && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            textAlign: 'center',
            padding: '40px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <Wallet size={32} strokeWidth={1.5} style={{ color: 'var(--text3)' }} />
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, marginBottom: 6 }}>
            {t('finance.noPlansTitle') || 'Aucun plan de frais'}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>
            {t('finance.noPlansDesc') || 'Créez votre premier plan de frais pour commencer la facturation.'}
          </div>
          <button
            style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center' }}
            onClick={() => setCreateOpen(true)}
          >
            {t('finance.createPlan') || 'Nouveau plan'}
          </button>
        </div>
      )}

      {!loading && !error && plans.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: 'var(--surface)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                padding: 14,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) =>
                Object.assign((e.currentTarget as HTMLElement).style, {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                })
              }
              onMouseLeave={(e) =>
                Object.assign((e.currentTarget as HTMLElement).style, {
                  transform: 'none',
                  boxShadow: 'none',
                })
              }
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, lineHeight: 1.3 }}>{plan.name}</div>
                <span
                  style={{
                    background: 'var(--blue-light)',
                    color: 'var(--blue)',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginLeft: 6,
                  }}
                >
                  {FEE_TYPE_LABELS[plan.feeType] ?? plan.feeType}
                </span>
              </div>
              <div style={{ fontWeight: 900, color: 'var(--green)', fontSize: 18, marginBottom: 4 }}>
                {fmtCFA(plan.amount)}
              </div>
              {plan.description && (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.4 }}>
                  {plan.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {plan.level && (
                  <span
                    style={{
                      background: 'var(--bg2)',
                      color: 'var(--text2)',
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Niveau : {plan.level}
                  </span>
                )}
                {plan.isRefundable && (
                  <span
                    style={{
                      background: 'var(--green-light)',
                      color: 'var(--green)',
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Remboursable
                  </span>
                )}
                {plan.dueDate && (
                  <span
                    style={{
                      background: 'var(--amber-light)',
                      color: 'var(--amber)',
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Échéance : {new Date(plan.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                )}
              </div>
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                <button
                  style={btnSecSm}
                  onClick={() => setBulkModal({ open: true, planId: plan.id, planName: plan.name })}
                >
                  {t('finance.generateInvoices') || 'Facturer'}
                </button>
                <button style={btnSecSm} onClick={() => setSingleInvoiceOpen(true)}>
                  {t('finance.singleInvoice') || 'Facture individuelle'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modales pour le staff */}
      <FeePlanCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          fetchPlans()
        }}
        onToast={onToast}
      />
      <BulkInvoiceModal
        open={bulkModal.open}
        planId={bulkModal.planId}
        planName={bulkModal.planName}
        onClose={() => setBulkModal({ open: false, planId: '', planName: '' })}
        onGenerated={() => {
          setBulkModal({ open: false, planId: '', planName: '' })
          onInvoiceCreated?.()
        }}
        onToast={onToast}
      />
      <SingleInvoiceModal
        open={singleInvoiceOpen}
        onClose={() => setSingleInvoiceOpen(false)}
        onCreated={() => {
          setSingleInvoiceOpen(false)
          onInvoiceCreated?.()
        }}
        onToast={onToast}
      />
    </div>
  )
}

const sTitle: React.CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif',
  fontSize: 17,
  fontWeight: 700,
  color: 'var(--text)',
}
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = {
  padding: '6px 13px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  background: 'linear-gradient(135deg,var(--green),var(--green2))',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const btnSec: React.CSSProperties = {
  padding: '5px 11px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--surface)',
  color: 'var(--text2)',
  border: '1px solid var(--border2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const btnSecSm: React.CSSProperties = {
  padding: '4px 9px',
  borderRadius: 7,
  fontSize: 11.5,
  fontWeight: 700,
  background: 'var(--surface)',
  color: 'var(--text2)',
  border: '1px solid var(--border2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
