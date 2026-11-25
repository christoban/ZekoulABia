'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X, ArrowRight } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Anomalies {
  classesSansEdtPublie: string[]
  classesSansConseilTenu: string[]
}

/**
 * Assistant proactif (Section 6.3 du plan Copilot Unifié) : bannière affichée à la
 * connexion si des classes n'ont pas d'emploi du temps publié ou de conseil de classe
 * verrouillé pour la période courante. Réutilise GET /api/v2/school/anomalies, qui
 * applique exactement la même logique que les actions copilot déjà testées
 * classes_sans_edt_publie / classes_sans_conseil_tenu.
 */
export default function AnomaliesAlertBanner({ onNav }: { onNav: (section: string) => void }) {
  const t = useT('admin')
  const [anomalies, setAnomalies] = useState<Anomalies | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetchApi('/api/v2/school/anomalies', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setAnomalies(d.data) })
      .catch(() => {})
  }, [])

  const nbEdt = anomalies?.classesSansEdtPublie.length ?? 0
  const nbConseil = anomalies?.classesSansConseilTenu.length ?? 0

  if (dismissed || !anomalies || (nbEdt === 0 && nbConseil === 0)) return null

  const parts: string[] = []
  if (nbEdt > 0) parts.push(t('anomaliesAlert.edt', { count: String(nbEdt) }))
  if (nbConseil > 0) parts.push(t('anomaliesAlert.conseil', { count: String(nbConseil) }))

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
      background: 'var(--amber-light)', borderBottom: '1.5px solid var(--amber)',
      flexShrink: 0,
    }}>
      <AlertTriangle size={18} color="var(--amber)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>
        {parts.join(' · ')}
      </div>
      <button
        onClick={() => onNav(nbEdt > 0 ? 'timetable' : 'council')}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
          background: 'var(--amber)', color: 'white', border: 'none', borderRadius: 8,
          fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {t('anomaliesAlert.action')} <ArrowRight size={13} />
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t('anomaliesAlert.dismiss')}
        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, display: 'flex' }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
