'use client'

import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'
import { DAY_NAMES, DEFAULT_DAYS, DEFAULT_SKELETON } from './timetable/timetableHelpers'
import { useParentTimetable } from './timetable/useParentTimetable'
import TimetableMobileView from './timetable/TimetableMobileView'
import TimetableDesktopGrid from './timetable/TimetableDesktopGrid'

export type { PeriodeGrille } from './timetable/types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

function CacheBadge({ cachedAt, label }: { cachedAt: number | null; label: string }) {
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
      {label.replace('{date}', date)}
    </div>
  )
}

export default function SectionParentTimetable({ userId }: Props) {
  const t = useT('parent')
  const {
    timetable,
    loading,
    error,
    fromCache,
    cachedAt,
    refetch,
    selectedChild,
    setSelectedChild,
    selectedDay,
    setSelectedDay,
  } = useParentTimetable(userId)

  const getWeekRange = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1)
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return t('timetable.weekRange').replace('{start}', fmt(monday)).replace('{end}', fmt(friday))
  }

  if (loading && !timetable) {
    return (
      <div style={{ padding: '20px 24px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{t('loading')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE' && !timetable) return <OfflineEmptyState />

  if (error && !timetable) {
    return (
      <div className="px-3.5 py-3.5 sm:px-6 sm:py-5" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button
            onClick={refetch}
            className="h-10 sm:h-9 px-4"
            style={{ borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  const children = timetable?.children ?? []
  const child = children[selectedChild]
  const slots = child ? (timetable?.slotsByChild[child.studentId] ?? {}) : {}
  const className = child ? (timetable?.classNames[child.studentId] ?? '') : ''
  const squelette = timetable?.squelette ?? DEFAULT_SKELETON
  const joursActifs = timetable?.joursActifs ?? DEFAULT_DAYS
  const squeletteParJour = timetable?.squeletteParJour ?? {}

  const activeDayName = DAY_NAMES[selectedDay] || 'LUNDI'
  const activeDayPeriods = squeletteParJour[activeDayName] || squelette

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: fromCache ? 4 : 8 }}>
        <div style={sTitle}>{t('timetable.title')}</div>
        <div style={sSub}>{className} · {getWeekRange()}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}

      {/* Sélecteur d'enfant tactile */}
      {children.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {children.map((c, i) => {
            const active = selectedChild === i
            return (
              <button
                key={c.studentId}
                onClick={() => setSelectedChild(i)}
                className="h-10 sm:h-9 px-3.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                style={{
                  border: '1.5px solid',
                  borderColor: active ? 'var(--primary)' : 'var(--border)',
                  background: active ? 'var(--primary-light)' : 'var(--surface)',
                  color: active ? 'var(--primary)' : 'var(--text2)',
                }}
              >
                {c.prenom} {c.nom}
              </button>
            )
          })}
        </div>
      )}

      <TimetableMobileView
        joursActifs={joursActifs}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        activeDayPeriods={activeDayPeriods}
        slots={slots}
      />

      <TimetableDesktopGrid
        joursActifs={joursActifs}
        squelette={squelette}
        squeletteParJour={squeletteParJour}
        slots={slots}
      />
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
