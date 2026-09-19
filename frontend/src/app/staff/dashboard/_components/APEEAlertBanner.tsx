'use client'

import { useEffect, useState } from 'react'
import { Wallet, X, ArrowRight } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

/**
 * Assistant proactif (Section 6.3 du plan Copilot Unifié) : bannière affichée à la
 * connexion si des dépenses APEE attendent un justificatif ou une validation.
 * Réutilise GET /api/v2/apee/solde (déjà existant, déjà utilisé par SectionAPEEStaff),
 * aucune nouvelle route. Affichée uniquement si l'utilisateur a la section 'apee'
 * débloquée (permission MANAGE_FINANCE) — un censeur sans responsabilité APEE ne doit
 * pas voir une alerte qui ne le concerne pas.
 */
export default function APEEAlertBanner({ visible, onNav }: { visible: boolean; onNav: (section: string) => void }) {
  const t = useT('staff')
  const [enAttente, setEnAttente] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!visible) return
    fetchApi('/api/v2/apee/solde', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setEnAttente(d.data.depensesEnAttenteDeJustificatifOuValidation ?? 0) })
      .catch(() => {})
  }, [visible])

  if (!visible || dismissed || enAttente === 0) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
      background: 'var(--amber-light)', borderBottom: '1px solid var(--amber)',
      flexShrink: 0,
    }}>
      <Wallet size={16} color="var(--amber)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>
        {t('apeeAlert.message', { count: String(enAttente) })}
      </div>
      <button
        onClick={() => onNav('apee')}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
          background: 'var(--amber)', color: 'white', border: 'none', borderRadius: 6,
          fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {t('apeeAlert.action')} <ArrowRight size={12} />
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t('apeeAlert.dismiss')}
        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 3, display: 'flex' }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
