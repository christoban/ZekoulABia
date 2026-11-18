'use client'

import { Smartphone, WifiOff, RefreshCw, Clock, AlertCircle } from 'lucide-react'
import type { Toast } from '../_types'
import { useT } from '@/lib/i18n'
import { fmtCFA } from './payments/types'
import { useParentPayments } from './payments/useParentPayments'
import MinesecGuidePanel from './payments/MinesecGuidePanel'
import InvoiceListMobile from './payments/InvoiceListMobile'
import InvoiceTableDesktop from './payments/InvoiceTableDesktop'
import MobileMoneyPaymentModal from './payments/MobileMoneyPaymentModal'

interface Props {
  onToast: (msg: string, type?: Toast['type']) => void
  userId?: string
}

export default function SectionParentPayments({ onToast, userId }: Props) {
  const t = useT('parent')
  const {
    isOnline,
    childFilter,
    setChildFilter,
    statusTab,
    setStatusTab,
    guideOpen,
    setGuideOpen,
    modal,
    setModal,
    verifyingInvoiceId,
    children,
    invoices,
    loading,
    error,
    reloadInvoices,
    isPrivate,
    examChildren,
    showMinesecSection,
    openModal,
    verifyPayment,
    submitPayment,
    unpaid,
    totalDu,
    urgentInvoices,
    filteredInvoices,
  } = useParentPayments({ onToast, userId })

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 mb-2 sm:mb-3">
        <div>
          <div style={sTitle}>Factures & Règlements de Scolarité</div>
          <div style={sSub}>Consultez l&apos;ensemble de vos frais d&apos;établissement (APEE, scolarité, tranches) et délais</div>
        </div>
        <div className="flex items-center gap-2">
          {children.length > 0 && (
            <select
              value={childFilter}
              onChange={(e) => setChildFilter(e.target.value)}
              className="w-full sm:w-auto h-10 sm:h-9"
              style={sSelect}
            >
              <option value="">{t('payments.allChildren')}</option>
              {children.map((c) => (
                <option key={c.studentId} value={c.studentId}>
                  {c.prenom} {c.nom} {c.classeNom ? `(${c.classeNom})` : ''}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => reloadInvoices()}
            title="Rafraîchir"
            className="h-10 sm:h-9 px-3 rounded-lg border flex items-center justify-center cursor-pointer transition-colors"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Avertissement hors-ligne gracieux */}
      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <WifiOff size={18} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
            Mode hors-ligne : vous consultez vos factures et historiques en cache. Les règlements nécessitent une connexion active.
          </div>
        </div>
      )}

      {/* Alerte Échéances Imminentes ou Dépassées */}
      {urgentInvoices.length > 0 && (
        <div style={{ background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={20} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)' }}>
              Alerte échéance : {urgentInvoices.length} facture(s) arrivée(s) à date limite ou urgente(s)
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 2 }}>
              Veuillez régulariser ces règlements auprès de l&apos;intendance pour éviter tout blocage scolaire.
            </div>
          </div>
        </div>
      )}

      {/* Récapitulatif montant restant dû */}
      {unpaid.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div className="flex items-center gap-2.5">
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--amber-light)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>
                {unpaid.length} paiement(s) en attente
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                Scolarité, APEE et contributions d&apos;établissement
              </div>
            </div>
          </div>
          <div className="text-right">
            <span style={{ fontSize: 11, color: 'var(--text3)', display: 'block' }}>Reste total à régler</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--red)' }}>{fmtCFA(totalDu)}</span>
          </div>
        </div>
      )}

      {showMinesecSection && (
        <MinesecGuidePanel
          isPrivate={isPrivate}
          childrenList={children}
          examChildren={examChildren}
          guideOpen={guideOpen}
          onToggleGuide={() => setGuideOpen((o) => !o)}
          onToast={onToast}
        />
      )}

      {/* Onglets de filtrage rapide des factures */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {[
          { id: 'ALL' as const, label: `Toutes (${invoices.length})` },
          { id: 'UNPAID' as const, label: `À régler (${unpaid.length})` },
          { id: 'URGENT' as const, label: `Urgentes / Échues (${urgentInvoices.length})` },
          { id: 'PAID' as const, label: `Soldées (${invoices.length - unpaid.length})` },
        ].map((tab) => {
          const active = statusTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              className="h-8 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer shrink-0"
              style={{
                background: active ? 'var(--sidebar)' : 'var(--surface)',
                color: active ? 'white' : 'var(--text2)',
                borderColor: active ? 'transparent' : 'var(--border)',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Liste des factures */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading && !invoices.length ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>
            Chargement des factures…
          </div>
        ) : error && !invoices.length ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--red)', fontWeight: 700, fontSize: 12.5 }}>
            {error}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
            <Smartphone size={38} className="mx-auto mb-2 text-[var(--text3)]" />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Aucune facture trouvée dans cette vue</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Toutes vos obligations scolaires sont à jour pour ces critères.</div>
          </div>
        ) : (
          <>
            <InvoiceListMobile
              invoices={filteredInvoices}
              isOnline={isOnline}
              verifyingInvoiceId={verifyingInvoiceId}
              onOpenPayModal={openModal}
              onVerifyPayment={verifyPayment}
              onReload={reloadInvoices}
              onToast={onToast}
            />
            <InvoiceTableDesktop
              invoices={filteredInvoices}
              isOnline={isOnline}
              verifyingInvoiceId={verifyingInvoiceId}
              onOpenPayModal={openModal}
              onVerifyPayment={verifyPayment}
              onReload={reloadInvoices}
              onToast={onToast}
            />
          </>
        )}
      </div>

      <MobileMoneyPaymentModal
        modal={modal}
        setModal={setModal}
        isOnline={isOnline}
        verifyingInvoiceId={verifyingInvoiceId}
        onSubmit={submitPayment}
        onVerify={verifyPayment}
      />
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const sSelect: React.CSSProperties = { padding: '5px 10px', borderRadius: 8, fontSize: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer' }
