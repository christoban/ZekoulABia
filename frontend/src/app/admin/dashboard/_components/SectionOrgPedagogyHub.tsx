'use client'

import { useState, useEffect } from 'react'
import {
  School, Users, BookOpen, Calendar, UserPlus, ArrowRight,
  Sparkles, Activity, AlertTriangle, CheckCircle2, ShieldAlert, CalendarClock
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type { AdminSection } from '../_types'
import ClotureAnneeModal from './ClotureAnneeModal'

interface Props {
  onNav: (section: AdminSection) => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface OrgStats {
  classesCount: number
  studentsCount: number
  teachersCount: number
  subjectsCount: number
}

interface ActivityItem {
  id: string
  action: string
  details?: string | null
  createdAt: string
  user?: { nomComplet?: string; firstName?: string } | null
}

export default function SectionOrgPedagogyHub({ onNav, onToast }: Props) {
  const [stats, setStats] = useState<OrgStats>({
    classesCount: 0,
    studentsCount: 0,
    teachersCount: 0,
    subjectsCount: 0,
  })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [clotureModalOpen, setClotureModalOpen] = useState(false)

  const [isClosingWindowActive, setIsClosingWindowActive] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadHubData() {
      try {
        setLoading(true)

        // Charger en parallèle les statistiques, activités récentes et l'état des années
        const [resClasses, resTimeline, resYears] = await Promise.allSettled([
          fetchApi('/api/v2/classes'),
          fetchApi('/api/v2/activities/timeline?limit=6'),
          fetchApi('/api/v2/academic-years'),
        ])

        if (!isMounted) return

        let classesCount = 0
        if (resClasses.status === 'fulfilled' && resClasses.value.ok) {
          const classesData = await resClasses.value.json()
          const list = Array.isArray(classesData) ? classesData : (classesData?.data || [])
          classesCount = list.length
        }

        let timelineList: ActivityItem[] = []
        if (resTimeline.status === 'fulfilled' && resTimeline.value.ok) {
          const timelineData = await resTimeline.value.json()
          const items = Array.isArray(timelineData) ? timelineData : (timelineData?.data || [])
          timelineList = items
        }

        if (resYears.status === 'fulfilled' && resYears.value.ok) {
          const yearsData = await resYears.value.json()
          const years = yearsData.data || []
          const current = years.find((y: any) => y.isCurrent)
          if (current) {
            // Seuil de proximité : uniquement dans la fenêtre de 6 semaines (42 jours) avant la clôture officielle
            const now = new Date()
            const end = current.endDate ? new Date(current.endDate) : null
            const diffDays = end ? (end.getTime() - now.getTime()) / (1000 * 3600 * 24) : 999
            setIsClosingWindowActive(diffDays > 0 && diffDays <= 42)
          }
        }

        setStats(prev => ({
          ...prev,
          classesCount,
        }))
        setActivities(timelineList)
      } catch (err) {
        console.error('Erreur chargement Hub Organisation Pédagogique:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadHubData()
    return () => { isMounted = false }
  }, [])

  const modules = [
    {
      id: 'classes' as AdminSection,
      title: 'Structure & Classes',
      desc: 'Niveaux, séries, affectations et professeurs principaux — Piloté par le Censeur',
      icon: School,
      accentColor: 'var(--green)',
      badgeBg: 'var(--green-light)',
      statusBadge: 'Structure & Titulaires',
      statusColor: 'var(--green)',
    },
    {
      id: 'pedagogie' as AdminSection,
      title: 'Programmes & Progressions',
      desc: 'Volume horaire, avancement des cours et alertes retard — Piloté par l’Animateur Pédagogique',
      icon: Sparkles,
      accentColor: 'var(--amber)',
      badgeBg: 'var(--amber-light)',
      statusBadge: 'Alertes Retard',
      statusColor: '#d97706',
    },
    {
      id: 'subjects' as AdminSection,
      title: 'Matières & Coefficients',
      desc: 'Volumes horaires et groupes de matières — Piloté par l’Animateur Pédagogique',
      icon: BookOpen,
      accentColor: '#6366f1',
      badgeBg: 'rgba(99,102,241,0.12)',
      statusBadge: 'Coefficients & Groupes',
      statusColor: '#4f46e5',
    },
    {
      id: 'timetable' as AdminSection,
      title: 'Emplois du temps',
      desc: 'Créneaux, salles et séances de cours — Piloté par le Censeur',
      icon: Calendar,
      accentColor: '#0284c7',
      badgeBg: 'rgba(2,132,199,0.12)',
      statusBadge: 'Publication EDT',
      statusColor: '#0284c7',
    },
    {
      id: 'eleve-onboarding' as AdminSection,
      title: 'Onboarding & Inscriptions',
      desc: 'Dossiers d’admissions et matricules élèves — Piloté par le Secrétaire',
      icon: UserPlus,
      accentColor: '#ec4899',
      badgeBg: 'rgba(236,72,153,0.12)',
      statusBadge: 'Dossiers Admissions',
      statusColor: '#db2777',
    },
    {
      id: 'users' as AdminSection,
      title: 'Utilisateurs & Annuaire',
      desc: 'Fiches et comptes Élèves, Enseignants, Staff & Parents — Supervision globale',
      icon: Users,
      accentColor: 'var(--text2)',
      badgeBg: 'var(--surface2)',
      statusBadge: 'Annuaire Transverse',
      statusColor: 'var(--text2)',
    },
  ]

  return (
    <div className="h-full overflow-y-auto p-4 md:p-5 space-y-4 max-w-7xl mx-auto pb-12 font-nunito">
      {/* En-tête de supervision */}
      <div
        className="rounded-xl p-4 md:p-5 relative overflow-hidden backdrop-blur-md shadow-sm"
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold mb-2"
              style={{
                background: 'var(--amber-light)',
                color: 'var(--amber)',
                border: '1px solid var(--amber)',
              }}
            >
              <Sparkles size={13} />
              <span>Espace de Supervision Directoriale</span>
            </div>
            <h1 className="text-[15px] md:text-[17px] font-bold font-spectral" style={{ color: 'var(--text)' }}>
              Organisation Pédagogique
            </h1>
            <p className="text-[11px] md:text-[12px] mt-0.5 max-w-2xl leading-relaxed" style={{ color: 'var(--text3)' }}>
              Vue d’ensemble de la structure scolaire. Validez les équilibres pédagogiques, suivez les activités récentes et intervenez sur la configuration de l’établissement.
            </p>
          </div>
        </div>
      </div>

      {/* BANNIÈRE CONTEXTUELLE SAISONNIÈRE (Catégorie D) - Déclencheur Temporel / État */}
      {isClosingWindowActive && (
        <div
          className="rounded-xl p-4 md:p-4.5 shadow-sm transition-all relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
            border: '1.5px solid var(--amber)',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg flex-shrink-0" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>
                <CalendarClock size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border" style={{ background: 'var(--amber-light)', color: 'var(--amber)', borderColor: 'var(--amber)' }}>
                    Fenêtre Saisonnière (Catégorie D)
                  </span>
                  <span className="text-[10.5px] font-bold text-blue-600 dark:text-blue-400">
                    Pattern Propose / Apply
                  </span>
                </div>
                <h3 className="text-sm md:text-base font-bold" style={{ color: 'var(--text)' }}>
                  Préparation & Clôture de l'Année Scolaire N+1
                </h3>
                <p className="text-xs mt-0.5 max-w-2xl leading-relaxed" style={{ color: 'var(--text2)' }}>
                  Le système a généré une proposition de structure (classes, niveaux, périodes). Validez ou ajustez les paramètres avant ouverture de la nouvelle rentrée.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
              <button
                onClick={() => setClotureModalOpen(true)}
                className="px-3.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer border-none"
                style={{ background: 'var(--amber)', color: '#ffffff' }}
              >
                <span>Accéder à la Clôture & Rentrée N+1</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cartes KPI de supervision */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          className="rounded-xl p-4 shadow-sm transition-all"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              Classes Actives
            </span>
            <div className="p-1.5 rounded-lg" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
              <School size={16} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold mt-1.5" style={{ color: 'var(--text)' }}>
            {loading ? '...' : `${stats.classesCount} classe(s)`}
          </div>
          <p className="text-[11.5px] mt-0.5 font-medium" style={{ color: 'var(--text2)' }}>
            Structure pédagogique
          </p>
        </div>

        <div
          className="rounded-xl p-4 shadow-sm transition-all"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              Matières & Programmes
            </span>
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
              <BookOpen size={16} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold mt-1.5" style={{ color: 'var(--text)' }}>
            Configuré
          </div>
          <p className="text-[11.5px] mt-0.5 font-medium" style={{ color: 'var(--text2)' }}>
            Coefficients & Volumes
          </p>
        </div>

        <div
          className="rounded-xl p-4 shadow-sm transition-all"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              Professeurs Principaux
            </span>
            <div className="p-1.5 rounded-lg" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold mt-1.5" style={{ color: 'var(--green)' }}>
            Suivi actif
          </div>
          <p className="text-[11.5px] mt-0.5 font-medium" style={{ color: 'var(--text2)' }}>
            Supervisé par le Censeur
          </p>
        </div>

        <div
          className="rounded-xl p-4 shadow-sm transition-all"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              État Général
            </span>
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(2,132,199,0.12)', color: '#0284c7' }}>
              <Activity size={16} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-extrabold mt-1.5" style={{ color: 'var(--text)' }}>
            Opérationnel
          </div>
          <p className="text-[11.5px] mt-0.5 font-medium" style={{ color: 'var(--text2)' }}>
            Aucun blocage critique
          </p>
        </div>
      </div>

      {/* Grille des modules d'intervention */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2 font-spectral" style={{ color: 'var(--text)' }}>
            <span>Modules de Gestion & Intervention</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {modules.map(mod => {
            const Icon = mod.icon
            return (
              <div
                key={mod.id}
                onClick={() => onNav(mod.id)}
                className="group rounded-xl p-4 transition-all cursor-pointer flex flex-col justify-between hover:shadow-md"
                style={{
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div
                      className="p-2 rounded-lg border"
                      style={{ background: mod.badgeBg, borderColor: 'var(--border)', color: mod.accentColor }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ background: mod.badgeBg, color: mod.statusColor, borderColor: 'var(--border)' }}>
                        {mod.statusBadge}
                      </span>
                      <ArrowRight
                        size={15}
                        className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                        style={{ color: 'var(--text2)' }}
                      />
                    </div>
                  </div>
                  <h3 className="text-sm md:text-base font-bold transition-colors group-hover:opacity-80" style={{ color: 'var(--text)' }}>
                    {mod.title}
                  </h3>
                  <p className="text-xs mt-1 leading-relaxed font-medium" style={{ color: 'var(--text2)' }}>
                    {mod.desc}
                  </p>
                </div>

                <div
                  className="mt-3 pt-2.5 border-t flex items-center justify-between text-xs font-bold"
                  style={{ borderColor: 'var(--border)', color: mod.accentColor }}
                >
                  <span>Accéder au module</span>
                  <span>&rarr;</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Points d'attention & Activité récente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Points d'attention */}
        <div
          className="rounded-xl p-4 space-y-2.5 shadow-sm"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
        >
          <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
            <AlertTriangle size={15} style={{ color: 'var(--amber)' }} />
            <span>Points d’attention</span>
          </h3>
          <div className="space-y-2.5 text-xs">
            <div
              className="p-3 rounded-lg flex items-start gap-2.5"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            >
              <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--green)' }} />
              <div>
                <p className="font-bold" style={{ color: 'var(--text)' }}>Affectations de cours</p>
                <p className="mt-0.5 font-medium" style={{ color: 'var(--text2)' }}>Vérifiez les volumes horaires attribués aux enseignants.</p>
              </div>
            </div>
            <div
              className="p-3 rounded-lg flex items-start gap-2.5"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            >
              <ShieldAlert size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--amber)' }} />
              <div>
                <p className="font-bold" style={{ color: 'var(--text)' }}>Professeurs Principaux</p>
                <p className="mt-0.5 font-medium" style={{ color: 'var(--text2)' }}>Assurez-vous que chaque classe a un professeur principal désigné.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activité récente */}
        <div
          className="lg:col-span-2 rounded-xl p-4 space-y-2.5 shadow-sm"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
        >
          <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
            <Activity size={15} style={{ color: 'var(--green)' }} />
            <span>Dernières activités d’organisation</span>
          </h3>

          {loading ? (
            <div className="text-xs py-4 text-center font-medium" style={{ color: 'var(--text3)' }}>
              Chargement des activités...
            </div>
          ) : activities.length === 0 ? (
            <div className="text-xs py-4 text-center font-medium" style={{ color: 'var(--text3)' }}>
              Aucune activité récente enregistrée.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {activities.map((act) => (
                <div key={act.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold" style={{ color: 'var(--text)' }}>{act.action}</span>
                    {act.details && <span className="ml-2 font-medium" style={{ color: 'var(--text2)' }}>({act.details})</span>}
                    {act.user?.nomComplet && (
                      <span className="block text-[11px] font-medium" style={{ color: 'var(--text3)' }}>Par : {act.user.nomComplet}</span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono font-bold" style={{ color: 'var(--text3)' }}>
                    {new Date(act.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Guidée de Clôture & Transition N+1 */}
      <ClotureAnneeModal
        isOpen={clotureModalOpen}
        onClose={() => setClotureModalOpen(false)}
        onToast={onToast}
      />
    </div>
  )
}
