'use client'

import { useState, useEffect } from 'react'
import {
  School, Users, BookOpen, Calendar, UserPlus, ArrowRight,
  Sparkles, Activity, AlertTriangle, CheckCircle2, ShieldAlert
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type { AdminSection } from '../_types'

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
  const [showManagementGrid, setShowManagementGrid] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadHubData() {
      try {
        setLoading(true)

        // Charger en parallèle les statistiques et les activités récentes
        const [resClasses, resTimeline] = await Promise.allSettled([
          fetchApi('/api/v2/classes'),
          fetchApi('/api/v2/activities/timeline?limit=6'),
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
      desc: 'Gestion des niveaux, séries, professeurs principaux et effectifs par classe.',
      icon: School,
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
    },
    {
      id: 'users' as AdminSection,
      title: 'Utilisateurs & Fiches',
      desc: 'Annuaire des élèves, enseignants, membres du staff et comptes parents.',
      icon: Users,
      color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-400',
    },
    {
      id: 'subjects' as AdminSection,
      title: 'Matières & Coefficients',
      desc: 'Volume horaire, groupes de matières et barème d’évaluation.',
      icon: BookOpen,
      color: 'from-indigo-500/20 to-purple-500/10 border-indigo-500/30 text-indigo-400',
    },
    {
      id: 'timetable' as AdminSection,
      title: 'Emplois du temps',
      desc: 'Supervision et affectation des salles, créneaux et plages de cours.',
      icon: Calendar,
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
    },
    {
      id: 'eleve-onboarding' as AdminSection,
      title: 'Onboarding & Inscriptions',
      desc: 'Attribution de matricules et inscription rapide des nouveaux admis.',
      icon: UserPlus,
      color: 'from-pink-500/20 to-rose-500/10 border-pink-500/30 text-pink-400',
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* En-tête de supervision */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/10 via-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-3">
              <Sparkles size={14} />
              <span>Espace de Supervision Directoriale</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white font-spectral">
              Organisation Pédagogique
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Vue d’ensemble de la structure scolaire. Validez les équilibres pédagogiques, suivez les activités récentes et intervenez sur la configuration de l’établissement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowManagementGrid(!showManagementGrid)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>{showManagementGrid ? 'Masquer la grille' : 'Gérer l’organisation'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Cartes KPI de supervision */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Classes Actives</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <School size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {loading ? '...' : stats.classesCount}
          </div>
          <p className="text-slate-400 text-xs mt-1">Structure pédagogique</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Matières & Programmes</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <BookOpen size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            Configuré
          </div>
          <p className="text-slate-400 text-xs mt-1">Coefficients & Volumes</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Professeurs Principaux</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            Suivi actif
          </div>
          <p className="text-slate-400 text-xs mt-1">Supervisé par le Censeur</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">État Général</span>
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
              <Activity size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            Opérationnel
          </div>
          <p className="text-slate-400 text-xs mt-1">Aucun blocage critique</p>
        </div>
      </div>

      {/* Grille de gestion des modules (visible au clic "Gérer l'organisation" ou toujours accessible) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Modules de Gestion & Intervention</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(mod => {
            const Icon = mod.icon
            return (
              <div
                key={mod.id}
                onClick={() => onNav(mod.id)}
                className={`group bg-slate-900/60 border rounded-xl p-5 hover:bg-slate-800/80 transition-all cursor-pointer flex flex-col justify-between ${mod.color}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700">
                      <Icon size={20} />
                    </div>
                    <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-slate-300" />
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-amber-400/90">
                  <span>Accéder au module</span>
                  <span className="text-slate-500">&rarr;</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Points d'attention & Activité récente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Points d'attention */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <span>Points d’attention</span>
          </h3>
          <div className="space-y-2.5 text-xs text-slate-300">
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-start gap-2.5">
              <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Affectations de cours</p>
                <p className="text-slate-400 mt-0.5">Vérifiez les volumes horaires attribués aux enseignants.</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-start gap-2.5">
              <ShieldAlert size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Professeurs Principaux</p>
                <p className="text-slate-400 mt-0.5">Assurez-vous que chaque classe a un professeur principal désigné.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activité récente */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity size={16} className="text-emerald-400" />
            <span>Dernières activités d’organisation</span>
          </h3>

          {loading ? (
            <div className="text-xs text-slate-500 py-4 text-center">Chargement des activités...</div>
          ) : activities.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">Aucune activité récente enregistrée.</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {activities.map((act) => (
                <div key={act.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-slate-200">{act.action}</span>
                    {act.details && <span className="text-slate-400 ml-2">({act.details})</span>}
                    {act.user?.nomComplet && (
                      <span className="text-slate-500 block text-[11px]">Par : {act.user.nomComplet}</span>
                    )}
                  </div>
                  <span className="text-slate-500 text-[11px] font-mono">
                    {new Date(act.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
