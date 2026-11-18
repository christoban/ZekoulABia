'use client'

import { CalendarClock, ArrowRight, BookOpen, School, Sparkles, GraduationCap } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface AcademicEventsEmptyStateProps {
  onPlanEvent: (typePreset: string) => void
}

export default function AcademicEventsEmptyState({ onPlanEvent }: AcademicEventsEmptyStateProps) {
  const t = useT('admin')

  return (
    <div className="flex flex-col gap-4">
      <div
        className="px-4 py-8 md:px-6 md:py-10 rounded-xl border border-[var(--border)]"
        style={{ background: 'var(--surface)', textAlign: 'center' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <CalendarClock size={36} className="text-purple-600 dark:text-purple-300" />
        </div>
        <div className="text-sm md:text-base font-bold text-[var(--text)] mb-1">
          {t('academicEvents.emptyTitle')}
        </div>
        <div className="text-xs md:text-[13px] text-[var(--text3)] max-w-[480px] mx-auto mb-5">
          {t('academicEvents.emptySub')}
        </div>
      </div>

      {/* Suggestions Cards */}
      <div className="rounded-xl border border-[var(--border)] p-4 md:p-5" style={{ background: 'var(--surface)' }}>
        <h3 className="font-bold text-xs md:text-sm text-[var(--text)] mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600 dark:text-purple-300" /> {t('academicEvents.suggestionsTitle')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Suggestion 1: Concours 6e */}
          <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-300">
                  <GraduationCap size={16} />
                </div>
                <span className="font-bold text-xs text-[var(--text)]">
                  {t('academicEvents.suggestionConcours6e')}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text3)] leading-relaxed">
                {t('academicEvents.suggestionConcours6eDesc')}
              </p>
            </div>
            <button
              onClick={() => onPlanEvent('CONCOURS_ENTREE')}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              {t('academicEvents.planAction')} <ArrowRight size={13} />
            </button>
          </div>

          {/* Suggestion 2: Choix LV2 */}
          <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-300">
                  <BookOpen size={16} />
                </div>
                <span className="font-bold text-xs text-[var(--text)]">
                  {t('academicEvents.suggestionLv2')}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text3)] leading-relaxed">
                {t('academicEvents.suggestionLv2Desc')}
              </p>
            </div>
            <button
              onClick={() => onPlanEvent('CHOIX_LV2')}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              {t('academicEvents.planAction')} <ArrowRight size={13} />
            </button>
          </div>

          {/* Suggestion 3: Rentrée */}
          <div className="p-3.5 rounded-xl border border-success/20 bg-success/5 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-success/15 text-success">
                  <School size={16} />
                </div>
                <span className="font-bold text-xs text-[var(--text)]">
                  {t('academicEvents.suggestionRentree')}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text3)] leading-relaxed">
                {t('academicEvents.suggestionRentreeDesc')}
              </p>
            </div>
            <button
              onClick={() => onPlanEvent('RENTREE_6E_5E')}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              {t('academicEvents.planAction')} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
