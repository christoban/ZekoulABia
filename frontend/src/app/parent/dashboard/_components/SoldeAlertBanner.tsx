'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X, ArrowRight } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface AlerteSolde {
  studentId: string
  nomComplet: string
  montantDu: number
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

/**
 * Assistant proactif (Section 6.3 du plan Copilot Unifié) : bannière affichée à la
 * connexion si un enfant a un solde impayé, sans que le parent ait rien demandé —
 * indépendant du copilot conversationnel (widget de chat).
 */
export default function SoldeAlertBanner({ onNav }: { onNav: (section: string) => void }) {
  const t = useT('common')
  const [alertes, setAlertes] = useState<AlerteSolde[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetchApi('/api/v2/parent/alerts/balance', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setAlertes(d.data) })
      .catch(() => {})
  }, [])

  if (dismissed || alertes.length === 0) return null

  const total = alertes.reduce((s, a) => s + a.montantDu, 0)
  const detail = alertes.map((a) => `${a.nomComplet} (${fmtCFA(a.montantDu)})`).join(', ')

  return (
    <div
      className="px-3.5 py-2.5 sm:px-4 sm:py-2 flex items-center gap-2.5 shrink-0"
      style={{
        background: 'var(--amber-light)',
        borderBottom: '1px solid var(--amber)',
      }}
    >
      <AlertTriangle size={16} color="var(--amber)" className="shrink-0" />
      <div className="flex-1 min-w-0 text-xs text-[var(--text)] font-semibold line-clamp-2">
        {t('balanceAlert.message', { total: fmtCFA(total), detail })}
      </div>
      <button
        onClick={() => onNav('payments')}
        className="h-8 px-3 rounded-lg flex items-center gap-1.5 shrink-0 text-xs font-bold cursor-pointer"
        style={{
          background: 'var(--amber)',
          color: 'white',
          border: 'none',
          fontFamily: 'inherit',
        }}
      >
        <span>{t('balanceAlert.action')}</span>
        <ArrowRight size={13} />
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t('balanceAlert.dismiss')}
        className="shrink-0 p-1.5 rounded-md text-[var(--text3)] hover:text-[var(--text)] cursor-pointer flex items-center justify-center"
      >
        <X size={15} />
      </button>
    </div>
  )
}
