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
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
      background: 'var(--amber-light)', borderBottom: '1px solid var(--amber)',
      flexShrink: 0,
    }}>
      <AlertTriangle size={15} color="var(--amber)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
        {t('balanceAlert.message', { total: fmtCFA(total), detail })}
      </div>
      <button
        onClick={() => onNav('payments')}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
          background: 'var(--amber)', color: 'white', border: 'none', borderRadius: 6,
          fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {t('balanceAlert.action')} <ArrowRight size={12} />
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t('balanceAlert.dismiss')}
        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 3, display: 'flex' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
