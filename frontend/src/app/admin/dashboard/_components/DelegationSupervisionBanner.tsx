'use client'

import { ShieldCheck, Info } from 'lucide-react'

interface Props {
  actorTitle?: string
  domainLabel: string
}

export default function DelegationSupervisionBanner({ actorTitle = 'Censeur / Secrétariat', domainLabel }: Props) {
  return (
    <div
      className="mb-4 rounded-[12px] px-4 py-2.5 border border-blue-500/20 bg-blue-500/5 flex items-center justify-between gap-3 flex-shrink-0"
      style={{ minHeight: 42 }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0 text-blue-400">
          <ShieldCheck size={14} />
        </div>
        <div className="text-[12px] md:text-[12.5px] text-[var(--text2)] font-semibold truncate">
          <span className="font-bold text-[var(--text)]">{domainLabel}</span> — Gestion quotidienne assurée par le{' '}
          <span className="text-blue-400 font-bold">{actorTitle}</span>. Vous êtes en mode supervision globale avec capacité d'intervention directe.
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-blue-400/90 bg-blue-500/10 px-2.5 py-1 rounded-full flex-shrink-0">
        <Info size={12} />
        <span>Mode Supervision</span>
      </div>
    </div>
  )
}
