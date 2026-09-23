'use client'

import React from 'react'
import { ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { AdminSection } from '@/app/admin/dashboard/_types'

interface Props {
  adminGereFinances?: boolean
  onNav?: (section: AdminSection) => void
}

export default function FinanceDelegationBanner({ onNav }: Props) {
  const t = useT('finance')

  return (
    <div
      className="mb-3.5 rounded-[12px] px-3.5 py-2.5 border border-success/20 bg-success/5 flex items-start sm:items-center justify-between gap-2.5 shadow-xs"
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
        <div className="w-6 h-6 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0 text-success dark:text-success mt-0.5 sm:mt-0">
          <ShieldCheck size={14} />
        </div>
        <div className="text-[12px] md:text-[12.5px] text-[var(--text2)] leading-relaxed">
          <span className="font-bold text-[var(--text)]">
            {t('delegation_banner.delegated_title') || 'Supervision Financière Directoriale (Délégation active)'}
          </span>{' '}
          —{' '}
          {t('delegation_banner.delegated_desc') ||
            'La gestion financière quotidienne (tarifs, factures, encaissements) est déléguée à l\'Intendant / Économe. La Direction assure la supervision globale, le suivi du recouvrement et la consultation.'}
        </div>
      </div>
    </div>
  )
}
