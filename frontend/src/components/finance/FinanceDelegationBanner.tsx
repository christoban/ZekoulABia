'use client'

import React from 'react'
import { ShieldCheck, ArrowRight, Settings } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { AdminSection } from '@/app/admin/dashboard/_types'

interface Props {
  adminGereFinances: boolean
  onNav?: (section: AdminSection) => void
}

export default function FinanceDelegationBanner({ adminGereFinances, onNav }: Props) {
  const t = useT('finance')

  if (adminGereFinances) {
    return (
      <div
        className="mb-3.5 rounded-[12px] px-3.5 py-3 border border-amber-500/25 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
      >
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-700 dark:text-amber-400 mt-0.5">
            <Settings size={14} />
          </div>
          <div className="text-[12px] md:text-[12.5px] text-[var(--text2)] leading-relaxed">
            <span className="font-bold text-[var(--text)]">
              {t('delegation_banner.admin_in_charge_title') || 'Gestion financière directe'}
            </span>{' '}
            —{' '}
            {t('delegation_banner.admin_in_charge_desc') ||
              'La gestion des frais est à votre charge. Si un comptable ou intendant gère ces opérations, vous pouvez déléguer la gestion financière dans les paramètres.'}
          </div>
        </div>
        {onNav && (
          <button
            onClick={() => onNav('settings')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all cursor-pointer border border-amber-700/20 active:scale-95 flex-shrink-0"
          >
            <span>{t('delegation_banner.delegate_action') || 'Paramètres'}</span>
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className="mb-3.5 rounded-[12px] px-3.5 py-2.5 border border-emerald-500/20 bg-emerald-500/5 flex items-start sm:items-center justify-between gap-2.5 shadow-xs"
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
        <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5 sm:mt-0">
          <ShieldCheck size={14} />
        </div>
        <div className="text-[12px] md:text-[12.5px] text-[var(--text2)] leading-relaxed">
          <span className="font-bold text-[var(--text)]">
            {t('delegation_banner.delegated_title') || 'Supervision Financière (Délégation active)'}
          </span>{' '}
          —{' '}
          {t('delegation_banner.delegated_desc') ||
            'La gestion financière quotidienne (tarifs, factures) est déléguée au comptable / intendant. Vous conservez la supervision globale et la consultation.'}
        </div>
      </div>
    </div>
  )
}
