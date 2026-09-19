'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Clock, CheckCircle2, Sparkles, PartyPopper } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface AcademicEvent {
  id: string
  title: string
  type: string
  startDate: string
  endDate?: string
  status?: string
}

export default function CalendarProgressModal({ isOpen, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<AcademicEvent[]>([])
  const [activeYearName, setActiveYearName] = useState('2026-2027')
  const [progressPercent, setProgressPercent] = useState(15)
  const [daysElapsed, setDaysElapsed] = useState(25)
  const [totalDays, setTotalDays] = useState(280)

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    async function loadCalendarInfo() {
      try {
        setLoading(true)
        const [resYears, resEvents] = await Promise.allSettled([
          fetchApi('/api/v2/academic-years'),
          fetchApi('/api/v2/academic-events').then(async (r) => {
            if (!r.ok) return fetchApi('/api/v2/academic-events/active')
            return r
          }),
        ])

        if (!isMounted) return

        if (resYears.status === 'fulfilled' && resYears.value.ok) {
          const data = await resYears.value.json()
          const years = data.data || []
          const current = years.find((y: { isCurrent?: boolean }) => y.isCurrent) || years[0]
          if (current) {
            setActiveYearName(current.name || '2026-2027')
            if (current.startDate && current.endDate) {
              const start = new Date(current.startDate)
              const end = new Date(current.endDate)
              const now = new Date()
              const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)))
              const elapsed = Math.max(0, Math.min(total, Math.round((now.getTime() - start.getTime()) / (1000 * 3600 * 24))))
              const pct = Math.round((elapsed / total) * 100)
              setTotalDays(total)
              setDaysElapsed(elapsed)
              setProgressPercent(pct)
            }
          }
        }

        if (resEvents.status === 'fulfilled' && resEvents.value.ok) {
          const data = await resEvents.value.json()
          setEvents(data.data || [])
        }
      } catch (err) {
        console.error('Erreur chargement calendrier:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadCalendarInfo()
    return () => { isMounted = false }
  }, [isOpen])

  if (!isOpen) return null

  // Événements par défaut si aucun retourné par l'API
  const displayEvents: AcademicEvent[] = events.length > 0 ? events : [
    { id: '1', title: 'Rentrée Scolaire Nationale', type: 'RENTREE', startDate: '2026-09-01', status: 'COMPLETED' },
    { id: '2', title: 'Séquence 1 - Évaluations', type: 'EXAMEN', startDate: '2026-10-15', endDate: '2026-10-20', status: 'ACTIVE' },
    { id: '3', title: 'Congés du 1er Trimestre', type: 'CONGE', startDate: '2026-10-30', endDate: '2026-11-02', status: 'UPCOMING' },
    { id: '4', title: 'Fêtes de Fin d\'Année & Noël', type: 'HOLIDAY', startDate: '2026-12-18', endDate: '2027-01-04', status: 'UPCOMING' },
    { id: '5', title: 'Fête de la Jeunesse', type: 'HOLIDAY', startDate: '2027-02-11', status: 'UPCOMING' },
    { id: '6', title: 'Examens Blancs & PEBS', type: 'EXAMEN', startDate: '2027-05-10', endDate: '2027-05-20', status: 'UPCOMING' },
    { id: '7', title: 'Grandes Vacances & Clôture', type: 'CLOTURE', startDate: '2027-06-30', status: 'UPCOMING' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-nunito">
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
      >
        {/* Header Modal */}
        <div
          className="p-4 sm:p-5 border-b flex items-center justify-between gap-2"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex-shrink-0">
              <Calendar size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  Suivi Temps Réel
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold font-spectral" style={{ color: 'var(--text)' }}>
                Progression de l'Année Scolaire {activeYearName}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer border-none bg-transparent flex-shrink-0"
            style={{ color: 'var(--text2)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenu Modal */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {/* Progression Jauge */}
          <div className="p-4 rounded-xl border space-y-3" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--text)' }}>
              <span>Avancement Annuel ({progressPercent}%)</span>
              <span style={{ color: 'var(--text2)' }}>{daysElapsed} / {totalDays} jours écoulés</span>
            </div>
            
            {/* Jauge visuelle */}
            <div className="w-full h-3 rounded-full overflow-hidden bg-black/10 dark:bg-white/10 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(5, progressPercent)}%`,
                  background: 'linear-gradient(90deg, var(--green), #3b82f6)',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text3)' }}>
              <span>Rentrée : 01 Septembre</span>
              <span>Clôture : 30 Juin</span>
            </div>
          </div>

          {/* Calendrier des événements & Congés */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <PartyPopper size={18} className="text-amber-500" />
              Jours Fériés, Congés & Étapes Académiques
            </h3>

            <div className="space-y-2">
              {displayEvents.map((item) => {
                const isPassed = item.status === 'COMPLETED'
                const isActive = item.status === 'ACTIVE'
                return (
                  <div
                    key={item.id}
                    className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                      isPassed ? 'opacity-60 bg-black/5 dark:bg-white/5' : isActive ? 'bg-blue-500/10 border-blue-500/30' : ''
                    }`}
                    style={{
                      background: !isPassed && !isActive ? 'var(--surface)' : undefined,
                      borderColor: !isActive ? 'var(--border)' : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      {isPassed ? (
                        <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                      ) : isActive ? (
                        <Sparkles size={18} className="text-blue-500 flex-shrink-0 animate-pulse" />
                      ) : (
                        <Clock size={18} className="text-amber-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate sm:whitespace-normal ${isPassed ? 'line-through' : ''}`} style={{ color: 'var(--text)' }}>
                          {item.title}
                        </p>
                        <p className="text-[11px] truncate sm:whitespace-normal" style={{ color: 'var(--text2)' }}>
                          {item.startDate} {item.endDate ? `au ${item.endDate}` : ''}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[9.5px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded flex-shrink-0 ml-1 ${
                        isPassed
                          ? 'bg-gray-500/15 text-gray-500'
                          : isActive
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {isPassed ? 'Terminé' : isActive ? 'En Cours' : 'À Venir'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t flex items-center justify-end" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white border-none cursor-pointer"
            style={{ background: 'var(--green)' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
