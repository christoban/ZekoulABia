'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, UserCheck, ArrowRight, X, ShieldAlert, Sparkles } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

export interface MissingField {
  key: string
  labelFr: string
  labelEn: string
}

export interface CompletenessData {
  completenessScore: number
  missingCount: number
  missingFields: MissingField[]
  profileManagedBy: 'STUDENT' | 'PARENT' | 'SECRETARIAT'
  cycle: string
  canEdit: boolean
  student: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    dateOfBirth: string | null
    gender: string | null
    photoUrl: string | null
    matricule: string | null
    className: string
  }
}

interface Props {
  onOpenEdit: (data: CompletenessData) => void
}

export default function ProfileIncompleteBanner({ onOpenEdit }: Props) {
  const t = useT('student')
  const [data, setData] = useState<CompletenessData | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchApi('/api/v2/students/me/profile-completeness', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (mounted && json.success && json.data) {
          setData(json.data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading || dismissed || !data || data.missingCount === 0) return null

  const isSecondCycle = data.canEdit
  const missingSummary = data.missingFields.map((f) => f.labelFr).slice(0, 3).join(', ')

  return (
    <div
      className="rounded-xl border p-3 sm:p-3.5 mb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs relative overflow-hidden transition-all"
      style={{
        background: isSecondCycle ? 'var(--amber-light)' : 'var(--blue-light)',
        borderColor: isSecondCycle ? 'var(--amber)' : 'var(--blue)',
      }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: isSecondCycle ? 'var(--amber)' : 'var(--blue)',
            color: 'white',
          }}
        >
          {isSecondCycle ? <AlertTriangle size={16} strokeWidth={2.2} /> : <ShieldAlert size={16} strokeWidth={2.2} />}
        </div>

        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-extrabold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <span>
              {isSecondCycle
                ? (t('profileCompleteness.title_autonomous') || 'Votre profil est incomplet')
                : (t('profileCompleteness.title_parent_managed') || 'Dossier élève à compléter')}
            </span>
            <span
              className="text-[10px] font-black px-1.5 py-0.2 rounded-full"
              style={{
                background: isSecondCycle ? 'rgba(217,119,6,0.2)' : 'rgba(37,99,235,0.2)',
                color: isSecondCycle ? 'var(--amber)' : 'var(--blue)',
              }}
            >
              {data.completenessScore}% complété
            </span>
          </div>

          <div className="text-xs font-semibold mt-0.5 leading-relaxed" style={{ color: 'var(--text2)' }}>
            {isSecondCycle ? (
              <span>
                Il manque <strong>{data.missingCount} information(s)</strong> pour finaliser votre dossier scolaire ({missingSummary}...). Renseignez-les dès maintenant.
              </span>
            ) : (
              <span>
                Certaines pièces de votre dossier sont incomplètes ({missingSummary}...). Votre parent ou le secrétariat gère la mise à jour de votre fiche.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        {isSecondCycle && (
          <button
            onClick={() => onOpenEdit(data)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white border-0 cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
            style={{ background: 'var(--amber)' }}
          >
            <span>{t('profileCompleteness.action_edit') || 'Compléter mon profil'}</span>
            <ArrowRight size={13} strokeWidth={2.2} />
          </button>
        )}

        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-md text-[var(--text3)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer"
          title="Fermer pour cette session"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
