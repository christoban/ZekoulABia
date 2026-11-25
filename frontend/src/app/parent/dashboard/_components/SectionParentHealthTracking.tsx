'use client'

import { useState, useCallback, useEffect } from 'react'
import { HeartPulse, Sparkles, AlertTriangle, CheckCircle2, TrendingUp, Users, Calendar, ShieldCheck, Activity } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useT } from '@/lib/i18n'
import type { ChildWithStats } from '../_types'

interface HealthTrackingChild {
  studentId: string
  name: string
  className: string
  healthScore: number
  alertLevel: 'critical' | 'warning' | 'good'
  conseil: string | null
  conseilDate: string | null
}

interface Props {
  userId?: string
  initialStudentId?: string
  onNav?: (section: string) => void
}

export default function SectionParentHealthTracking({ userId, initialStudentId, onNav }: Props) {
  const t = useT('parent')
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '')

  // 1. Liste des enfants avec leurs statistiques de présence et moyennes
  const childrenCacheKey = userId ? `parent:children:${userId}` : ''
  const fetchChildren = useCallback(async () => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    return (res.data ?? []) as ChildWithStats[]
  }, [userId])
  const { data: childrenRaw } = useCachedFetch<ChildWithStats[]>(childrenCacheKey, fetchChildren)
  const childrenList = childrenRaw ?? []

  // 2. Données de santé scolaire et conseils IA
  const healthCacheKey = userId ? `parent:health-tracking:${userId}` : ''
  const fetchHealth = useCallback(async () => {
    const res = await fetchApi('/api/v2/ai/health-tracking', { credentials: 'include' }).then(r => r.json())
    return (res.children ?? []) as HealthTrackingChild[]
  }, [userId])
  const { data: healthRaw, loading } = useCachedFetch<HealthTrackingChild[]>(healthCacheKey, fetchHealth)
  const healthData = healthRaw ?? []

  // Synchronisation de l'enfant sélectionné
  useEffect(() => {
    if (!selectedStudentId && childrenList.length > 0) {
      setSelectedStudentId(childrenList[0].studentId)
    }
  }, [selectedStudentId, childrenList])

  const currentChild = childrenList.find(c => c.studentId === selectedStudentId) || childrenList[0]
  const currentHealth = healthData.find(h => h.studentId === (currentChild?.studentId || selectedStudentId))

  if (loading && (!childrenList.length || !healthData.length)) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-xs font-semibold text-[var(--text3)]">
        Chargement du suivi scolaire et de santé…
      </div>
    )
  }

  if (!childrenList.length) {
    return (
      <div className="p-6 text-center text-xs text-[var(--text3)]">
        Aucun enfant rattaché à votre compte.
      </div>
    )
  }

  const score = currentHealth?.healthScore ?? currentChild?.indiceSante ?? 75
  const alertLevel = currentHealth?.alertLevel ?? (score < 40 ? 'critical' : score < 65 ? 'warning' : 'good')

  const scoreColor = alertLevel === 'critical' ? 'var(--red)' : alertLevel === 'warning' ? 'var(--amber)' : 'var(--green)'
  const scoreBg = alertLevel === 'critical' ? 'var(--red-light)' : alertLevel === 'warning' ? 'var(--amber-light)' : 'var(--green-light)'
  const levelLabel = alertLevel === 'critical' ? 'Alerte critique' : alertLevel === 'warning' ? 'Vigilance requise' : 'Évolution favorable'

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-4 sm:space-y-6 max-w-4xl mx-auto" style={{ overflowY: 'auto', height: '100%' }}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          <div style={sTitle}>Indice de Santé Scolaire & Recommandations</div>
          <div style={sSub}>Évaluation continue de la progression, de l&apos;assiduité et du bien-être scolaire par les algorithmes de suivi</div>
        </div>
      </div>

      {/* Sélecteur d'enfant si le parent en a plusieurs */}
      {childrenList.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {childrenList.map((child) => {
            const isSel = child.studentId === currentChild?.studentId
            return (
              <button
                key={child.studentId}
                onClick={() => setSelectedStudentId(child.studentId)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  isSel ? 'shadow-sm text-white' : 'hover:bg-[var(--bg2)] text-[var(--text2)]'
                }`}
                style={{
                  background: isSel ? 'linear-gradient(135deg,var(--primary),var(--accent))' : 'var(--surface)',
                  borderColor: isSel ? 'transparent' : 'var(--border)',
                }}
              >
                <Users size={13} />
                <span>{child.prenom} {child.nom}</span>
                <span className="text-[10px] opacity-80">({child.classeNom || '—'})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Carte principale de la note sur 100 */}
      <div
        className="rounded-2xl border p-4 sm:p-6 shadow-xs transition-all"
        style={{ background: 'var(--surface)', borderColor: alertLevel === 'critical' ? 'var(--red)' : 'var(--border)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
          {/* Cercle Score sur 100 */}
          <div className="flex items-center gap-4">
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: scoreBg,
                border: `3px solid ${scoreColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                fontWeight: 900,
                color: scoreColor,
                flexShrink: 0,
              }}
            >
              {score}
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-[var(--text3)] mb-1 flex items-center gap-1.5">
                <HeartPulse size={13} style={{ color: scoreColor }} /> Score Global sur 100
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-black inline-block"
                style={{ background: scoreBg, color: scoreColor }}
              >
                {levelLabel}
              </span>
              <div className="text-xs text-[var(--text3)] mt-1">
                Calculé pour <strong style={{ color: 'var(--text)' }}>{currentChild?.prenom} {currentChild?.nom}</strong> ({currentChild?.classeNom || '—'})
              </div>
            </div>
          </div>

          <div className="sm:ml-auto text-xs text-[var(--text3)] sm:text-right">
            <div>Mise à jour algorithmique continue</div>
            <div className="text-[11px] font-medium text-[var(--text3)]">Basé sur notes, absences, retards et devoirs</div>
          </div>
        </div>

        {/* Détails des composantes algorithmiques */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5">
          <div className="p-3.5 rounded-xl border bg-[var(--bg)] border-[var(--border)]">
            <div className="text-[11px] font-bold text-[var(--text3)] flex items-center justify-between">
              <span>Assiduité globale</span>
              <Activity size={13} className="text-[var(--primary)]" />
            </div>
            <div className="text-lg font-black mt-1" style={{ color: (currentChild?.tauxPresence ?? 100) >= 90 ? 'var(--green)' : 'var(--amber)' }}>
              {currentChild?.tauxPresence ?? 100}%
            </div>
            <div className="text-[10.5px] text-[var(--text3)] mt-0.5">
              {currentChild?.joursAbsent ?? 0} jour(s) d&apos;absence recensé(s)
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-[var(--bg)] border-[var(--border)]">
            <div className="text-[11px] font-bold text-[var(--text3)] flex items-center justify-between">
              <span>Ponctualité</span>
              <ShieldCheck size={13} className="text-[var(--primary)]" />
            </div>
            <div className="text-lg font-black mt-1" style={{ color: (currentChild?.tauxPonctualite ?? 100) >= 90 ? 'var(--green)' : 'var(--amber)' }}>
              {currentChild?.tauxPonctualite ?? 100}%
            </div>
            <div className="text-[10.5px] text-[var(--text3)] mt-0.5">
              Respect des horaires d&apos;entrée
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-[var(--bg)] border-[var(--border)]">
            <div className="text-[11px] font-bold text-[var(--text3)] flex items-center justify-between">
              <span>Dernière moyenne</span>
              <TrendingUp size={13} className="text-[var(--primary)]" />
            </div>
            <div className="text-lg font-black mt-1" style={{ color: (currentChild?.dernieereMoyenne ?? 0) >= 12 ? 'var(--green)' : (currentChild?.dernieereMoyenne ?? 0) >= 10 ? 'var(--blue)' : 'var(--red)' }}>
              {currentChild?.dernieereMoyenne !== undefined && currentChild?.dernieereMoyenne !== null ? `${currentChild.dernieereMoyenne.toFixed(1)}/20` : '—'}
            </div>
            <div className="text-[10.5px] text-[var(--text3)] mt-0.5">
              Mention : {currentChild?.derniereeMention || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Conseil IA & Analyse Pédagogique */}
      <div className="rounded-2xl border p-4 sm:p-5 shadow-xs" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-black m-0" style={{ color: 'var(--text)' }}>
            Conseil & Analyse Personnalisée pour les Parents
          </h3>
        </div>

        {currentHealth?.conseil ? (
          <div className="p-4 rounded-xl border leading-relaxed text-xs sm:text-sm font-medium" style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text2)' }}>
            {currentHealth.conseil}
            {currentHealth.conseilDate && (
              <div className="text-[11px] font-semibold text-[var(--text3)] mt-2 flex items-center gap-1.5">
                <Calendar size={11} /> Recommandation émise le {new Date(currentHealth.conseilDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl text-center text-xs text-[var(--text3)] bg-[var(--bg2)]">
            Aucun conseil particulier à signaler pour le moment. L&apos;état général de l&apos;élève est sous observation normale.
          </div>
        )}

        {/* Bouton vers le profil académique complet */}
        <div className="mt-4 pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs text-[var(--text3)]">
            Pour analyser la trajectoire par matière et par trimestre :
          </span>
          <button
            type="button"
            onClick={() => onNav?.('academic-profile')}
            className="h-8 px-3.5 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 cursor-pointer transition-colors"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border2)', color: 'var(--text)' }}
          >
            <TrendingUp size={13} className="text-[var(--primary)]" />
            Consulter le profil académique
          </button>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
