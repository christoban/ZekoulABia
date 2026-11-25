'use client'

import { useCallback, useEffect, useState } from 'react'
import { notifyToast } from '@/components/shell/AppToast'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import type {
  FinanceFeePlan as FeePlan,
  FinanceInvoiceItem as InvoiceItem,
  FinancePagination as Pagination,
} from '@/features/finance/financeShared'

export type FinanceAdminTab = 'supervision' | 'plans' | 'invoices' | 'closures'

export function useAdminFinanceData(onToast: (msg: string, type?: 'success' | 'error' | 'info') => void) {
  const t = useT('finance')
  const [tab, setTab] = useState<FinanceAdminTab>('supervision')
  const [plans, setPlans] = useState<FeePlan[]>([])
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [pag, setPag] = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invStatus, setInvStatus] = useState('')
  const [page, setPage] = useState(1)
  const [validatingPlanId, setValidatingPlanId] = useState<string | null>(null)

  const fetchPlans = useCallback(async () => {
    const cached = await getCachedData<FeePlan[]>('admin:finance:fee-plans')
    if (cached?.data && Array.isArray(cached.data)) {
      setPlans(cached.data)
      setLoading(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false)
      return
    }

    try {
      if (!cached?.data) setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.server_error'))
      const planList = data.data || []
      setPlans(planList)
      await putCachedData('admin:finance:fee-plans', planList)
    } catch (err) {
      if (!cached?.data) {
        setError(err instanceof Error ? err.message : t('errors.generic_error'))
      }
    } finally {
      setLoading(false)
    }
  }, [t])

  const fetchInvoices = useCallback(
    async (pg = page) => {
      const cacheKey = `admin:finance:invoices:${invStatus || 'ALL'}:${pg}`
      const cached = await getCachedData<{ invoices: InvoiceItem[]; pagination: Pagination }>(cacheKey)
      if (cached?.data?.invoices) {
        setInvoices(cached.data.invoices)
        if (cached.data.pagination) setPag(cached.data.pagination)
        setLoading(false)
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setLoading(false)
        return
      }

      try {
        if (!cached?.data?.invoices) setLoading(true)
        setError(null)
        const params = new URLSearchParams({ page: String(pg), limit: '20' })
        if (invStatus) params.set('status', invStatus)
        const res = await fetchApi(`/api/v2/finance/invoices?${params}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || t('errors.server_error'))
        const invList = data.data || []
        setInvoices(invList)
        if (data.pagination) setPag(data.pagination)
        await putCachedData(cacheKey, { invoices: invList, pagination: data.pagination ?? { total: invList.length, page: pg, pages: 1 } })
      } catch (err) {
        if (!cached?.data?.invoices) {
          setError(err instanceof Error ? err.message : t('errors.generic_error'))
        }
      } finally {
        setLoading(false)
      }
    },
    [invStatus, page, t],
  )

  const handleValidatePlan = async (planId: string, planName: string) => {
    setValidatingPlanId(planId)
    try {
      const res = await fetchApi(`/api/v2/finance/fee-plans/${planId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statutCible: 'PUBLISHED' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))

      const count = data.data?.facturesGenerees ?? 0
      const msg = count > 0
        ? `Plan « ${planName} » validé et publié avec succès ! ${count} facture(s) générée(s) pour les élèves.`
        : `Plan « ${planName} » validé et publié avec succès !`
      if (onToast) onToast(msg, 'success')
      else notifyToast(msg, 'success')
      fetchPlans()
      window.dispatchEvent(new Event('zekoulabia:data-changed'))
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('errors.generic_error')
      if (onToast) onToast(errMsg, 'error')
      else notifyToast(errMsg, 'error')
    } finally {
      setValidatingPlanId(null)
    }
  }

  useEffect(() => {
    if (tab === 'plans') fetchPlans()
    else fetchInvoices(page)
  }, [tab, page, invStatus, fetchPlans, fetchInvoices])

  useEffect(() => {
    const onChanged = () => {
      if (tab === 'plans') fetchPlans()
      else fetchInvoices(page)
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchPlans, fetchInvoices, tab, page])

  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0)
  const paidAmount = invoices.reduce((sum, inv) => {
    const paidInInvoice = (inv.payments || [])
      .filter(p => p.status === 'PAID' || p.status === 'SUCCESS' || p.status === 'COMPLETED')
      .reduce((s, p) => s + p.amount, 0)
    return sum + (inv.status === 'PAID' ? Math.max(inv.amount, paidInInvoice) : paidInInvoice)
  }, 0)
  const pendingCount = invoices.filter(i => i.status === 'PENDING').length
  const overdueCount = invoices.filter(i => i.status === 'OVERDUE').length
  const recoveryRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0

  const recentPayments = invoices
    .flatMap(inv =>
      (inv.payments || []).map(p => ({
        ...p,
        studentName: `${inv.student.firstName} ${inv.student.lastName}`,
        feePlanName: inv.feePlan?.name ?? 'Scolarité',
      })),
    )
    .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
    .slice(0, 10)

  return {
    tab,
    setTab,
    plans,
    invoices,
    pag,
    loading,
    error,
    invStatus,
    setInvStatus,
    page,
    setPage,
    validatingPlanId,
    fetchPlans,
    fetchInvoices,
    handleValidatePlan,
    totalAmount,
    paidAmount,
    pendingCount,
    overdueCount,
    recoveryRate,
    recentPayments,
  }
}
