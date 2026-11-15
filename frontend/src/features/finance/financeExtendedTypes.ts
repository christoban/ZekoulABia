import { fetchApi } from '@/lib/fetchApi'

export interface InstallmentItem {
  id: string
  invoiceId: string
  trancheNumber: number
  label: string
  amount: number
  paidAmount: number
  dueDate: string
  status: string
}

export interface DiscountItem {
  id: string
  reasonType: string
  amount: number
  percentage: number | null
  justification: string
  createdAt: string
}

export interface PaymentDetailItem {
  id: string
  amount: number
  currency?: string
  method: string
  status: string
  paidAt: string | null
  receiptNumber?: string | null
  provisionalReceiptNumber?: string | null
  cancellationReason?: string | null
  reversalOfPaymentId?: string | null
}

export interface InvoiceDetailsPayload {
  invoice: {
    id: string
    studentId: string
    amount: number
    paidAmount?: number
    currency: string
    status: string
    dueDate: string | null
    description?: string | null
    promisedPaymentDate?: string | null
    promisedPaymentNote?: string | null
    createdAt: string
  }
  installments: InstallmentItem[]
  discounts: DiscountItem[]
  payments: PaymentDetailItem[]
  totalPaid: number
  remainingBalance: number
  studentCreditBalance: number
}

export interface CashClosureItem {
  id: string
  closureDate: string
  totalCash: number
  totalMobileMoney: number
  totalOther: number
  totalCancelled: number
  paymentCount: number
  declaredCash: number | null
  variance: number | null
  notes: string | null
  createdAt: string
  closedBy?: { firstName: string; lastName: string } | null
}

export interface UnmatchedPaymentItem {
  id: string
  amount: number
  method: string
  campayRef: string | null
  operatorRef: string | null
  phoneNumber: string | null
  paidAt: string | null
  createdAt: string
  studentId: string
}

export async function downloadReceiptPdf(
  paymentId: string,
  options: { duplicate?: boolean; lang?: 'fr' | 'en' | 'bilingual' } = {}
): Promise<void> {
  const params = new URLSearchParams()
  if (options.duplicate) params.set('duplicate', 'true')
  if (options.lang) params.set('lang', options.lang)
  const qs = params.toString()
  const url = `/api/v2/finance/payments/${paymentId}/receipt${qs ? `?${qs}` : ''}`
  const res = await fetchApi(url, { credentials: 'include' })
  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(errData.message || 'Impossible de télécharger le reçu PDF')
  }
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = `recu-${paymentId}${options.duplicate ? '-duplicata' : ''}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

