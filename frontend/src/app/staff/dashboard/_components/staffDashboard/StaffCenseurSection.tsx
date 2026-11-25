'use client'

import {
  GraduationCap, CheckCircle2, BookOpen, AlertTriangle, Clock,
  ArrowRight, UserCheck, Users, AlertCircle,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { StaffSection } from '../../_types'
import type { CenseurSummary } from './staffDashboardTypes'

interface Props {
  censeur: CenseurSummary
  onNav: (s: StaffSection) => void
}

export default function StaffCenseurSection({ censeur, onNav }: Props) {
  const t = useT('staff')

  return (
    <div className="space-y-4">
      {/* Bandeau d'état de la rentrée pédagogique */}
      {!censeur.gridConfigured ? (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <span className="font-extrabold text-sm md:text-base text-[var(--text)]">
                Configuration de la grille horaire requise
              </span>
              <p className="text-xs text-[var(--text3)] mt-0.5">
                Définissez les créneaux, pauses et volumes horaires journaliers pour activer la génération automatique des emplois du temps.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNav('configuration')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--primary)] text-white hover:opacity-95 transition-all flex-shrink-0"
          >
            Configurer la grille &rarr;
          </button>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between text-xs text-[var(--text3)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-success flex-shrink-0" />
            <span className="font-semibold text-[var(--text)]">
              {t('dashboard.censeurTitle')} : structure académique active et opérationnelle.
            </span>
          </div>
          <button onClick={() => onNav('timetable')} className="font-bold text-[var(--primary)] hover:underline">
            Ouvrir l&apos;emploi du temps &rarr;
          </button>
        </div>
      )}

      {/* 6 Cartes d'indicateurs pédagogiques clés */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <div
          onClick={() => onNav('classes')}
          className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-xs font-bold">{t('dashboard.activeClasses')}</span>
            <BookOpen size={15} />
          </div>
          <div className="text-2xl font-black text-[var(--text)]">{censeur.activeClassesCount}</div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
            {t('dashboard.activeClassesDesc', { count: censeur.activeClassesCount })}
          </div>
        </div>

        <div
          onClick={() => onNav('classes')}
          className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between ${
            censeur.classesWithoutPPCount > 0
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-[var(--border)] bg-[var(--surface)]'
          }`}
        >
          <div className={`flex items-center justify-between mb-1 ${censeur.classesWithoutPPCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-success'}`}>
            <span className="text-xs font-bold">{t('dashboard.classesWithoutPP')}</span>
            <Users size={15} />
          </div>
          <div className={`text-2xl font-black ${censeur.classesWithoutPPCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--text)]'}`}>
            {censeur.classesWithoutPPCount}
          </div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
            {t('dashboard.classesWithoutPPDesc', { count: censeur.classesWithoutPPCount })}
          </div>
        </div>

        <div
          onClick={() => onNav('affectations')}
          className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between ${
            censeur.unassignedSubjectsCount > 0
              ? 'border-red-500/40 bg-red-500/10'
              : 'border-[var(--border)] bg-[var(--surface)]'
          }`}
        >
          <div className={`flex items-center justify-between mb-1 ${censeur.unassignedSubjectsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-success'}`}>
            <span className="text-xs font-bold">{t('dashboard.unassignedSubjects')}</span>
            <AlertTriangle size={15} />
          </div>
          <div className={`text-2xl font-black ${censeur.unassignedSubjectsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--text)]'}`}>
            {censeur.unassignedSubjectsCount}
          </div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
            {t('dashboard.unassignedSubjectsDesc', { count: censeur.unassignedSubjectsCount })}
          </div>
        </div>

        <div
          onClick={() => onNav('council')}
          className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
            <span className="text-xs font-bold">{t('dashboard.councilsOpen')}</span>
            <GraduationCap size={15} />
          </div>
          <div className="text-2xl font-black text-[var(--text)]">{censeur.openCouncilsCount}</div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
            {t('dashboard.councilsOpenDesc', { count: censeur.openCouncilsCount })}
          </div>
        </div>

        <div
          onClick={() => onNav('anonymat')}
          className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
            <span className="text-xs font-bold">{t('dashboard.examsAnonymat')}</span>
            <UserCheck size={15} />
          </div>
          <div className="text-2xl font-black text-[var(--text)]">{censeur.activeAnonymatSessionsCount}</div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
            {t('dashboard.examsAnonymatDesc', { count: censeur.activeAnonymatSessionsCount })}
          </div>
        </div>

        <div
          onClick={() => onNav('suivi-eleves')}
          className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between ${
            censeur.studentsAtRiskCount > 0
              ? 'border-orange-500/40 bg-orange-500/10'
              : 'border-[var(--border)] bg-[var(--surface)]'
          }`}
        >
          <div className={`flex items-center justify-between mb-1 ${censeur.studentsAtRiskCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-success'}`}>
            <span className="text-xs font-bold">{t('dashboard.academicVigilance')}</span>
            <AlertCircle size={15} />
          </div>
          <div className={`text-2xl font-black ${censeur.studentsAtRiskCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--text)]'}`}>
            {censeur.studentsAtRiskCount}
          </div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
            {t('dashboard.academicVigilanceDesc', { count: censeur.studentsAtRiskCount })}
          </div>
        </div>
      </div>

      {/* 2 Colonnes: Priorités Pédagogiques (2/3) + Raccourcis Direction des Études (1/3) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        <div className="md:col-span-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-primary" />
              <span className="font-extrabold text-sm text-[var(--text)]">{t('dashboard.censeurPriorities')}</span>
            </div>
            <span className="text-[11px] text-[var(--text3)] font-semibold">{t('dashboard.censeurPrioritiesSubtitle')}</span>
          </div>

          <div className="space-y-2">
            {censeur.unassignedSubjectsCount > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-red-500/20 bg-red-500/5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400" />
                  <span className="font-semibold text-[var(--text)]">
                    {censeur.unassignedSubjectsCount} matière{censeur.unassignedSubjectsCount > 1 ? 's' : ''} sans enseignant affecté nécessitent votre arbitrage
                  </span>
                </div>
                <button onClick={() => onNav('affectations')} className="font-bold text-red-600 dark:text-red-400 hover:underline">
                  Affecter &rarr;
                </button>
              </div>
            )}

            {censeur.classesWithoutPPCount > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                  <span className="text-[var(--text2)]">
                    {censeur.classesWithoutPPCount} classe{censeur.classesWithoutPPCount > 1 ? 's' : ''} sans Professeur Principal désigné
                  </span>
                </div>
                <button onClick={() => onNav('classes')} className="font-bold text-amber-600 dark:text-amber-400 hover:underline">
                  Désigner &rarr;
                </button>
              </div>
            )}

            {censeur.openCouncilsCount > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400" />
                  <span className="text-[var(--text2)]">
                    {censeur.openCouncilsCount} session{censeur.openCouncilsCount > 1 ? 's' : ''} de conseil de classe à délibérer
                  </span>
                </div>
                <button onClick={() => onNav('council')} className="font-bold text-purple-600 dark:text-purple-400 hover:underline">
                  Délibérer &rarr;
                </button>
              </div>
            )}

            {censeur.studentsAtRiskCount > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400" />
                  <span className="text-[var(--text2)]">
                    {censeur.studentsAtRiskCount} élève{censeur.studentsAtRiskCount > 1 ? 's' : ''} signalé{censeur.studentsAtRiskCount > 1 ? 's' : ''} en risque ou décrochage scolaire
                  </span>
                </div>
                <button onClick={() => onNav('suivi-eleves')} className="font-bold text-orange-600 dark:text-orange-400 hover:underline">
                  Consulter &rarr;
                </button>
              </div>
            )}

            {censeur.unassignedSubjectsCount === 0 && censeur.classesWithoutPPCount === 0 && censeur.openCouncilsCount === 0 && censeur.studentsAtRiskCount === 0 && (
              <div className="p-3 text-center text-xs text-[var(--text3)]">
                Structure pédagogique équilibrée. Aucun arbitrage urgent requis.
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
          <span className="font-extrabold text-sm text-[var(--text)] block pb-2 border-b border-[var(--border)]">
            {t('dashboard.censeurShortcuts')}
          </span>
          <div className="space-y-1.5 text-xs font-semibold">
            <button
              onClick={() => onNav('timetable')}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
            >
              <span className="flex items-center gap-2"><Clock size={14} className="text-blue-500 dark:text-blue-400" /> {t('dashboard.manageTimetables')}</span>
              <ArrowRight size={13} className="text-[var(--text3)]" />
            </button>
            <button
              onClick={() => onNav('affectations')}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
            >
              <span className="flex items-center gap-2"><Users size={14} className="text-primary" /> {t('dashboard.manageAssignments')}</span>
              <ArrowRight size={13} className="text-[var(--text3)]" />
            </button>
            <button
              onClick={() => onNav('council')}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
            >
              <span className="flex items-center gap-2"><GraduationCap size={14} className="text-purple-500 dark:text-purple-400" /> {t('dashboard.manageCouncils')}</span>
              <ArrowRight size={13} className="text-[var(--text3)]" />
            </button>
            <button
              onClick={() => onNav('anonymat')}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
            >
              <span className="flex items-center gap-2"><UserCheck size={14} className="text-indigo-500 dark:text-indigo-400" /> {t('dashboard.manageAnonymat')}</span>
              <ArrowRight size={13} className="text-[var(--text3)]" />
            </button>
            <button
              onClick={() => onNav('classes')}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
            >
              <span className="flex items-center gap-2"><BookOpen size={14} className="text-emerald-500 dark:text-emerald-400" /> {t('dashboard.manageClasses')}</span>
              <ArrowRight size={13} className="text-[var(--text3)]" />
            </button>
            <button
              onClick={() => onNav('suivi-eleves')}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
            >
              <span className="flex items-center gap-2"><AlertCircle size={14} className="text-orange-500 dark:text-orange-400" /> {t('dashboard.studentFollowUp')}</span>
              <ArrowRight size={13} className="text-[var(--text3)]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
