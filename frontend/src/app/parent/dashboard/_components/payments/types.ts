export interface Child {
  studentId: string
  prenom: string
  nom: string
  classeNom?: string
  matricule?: string | null
}

export interface Payment {
  id: string
  amount: number
  status: string
  paidAt: string | null
  method: string
  feeType?: string
  cautionStatus?: string
  refundedAt?: string | null
  receiptNumber?: string | null
  provisionalReceiptNumber?: string | null
}

export interface Invoice {
  id: string
  amount: number
  currency: string
  status: string
  dueDate: string | null
  createdAt: string
  description: string | null
  promisedPaymentDate?: string | null
  promisedPaymentNote?: string | null
  installments?: Array<{
    id: string
    trancheNumber: number
    label: string
    amount: number
    paidAmount: number
    dueDate: string
    status: string
  }>
  discounts?: Array<{
    id: string
    reasonType: string
    amount: number
    justification: string
  }>
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string; feeType: string; amount: number } | null
  payments: Payment[]
}

export interface PaymentModalState {
  open: boolean
  step: 'FORM' | 'WAITING_USSD' | 'SUCCESS' | 'FAILED'
  invoiceId: string
  campayRef: string
  amount: number
  maxAmount: number
  label: string
  method: 'MTN_MOMO' | 'ORANGE_MONEY'
  phone: string
  loading: boolean
  error: string
  pollingCount: number
}

export function getPaidAmount(payments: Payment[] = []): number {
  return (payments || [])
    .filter((p) => p.status === 'PAID' || p.status === 'SUCCESS' || p.status === 'COMPLETED')
    .reduce((s, p) => s + p.amount, 0)
}

export function invStatus(tf: (k: string) => string): Record<string, { bg: string; color: string; label: string }> {
  return {
    PENDING: { bg: 'var(--amber-light)', color: 'var(--amber)', label: tf('invoice_status.PENDING') },
    PAID: { bg: 'var(--green-light)', color: 'var(--green)', label: tf('invoice_status.PAID') },
    OVERDUE: { bg: 'var(--red-light)', color: 'var(--red)', label: tf('invoice_status.OVERDUE') },
    CANCELLED: { bg: 'var(--bg2)', color: 'var(--text2)', label: tf('invoice_status.CANCELLED') },
    PARTIAL: { bg: 'var(--blue-light)', color: 'var(--blue)', label: tf('invoice_status.PARTIAL') },
  }
}

export function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

export function getDueDateInfo(dueDateStr: string | null, isPaid: boolean) {
  if (isPaid) return { status: 'PAID' as const, label: 'Facture soldée', color: 'var(--green)', bg: 'var(--green-light)' }
  if (!dueDateStr) return { status: 'NONE' as const, label: 'Délai standard', color: 'var(--text3)', bg: 'var(--bg2)' }

  const now = new Date()
  const due = new Date(dueDateStr)
  const diffTime = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const formattedDate = due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  if (diffDays < 0) {
    return {
      status: 'OVERDUE' as const,
      label: `En retard de ${Math.abs(diffDays)} j (${formattedDate})`,
      color: 'var(--red)',
      bg: 'var(--red-light)',
      urgent: true,
    }
  }
  if (diffDays <= 7) {
    return {
      status: 'URGENT' as const,
      label: `Échéance dans ${diffDays} j (${formattedDate})`,
      color: 'var(--amber)',
      bg: 'var(--amber-light)',
      urgent: true,
    }
  }
  return {
    status: 'NORMAL' as const,
    label: `Date limite : ${formattedDate}`,
    color: 'var(--blue)',
    bg: 'var(--blue-light)',
    urgent: false,
  }
}

export const thSt: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 10.5,
  fontWeight: 800,
  color: 'var(--text3)',
  background: 'var(--bg2)',
  borderBottom: '1px solid var(--border)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
}

export const tdSt: React.CSSProperties = {
  padding: '9px 12px',
  fontSize: 12.5,
  color: 'var(--text2)',
  borderBottom: '1px solid var(--bg)',
  verticalAlign: 'middle',
}

export const btnPay: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 7,
  fontSize: 11.5,
  fontWeight: 700,
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
