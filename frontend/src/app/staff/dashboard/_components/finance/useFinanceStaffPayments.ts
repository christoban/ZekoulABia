'use client'

import { useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { putCachedData } from '@/lib/offline/db'
import type { RecuProvisoireData } from '@/components/finance/RecuProvisoireModal'
import type { FinanceInvoiceItem, FinancePagination, FinancePayment } from '@/features/finance/financeShared'
import type { SessionUser } from '../../_types'
import { getInvoicePaidAmount } from './financeStaffStyles'

interface UseFinanceStaffPaymentsParams {
  invoices: FinanceInvoiceItem[]
  setInvoices: React.Dispatch<React.SetStateAction<FinanceInvoiceItem[]>>
  pag: FinancePagination
  page: number
  statusFilter: string
  fetchInvoices: (pg?: number) => Promise<void>
  schoolInfo: { name: string; logoUrl: string | null } | null
  sessionUser?: SessionUser | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function useFinanceStaffPayments({
  invoices,
  setInvoices,
  pag,
  page,
  statusFilter,
  fetchInvoices,
  schoolInfo,
  sessionUser,
  onToast,
}: UseFinanceStaffPaymentsParams) {
  const t = useT('staff')
  const { addToQueue } = useSyncQueue()
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [pendingCampayRefs, setPendingCampayRefs] = useState<Record<string, string>>({})
  const [currentRecu, setCurrentRecu] = useState<RecuProvisoireData | null>(null)

  const verifyMobileMoney = async (invoiceId: string, campayRef?: string) => {
    setVerifyingId(invoiceId)
    try {
      const res = await fetchApi('/api/v2/finance/payments/mobile/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, campayRef: campayRef || pendingCampayRefs[invoiceId] || undefined }),
      })
      const d = (await res.json()) as { success?: boolean; data?: { statut?: string; message?: string }; message?: string }
      if (!res.ok) throw new Error(d.message || 'Erreur vérification Campay')
      const statut = d.data?.statut
      onToast(
        d.data?.message || (statut === 'SUCCESS' ? 'Paiement Mobile Money confirmé !' : 'Toujours en attente sur le téléphone'),
        statut === 'SUCCESS' ? 'success' : statut === 'FAILED' ? 'error' : 'info'
      )
      if (statut === 'SUCCESS' || statut === 'FAILED') {
        setPendingCampayRefs(prev => {
          const next = { ...prev }
          delete next[invoiceId]
          return next
        })
        void fetchInvoices(page)
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur vérification Mobile Money', 'error')
    } finally {
      setVerifyingId(null)
    }
  }

  const initiateMobileMoney = async (invoice: FinanceInvoiceItem) => {
    const phone = prompt(
      t('finance.mobileMoneyPrompt', { firstName: invoice.student.firstName, lastName: invoice.student.lastName })
    )
    if (!phone?.trim()) return
    const normalized = phone.trim().replace(/\s+/g, '')
    const alreadyPaid = getInvoicePaidAmount(invoice.payments)
    const remaining = Math.max(1, invoice.amount - alreadyPaid)
    const isMtn =
      normalized.startsWith('67') ||
      normalized.startsWith('650') ||
      normalized.startsWith('651') ||
      normalized.startsWith('652') ||
      normalized.startsWith('653') ||
      normalized.startsWith('654') ||
      normalized.startsWith('68')
    setPayingId(invoice.id)
    try {
      const res = await fetchApi('/api/v2/finance/payments/mobile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factureId: invoice.id,
          studentId: invoice.student.id,
          phoneNumber: normalized,
          amount: remaining,
          method: isMtn ? 'MTN_MOMO' : 'ORANGE_MONEY',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      if (data.data?.campayRef) {
        setPendingCampayRefs(prev => ({ ...prev, [invoice.id]: String(data.data.campayRef) }))
      }
      onToast(t('finance.paymentInitiated'), 'info')
      void fetchInvoices(page)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur Mobile Money', 'error')
    } finally {
      setPayingId(null)
    }
  }

  const recordCashPayment = async (inv: FinanceInvoiceItem) => {
    const alreadyPaid = getInvoicePaidAmount(inv.payments)
    const remaining = Math.max(0, inv.amount - alreadyPaid)
    const defaultAmount = remaining > 0 ? remaining : inv.amount
    const promptMsg =
      t('finance.cashPrompt', { firstName: inv.student.firstName, lastName: inv.student.lastName }) ||
      `Encaisser en espèces pour ${inv.student.firstName} ${inv.student.lastName} (FCFA) :`
    const amountStr = prompt(promptMsg, String(defaultAmount))
    if (!amountStr?.trim()) return
    const montant = parseFloat(amountStr.trim())
    if (isNaN(montant) || montant <= 0) {
      onToast('Montant invalide', 'error')
      return
    }

    setPayingId(inv.id)
    const idempotencyKey = crypto.randomUUID()
    const isCurrentlyOffline = !navigator.onLine
    const provisionalRef = `PROV-${idempotencyKey.slice(0, 8).toUpperCase()}`
    const clientRecordedAt = new Date().toISOString()

    const buildRecuData = (isOffline: boolean, ref: string, paymentId?: string, showProv?: string): RecuProvisoireData => ({
      reference: ref,
      provisionalReference: showProv,
      paymentId,
      isOffline,
      date: new Date(),
      schoolName: schoolInfo?.name || 'Établissement Scolaire',
      schoolLogoUrl: schoolInfo?.logoUrl,
      studentName: `${inv.student.firstName} ${inv.student.lastName}`,
      studentId: inv.student.id,
      feePlanName: inv.feePlan?.name || 'Frais de scolarité',
      amountPaid: montant,
      totalAmount: inv.amount,
      remainingAmount: Math.max(0, inv.amount - (alreadyPaid + montant)),
      receivedBy: sessionUser?.nomComplet || sessionUser?.firstName || 'Intendant',
    })

    const applyOptimisticPayment = async () => {
      const newPaid = alreadyPaid + montant
      const newStatus = newPaid >= inv.amount ? 'PAID' : 'PARTIAL'
      const updatedPayments: FinancePayment[] = [
        ...inv.payments,
        { id: idempotencyKey, amount: montant, status: 'PAID', paidAt: new Date().toISOString(), method: 'CASH' },
      ]
      const updatedInvoices = invoices.map(item =>
        item.id === inv.id ? { ...item, payments: updatedPayments, status: newStatus } : item
      )
      setInvoices(updatedInvoices)
      const cacheKey = `staff:finance:invoices:${statusFilter}:${page}`
      await putCachedData(cacheKey, { invoices: updatedInvoices, pagination: pag }).catch(() => {})
    }

    if (isCurrentlyOffline) {
      try {
        await addToQueue({
          type: 'FEE_PAYMENT_CASH',
          endpoint: '/api/v2/finance/payments/cash',
          method: 'POST',
          idempotencyKey,
          payload: {
            factureId: inv.id,
            studentId: inv.student.id,
            montant,
            provisionalReceiptNumber: provisionalRef,
            clientRecordedAt,
          },
        })
        await applyOptimisticPayment()
        setCurrentRecu(buildRecuData(true, provisionalRef))
        onToast('Encaissement enregistré hors-ligne (reçu provisoire généré)', 'info')
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Erreur enregistrement hors-ligne', 'error')
      } finally {
        setPayingId(null)
      }
      return
    }

    try {
      const res = await fetchApi('/api/v2/finance/payments/cash', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          factureId: inv.id,
          studentId: inv.student.id,
          montant,
          provisionalReceiptNumber: provisionalRef,
          clientRecordedAt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur lors de l’encaissement')
      await applyOptimisticPayment()
      const ref = data.data?.receiptNumber || data.data?.recuNumero || data.data?.paiementId || provisionalRef
      setCurrentRecu(buildRecuData(false, ref, data.data?.paiementId, provisionalRef))
      onToast(t('finance.cashSuccess') || 'Paiement en espèces enregistré avec succès', 'success')
      void fetchInvoices(page)
    } catch (err) {
      try {
        await addToQueue({
          type: 'FEE_PAYMENT_CASH',
          endpoint: '/api/v2/finance/payments/cash',
          method: 'POST',
          idempotencyKey,
          payload: {
            factureId: inv.id,
            studentId: inv.student.id,
            montant,
            provisionalReceiptNumber: provisionalRef,
            clientRecordedAt,
          },
        })
        await applyOptimisticPayment()
        setCurrentRecu(buildRecuData(true, provisionalRef))
        onToast('Connexion perdue : paiement conservé hors-ligne avec reçu provisoire', 'info')
      } catch {
        onToast(err instanceof Error ? err.message : 'Erreur', 'error')
      }
    } finally {
      setPayingId(null)
    }
  }

  const sendSmsReminder = async (invoice: FinanceInvoiceItem) => {
    setSendingId(invoice.id)
    try {
      const res = await fetchApi(`/api/v2/finance/invoices/${invoice.id}/remind`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      onToast(t('finance.smsSent', { firstName: invoice.student.firstName, lastName: invoice.student.lastName }), 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur envoi SMS', 'error')
    } finally {
      setSendingId(null)
    }
  }

  return {
    sendingId,
    payingId,
    verifyingId,
    pendingCampayRefs,
    currentRecu,
    setCurrentRecu,
    verifyMobileMoney,
    initiateMobileMoney,
    recordCashPayment,
    sendSmsReminder,
  }
}
