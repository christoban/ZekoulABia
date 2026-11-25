export interface FinancePayment {
  id: string
  amount: number
  status: string
  paidAt: string | null
  method: string
}

export interface FinanceFeePlan {
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

export interface FinanceInvoiceItem {
  id: string
  amount: number
  currency: string
  status: string
  dueDate: string | null
  createdAt: string
  description?: string | null
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string; feeType: string; amount?: number } | null
  payments: FinancePayment[]
}

export interface FinancePagination {
  total: number
  page: number
  pages: number
}

export const INVOICE_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  PARTIAL: { bg: 'var(--blue-light)', color: 'var(--blue)' },
  PAID: { bg: 'var(--green-light)', color: 'var(--green)' },
  OVERDUE: { bg: 'var(--red-light)', color: 'var(--red)' },
  CANCELLED: { bg: 'var(--bg2)', color: 'var(--text2)' },
}

export const DEPENSE_CATEGORIES = [
  'catSupplies',
  'catMaintenance',
  'catUtilities',
  'catFuel',
  'catCommunication',
  'catBankFees',
  'catSalaries',
  'catEvents',
  'catOther',
] as const

export const EMPTY_DEPENSE = { label: '', amount: '', category: '', date: '' }

