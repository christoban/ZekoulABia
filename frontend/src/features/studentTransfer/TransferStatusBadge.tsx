'use client'

import { useT } from '@/lib/i18n'
import type { TransferStatus } from './transferApi'

const STYLE: Record<TransferStatus, { bg: string; color: string }> = {
  PENDING_GUARDIAN: { bg: 'var(--amber-light, #fef3c7)', color: 'var(--amber, #d97706)' },
  PENDING_SOURCE: { bg: 'var(--blue-light, #dbeafe)', color: 'var(--blue, #2563eb)' },
  APPROVED: { bg: 'var(--green-light, #dcfce7)', color: 'var(--green, #16a34a)' },
  REFUSED_BY_GUARDIAN: { bg: 'var(--red-light, #fee2e2)', color: 'var(--red, #dc2626)' },
  REFUSED_BY_SOURCE: { bg: 'var(--red-light, #fee2e2)', color: 'var(--red, #dc2626)' },
  EXPIRED: { bg: 'var(--bg2, #f3f4f6)', color: 'var(--text3, #9ca3af)' },
  REVOKED: { bg: 'var(--red-light, #fee2e2)', color: 'var(--red, #dc2626)' },
  COMPLETED: { bg: 'var(--green-light, #dcfce7)', color: 'var(--green, #16a34a)' },
  CANCELLED: { bg: 'var(--bg2, #f3f4f6)', color: 'var(--text3, #9ca3af)' },
}

export default function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const t = useT('studentTransfer')
  const style = STYLE[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
      background: style.bg, color: style.color,
    }}>
      {t(`statut.${status}`)}
    </span>
  )
}
