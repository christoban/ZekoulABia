'use client'

import { useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import CalendarProgressModal from '@/components/CalendarProgressModal'

interface Props {
  className?: string
}

export default function CalendarTopbarButton({ className = '' }: Props) {
  const { lang } = useLanguage()
  const [modalOpen, setModalOpen] = useState(false)
  const [todayLabel, setTodayLabel] = useState(() => {
    try {
      const loc = lang === 'en' ? 'en-US' : 'fr-FR'
      const str = new Intl.DateTimeFormat(loc, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date())
      return str.charAt(0).toUpperCase() + str.slice(1)
    } catch {
      return ''
    }
  })

  useEffect(() => {
    try {
      const loc = lang === 'en' ? 'en-US' : 'fr-FR'
      const str = new Intl.DateTimeFormat(loc, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date())
      setTodayLabel(str.charAt(0).toUpperCase() + str.slice(1))
    } catch {
      setTodayLabel('')
    }
  }, [lang])

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        type="button"
        aria-label="Calendrier scolaire & Progression"
        title="Visualiser le calendrier et la progression de l'année"
        className={`inline-flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all cursor-pointer group flex-shrink-0 ${className}`}
        style={{
          background: 'rgba(37, 99, 235, 0.08)',
          borderColor: 'rgba(37, 99, 235, 0.22)',
        }}
      >
        <div
          className="w-7 h-7 sm:w-5 sm:h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
          style={{
            background: 'rgba(37, 99, 235, 0.15)',
            color: '#2563eb',
          }}
        >
          <Calendar size={15} strokeWidth={2.3} />
        </div>
        {todayLabel && (
          <span className="hidden sm:inline text-[11.5px] md:text-[12px] font-bold text-[var(--text2)] tracking-tight pr-0.5">
            {todayLabel}
          </span>
        )}
      </button>

      <CalendarProgressModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
