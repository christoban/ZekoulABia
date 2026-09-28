'use client'

import { useEffect, useState } from 'react'
import { HeartPulse, X, ArrowRight } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface HealthTrackingChild {
  studentId: string
  healthScore: number
  alertLevel: 'critical' | 'warning' | 'good'
}

/**
 * Assistant proactif (Section 6.3 du plan Copilot Unifié) : bannière affichée à la
 * connexion si l'indice de santé scolaire de l'élève est en zone d'avertissement ou
 * critique — même seuil déjà utilisé par /api/v2/ai/health-tracking et par l'action
 * copilot ADMIN `lister_eleves_a_risque` (schoolConfig.aiRiskThreshold), pas un nouveau
 * seuil inventé pour l'occasion.
 */
export default function HealthAlertBanner({ onNav }: { onNav: (section: string) => void }) {
  const t = useT('common')
  const [child, setChild] = useState<HealthTrackingChild | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetchApi('/api/v2/ai/health-tracking', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.children?.[0]) setChild(d.children[0]) })
      .catch(() => {})
  }, [])

  if (dismissed || !child || child.alertLevel === 'good') return null

  const critique = child.alertLevel === 'critical'
  const color = critique ? 'var(--red)' : 'var(--amber)'
  const bg = critique ? 'var(--red-light)' : 'var(--amber-light)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
      background: bg, borderBottom: `1px solid ${color}`,
      flexShrink: 0,
    }}>
      <HeartPulse size={15} color={color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
        {t(critique ? 'healthAlert.messageCritical' : 'healthAlert.messageWarning', { score: String(child.healthScore) })}
      </div>
      <button
        onClick={() => onNav('health-tracking')}
        className="shrink-0 h-8 px-3 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 border-0 text-white cursor-pointer active:scale-95 transition-transform"
        style={{ background: color }}
      >
        <span>{t('healthAlert.action')}</span> <ArrowRight size={13} />
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t('healthAlert.dismiss')}
        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 3, display: 'flex' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
