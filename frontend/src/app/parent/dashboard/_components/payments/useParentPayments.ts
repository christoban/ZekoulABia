'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Toast } from '../../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { isExamClass, isSchoolPrivate } from '@/lib/academicExamDetector'
import {
  fmtCFA,
  getDueDateInfo,
  getPaidAmount,
  type Child,
  type Invoice,
  type PaymentModalState,
} from './types'

interface UseParentPaymentsParams {
  onToast: (msg: string, type?: Toast['type']) => void
  userId?: string
}

export function useParentPayments({ onToast, userId }: UseParentPaymentsParams) {
  const t = useT('parent')
  const tf = useT('finance')
  const isOnline = useOnlineStatus()

  const [childFilter, setChildFilter] = useState('')
  const [statusTab, setStatusTab] = useState<'ALL' | 'UNPAID' | 'URGENT' | 'PAID'>('ALL')
  const [guideOpen, setGuideOpen] = useState(false)
  const [schoolData, setSchoolData] = useState<{ ownership?: string; minesecSchoolCode?: string } | null>(null)
  const [verifyingInvoiceId, setVerifyingInvoiceId] = useState<string | null>(null)

  const [modal, setModal] = useState<PaymentModalState>({
    open: false,
    step: 'FORM',
    invoiceId: '',
    campayRef: '',
    amount: 0,
    maxAmount: 0,
    label: '',
    method: 'MTN_MOMO',
    phone: '',
    loading: false,
    error: '',
    pollingCount: 0,
  })

  // 1. Récupération enfants (mis en cache)
  const childrenCacheKey = userId ? `parent:children:${userId}` : 'parent:children:default'
  const fetchChildrenFn = useCallback(async (): Promise<Child[]> => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' })
    const d = await res.json()
    if (!d.success) return []
    return ((d.data || []) as Array<Partial<Child> & { studentId: string; prenom: string; nom: string }>).map((c) => ({
      studentId: c.studentId,
      prenom: c.prenom,
      nom: c.nom,
      classeNom: c.classeNom || '',
      matricule: c.matricule || null,
    }))
  }, [])
  const { data: cachedChildren } = useCachedFetch<Child[]>(childrenCacheKey, fetchChildrenFn)
  const children = cachedChildren ?? []

  // 2. Récupération factures (mis en cache)
  const invoicesCacheKey = userId
    ? `parent:invoices:${userId}:${childFilter || 'all'}`
    : `parent:invoices:default:${childFilter || 'all'}`

  const fetchInvoicesFn = useCallback(async (): Promise<Invoice[]> => {
    const params = new URLSearchParams({ limit: '50' })
    if (childFilter) params.set('studentId', childFilter)
    const res = await fetchApi(`/api/v2/parent/invoices?${params}`, { credentials: 'include' })
    const d = await res.json()
    if (!res.ok) throw new Error(d.message || tf('errors.server_error'))
    return d.data || []
  }, [childFilter, tf])

  const { data: cachedInvoices, loading, error, refetch: reloadInvoices } = useCachedFetch<Invoice[]>(
    invoicesCacheKey,
    fetchInvoicesFn
  )

  const [offlineFallbackInvoices, setOfflineFallbackInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    if (error === 'OFFLINE_NO_CACHE' && !cachedInvoices && userId) {
      if (childFilter) {
        getCachedData<Invoice[]>(`parent:invoices:${userId}:${childFilter}`)
          .then((cached) => {
            if (cached?.data && Array.isArray(cached.data)) setOfflineFallbackInvoices(cached.data)
          })
          .catch(() => {})
      } else {
        Promise.all(children.map((c) => getCachedData<Invoice[]>(`parent:invoices:${userId}:${c.studentId}`)))
          .then((results) => {
            const merged: Invoice[] = []
            const seenIds = new Set<string>()
            for (const r of results) {
              if (r?.data && Array.isArray(r.data)) {
                for (const inv of r.data) {
                  if (!seenIds.has(inv.id)) {
                    seenIds.add(inv.id)
                    merged.push(inv)
                  }
                }
              }
            }
            if (merged.length > 0) {
              setOfflineFallbackInvoices(merged)
              putCachedData(`parent:invoices:${userId}:all`, merged).catch(() => {})
            }
          })
          .catch(() => {})
      }
    }
  }, [error, cachedInvoices, userId, childFilter, children])

  const invoices = cachedInvoices ?? (offlineFallbackInvoices.length > 0 ? offlineFallbackInvoices : [])

  // Rafraîchissement temps réel
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'payment') reloadInvoices()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [reloadInvoices])

  // Infos école (public vs privé + code MINESEC)
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetchApi('/api/v2/school/me', { credentials: 'include' })
        const d = await res.json()
        if (d?.data) {
          setSchoolData({
            ownership: d.data.ownership,
            minesecSchoolCode: d.data.minesecSchoolCode,
          })
        }
      } catch {
        /* silencieux */
      }
    })()
  }, [])

  const isPrivate = isSchoolPrivate(schoolData?.ownership)
  const examChildren = useMemo(() => children.filter((c) => isExamClass(c.classeNom)), [children])
  const showMinesecSection = !isPrivate || examChildren.length > 0

  const openModal = (inv: Invoice) => {
    if (!isOnline) {
      onToast(t('payments.offlineMessage'), 'warning')
      return
    }
    const paidAmt = getPaidAmount(inv.payments)
    const remaining = Math.max(0, inv.amount - paidAmt)
    setModal({
      open: true,
      step: 'FORM',
      invoiceId: inv.id,
      campayRef: '',
      amount: remaining,
      maxAmount: remaining,
      label: inv.feePlan?.name ?? inv.description ?? 'Facture',
      method: 'MTN_MOMO',
      phone: '',
      loading: false,
      error: '',
      pollingCount: 0,
    })
  }

  const verifyPayment = async (invoiceId: string, campayRef?: string) => {
    if (!isOnline) {
      onToast(t('payments.offlineMessage'), 'warning')
      return false
    }
    setVerifyingInvoiceId(invoiceId)
    try {
      const res = await fetchApi('/api/v2/parent/payments/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, campayRef: campayRef || undefined }),
      })
      const d = await res.json()
      if (d.success && d.data?.statut === 'SUCCESS') {
        onToast(d.data.message || 'Paiement validé avec succès ! Facture soldée.', 'success')
        if (modal.open) {
          setModal((m) => ({ ...m, step: 'SUCCESS', loading: false }))
        }
        reloadInvoices()
        return true
      } else if (d.success && d.data?.statut === 'PENDING') {
        onToast(d.data.message || 'Le paiement est toujours en attente de confirmation sur le téléphone.', 'info')
        return false
      } else {
        onToast(d.data?.message || 'Aucun paiement validé trouvé pour cette facture.', 'warning')
        if (modal.open && modal.step === 'WAITING_USSD') {
          setModal((m) => ({ ...m, step: 'FAILED', error: d.data?.message || 'Le paiement a échoué ou a expiré.' }))
        }
        return false
      }
    } catch {
      onToast('Erreur lors de la vérification du paiement', 'error')
      return false
    } finally {
      setVerifyingInvoiceId(null)
    }
  }

  const submitPayment = async () => {
    if (!isOnline) {
      setModal((m) => ({ ...m, error: t('payments.offlineMessage') }))
      return
    }
    if (!modal.phone.trim()) {
      setModal((m) => ({ ...m, error: t('payments.phoneRequired') }))
      return
    }
    if (modal.amount <= 0 || modal.amount > modal.maxAmount) {
      setModal((m) => ({ ...m, error: `Montant invalide (maximum : ${fmtCFA(modal.maxAmount)})` }))
      return
    }
    setModal((m) => ({ ...m, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/parent/pay', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: modal.invoiceId,
          method: modal.method,
          phoneNumber: modal.phone,
          amount: modal.amount,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || tf('errors.generic_error'))

      setModal((m) => ({
        ...m,
        loading: false,
        step: 'WAITING_USSD',
        campayRef: d.data?.campayRef || '',
        pollingCount: 0,
      }))
    } catch (err) {
      setModal((m) => ({ ...m, error: err instanceof Error ? err.message : tf('errors.generic_error'), loading: false }))
    }
  }

  // Polling automatique de confirmation du paiement en direct
  useEffect(() => {
    if (!modal.open || modal.step !== 'WAITING_USSD' || !modal.invoiceId) return

    let cancelled = false
    let count = 0
    const maxPolls = 30

    const timer = setInterval(async () => {
      count++
      if (cancelled) return

      try {
        const res = await fetchApi('/api/v2/parent/payments/verify', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: modal.invoiceId,
            campayRef: modal.campayRef || undefined,
          }),
        })
        const d = await res.json()
        if (cancelled) return

        if (d.success && d.data?.statut === 'SUCCESS') {
          clearInterval(timer)
          setModal((m) => ({ ...m, step: 'SUCCESS', loading: false }))
          reloadInvoices()
          onToast('Paiement validé avec succès ! Facture soldée.', 'success')
          return
        }

        if (d.success && d.data?.statut === 'FAILED') {
          clearInterval(timer)
          setModal((m) => ({
            ...m,
            step: 'FAILED',
            loading: false,
            error: d.data?.message || 'Le paiement a été rejeté ou a expiré.',
          }))
          reloadInvoices()
          return
        }

        setModal((m) => ({ ...m, pollingCount: count }))
      } catch {
        // Poursuivre le polling
      }

      if (count >= maxPolls) {
        clearInterval(timer)
        if (!cancelled) {
          setModal((m) => ({
            ...m,
            step: 'FAILED',
            error: 'Délai d’attente dépassé (90s). Si vous avez déjà validé votre code secret, cliquez sur "Vérifier à nouveau".',
          }))
        }
      }
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [modal.open, modal.step, modal.invoiceId, modal.campayRef, reloadInvoices, onToast])

  const unpaid = invoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE' || i.status === 'PARTIAL')
  const totalDu = unpaid.reduce((s, i) => {
    const paid = getPaidAmount(i.payments)
    return s + Math.max(0, i.amount - paid)
  }, 0)

  const urgentInvoices = unpaid.filter((i) => {
    const dueInfo = getDueDateInfo(i.dueDate, false)
    return dueInfo.status === 'OVERDUE' || dueInfo.status === 'URGENT'
  })

  const filteredInvoices = invoices.filter((inv) => {
    const paidAmt = getPaidAmount(inv.payments)
    const isPaid = inv.status === 'PAID' || paidAmt >= inv.amount

    if (statusTab === 'PAID') return isPaid
    if (statusTab === 'UNPAID') return !isPaid
    if (statusTab === 'URGENT') {
      if (isPaid) return false
      const dueInfo = getDueDateInfo(inv.dueDate, false)
      return dueInfo.status === 'OVERDUE' || dueInfo.status === 'URGENT'
    }
    return true
  })

  return {
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
  }
}
