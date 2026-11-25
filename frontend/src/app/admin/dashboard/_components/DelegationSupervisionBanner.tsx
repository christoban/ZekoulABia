'use client'

import { ShieldCheck, Info, ArrowLeft } from 'lucide-react'
import type { AdminSection } from '../_types'

interface Props {
  actorTitle?: string
  domainLabel: string
  onNav?: (section: AdminSection) => void
  onBackToHub?: () => void
}

export default function DelegationSupervisionBanner({ actorTitle = 'Censeur / Secrétariat', domainLabel, onNav, onBackToHub }: Props) {
  const handleBack = () => {
    if (onNav) {
      onNav('org-pedagogy')
    } else if (onBackToHub) {
      onBackToHub()
    }
  }

  return (
    <div
      className="mb-4 rounded-[12px] px-3.5 py-2.5 border border-blue-500/20 bg-blue-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 flex-shrink-0"
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
        <div className="w-6 h-6 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5 sm:mt-0">
          <ShieldCheck size={14} />
        </div>
        <div className="text-[12px] md:text-[12.5px] text-[var(--text2)] font-semibold leading-relaxed">
          <span className="font-bold text-[var(--text)]">{domainLabel}</span> — Responsable(s) :{' '}
          <span className="text-blue-600 dark:text-blue-400 font-bold">{actorTitle}</span>. Vous êtes en mode supervision globale avec capacité d'intervention directe.
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
        {(onNav || onBackToHub) && (
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all cursor-pointer border border-amber-700/20 active:scale-95"
          >
            <ArrowLeft size={14} strokeWidth={2.5} />
            <span>Hub Supervision</span>
          </button>
        )}
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
          <Info size={12} />
          <span>Mode Supervision</span>
        </div>
      </div>
    </div>
  )
}
