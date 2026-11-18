'use client'
import { useState, useEffect, useCallback } from 'react'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import {
  CalendarClock,
  Plus,
  Zap,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import ModalNouvelEvenement from './academicEvents/ModalNouvelEvenement'
import AcademicEventsEmptyState from './academicEvents/AcademicEventsEmptyState'
import AcademicEventsList from './academicEvents/AcademicEventsList'
import {
  btnPrim,
  btnRetry,
  sSub,
  sTitle,
  type AcademicEvent,
} from './academicEvents/academicEventsStyles'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function SectionAdminAcademicEvents({ onToast }: Props) {
  const t = useT('admin')
  const [events, setEvents] = useState<AcademicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [initialType, setInitialType] = useState<string | undefined>(undefined)

  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustDate, setAdjustDate] = useState('')
  const [closingId, setClosingId] = useState<string | null>(null)

  // Garde préventive : vérifie si une année scolaire courante est configurée
  const [hasCurrentYear, setHasCurrentYear] = useState<boolean>(true)
  useEffect(() => {
    getCachedData<Array<{ isCurrent?: boolean }>>('admin:academic-years').then(c => {
      if (c?.data && Array.isArray(c.data)) {
        setHasCurrentYear(c.data.some((y) => y.isCurrent === true))
      }
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    fetchApi('/api/v2/academic-years', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setHasCurrentYear((d.data as Array<{ isCurrent?: boolean }>).some((y) => y.isCurrent === true))
          putCachedData('admin:academic-years', d.data).catch(() => {})
        }
      })
      .catch(() => {})
  }, [])

  const fetchEvents = useCallback(async () => {
    const cacheKey = 'admin:academic-events'
    const cached = await getCachedData<AcademicEvent[]>(cacheKey).catch(() => null)
    if (cached?.data && Array.isArray(cached.data)) {
      setEvents(cached.data)
      setLoading(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false)
      return
    }

    try {
      if (!cached?.data) setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/academic-events', { credentials: 'include' })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message || 'Erreur lors du chargement des événements')
      }
      const eventList = data.data || []
      setEvents(eventList)
      await putCachedData(cacheKey, eventList).catch(() => {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNet = (typeof navigator !== 'undefined' && !navigator.onLine) || msg.includes('fetch') || msg.includes('Network')
      if (isNet) {
        if (!cached?.data) setEvents([])
      } else if (!cached?.data) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des événements')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const openNewEventModal = (typePreset?: string) => {
    setInitialType(typePreset)
    setModalOpen(true)
  }

  const declencher = async (id: string) => {
    try {
      const res = await fetchApi(`/api/v2/academic-events/${id}/trigger`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('academicEvents.toastTriggered'), 'success')
      fetchEvents()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academicEvents.errorLoad'), 'error')
    }
  }

  const ajuster = async (id: string) => {
    if (!adjustDate) return
    try {
      const res = await fetchApi(`/api/v2/academic-events/${id}/window`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closeDate: adjustDate }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('academicEvents.toastAdjusted'), 'success')
      setAdjustingId(null)
      setAdjustDate('')
      fetchEvents()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academicEvents.errorLoad'), 'error')
    }
  }

  const cloturer = async (id: string) => {
    if (!(await confirmAction({ message: t('academicEvents.confirmClose'), danger: true }))) return
    try {
      setClosingId(id)
      const res = await fetchApi(`/api/v2/academic-events/${id}/close`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('academicEvents.toastClosed'), 'success')
      fetchEvents()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academicEvents.errorLoad'), 'error')
    } finally {
      setClosingId(null)
    }
  }

  const total = events.length
  const actifs = events.filter((e) => e.status === 'ACTIVE').length
  const aVenir = events.filter((e) => e.status === 'UPCOMING').length
  const clos = events.filter((e) => e.status === 'CLOSED').length

  return (
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div
        className="mb-[12px] md:mb-[14px]"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}
      >
        <div>
          <div className="text-[15px] md:text-[17px]" style={sTitle}>
            {t('academicEvents.title')} — Campagnes Saisonnières
          </div>
          <div className="text-[11px] md:text-[12px]" style={sSub}>
            {t('academicEvents.subtitle')}
          </div>
        </div>
        <button
          onClick={() => openNewEventModal()}
          className="rounded-lg text-xs md:text-[12.5px] px-3 py-1.5"
          style={{ ...btnPrim, fontWeight: 700 }}
        >
          <Plus size={14} strokeWidth={2.5} /> {t('academicEvents.newEvent')}
        </button>
      </div>

      {/* Avertissement : aucune année scolaire courante */}
      {!hasCurrentYear && (
        <div className="mb-3 p-2.5 md:p-3 rounded-lg border border-amber-500/40 bg-amber-500/8 text-xs flex items-start gap-2.5" style={{ color: 'var(--amber, #d97706)' }}>
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[11.5px] md:text-xs">Aucune année scolaire courante configurée</p>
            <p className="text-[10.5px] md:text-[11px] mt-0.5" style={{ color: 'var(--text2)' }}>
              La création d'un concours d'entrée requiert une année scolaire active. Configurez-en une depuis la section <strong>Année scolaire</strong> du tableau de bord.
            </p>
          </div>
        </div>
      )}

      {/* Explicative Banner */}
      <div className="mb-3.5 p-2.5 md:p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 text-xs text-[var(--text)] flex items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-300 flex-shrink-0">
            <CalendarClock size={15} />
          </div>
          <div>
            <p className="font-bold text-[11.5px] md:text-xs">Gestion des Campagnes Événementielles</p>
            <p className="text-[10.5px] md:text-[11px] text-[var(--text2)]">
              L'Administrateur déclenche et planifie les fenêtres d'événements (Concours d'entrée en 6e, Choix LV2, PEBS). Les sous-menus associés apparaissent dans la navigation du secrétariat uniquement lors des périodes actives.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Counters */}
      {!loading && !error && events.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[8px] md:gap-[10px] mb-[12px] md:mb-[16px]">
          {[
            { icon: CalendarClock, value: total, label: t('academicEvents.kpiTotal') },
            { icon: Zap, value: actifs, label: t('academicEvents.kpiActive') },
            { icon: Clock, value: aVenir, label: t('academicEvents.kpiUpcoming') },
            { icon: CheckCircle2, value: clos, label: t('academicEvents.kpiClosed') },
          ].map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="rounded-xl p-[10px] md:px-[12px] md:py-[10px] border border-[var(--border)]"
              style={{ background: 'var(--surface)' }}
            >
              <div style={{ marginBottom: 4 }}>
                <Icon size={17} />
              </div>
              <div
                className="text-[17px] md:text-[20px] font-bold"
                style={{ color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}
              >
                {value}
              </div>
              <div className="text-[10.5px] md:text-[11.5px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 1 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={24} className="animate-spin" color="var(--green)" />
        </div>
      )}

      {!loading && error && (
        <div
          className="flex-wrap gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl mb-4"
          style={{ background: 'var(--red-light)', display: 'flex', alignItems: 'center' }}
        >
          <AlertTriangle size={16} color="var(--red)" />
          <span className="text-xs md:text-[13px]" style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>
            {error}
          </span>
          <button onClick={fetchEvents} className="w-full md:w-auto text-xs px-2.5 py-1 rounded-lg" style={btnRetry}>
            {t('academicEvents.retry')}
          </button>
        </div>
      )}

      {/* Empty State with Suggestions */}
      {!loading && !error && events.length === 0 && (
        <AcademicEventsEmptyState onPlanEvent={openNewEventModal} />
      )}

      {/* Events List */}
      {!loading && !error && events.length > 0 && (
        <AcademicEventsList
          events={events}
          adjustingId={adjustingId}
          adjustDate={adjustDate}
          closingId={closingId}
          onStartAdjust={setAdjustingId}
          onChangeAdjustDate={setAdjustDate}
          onCancelAdjust={() => { setAdjustingId(null); setAdjustDate('') }}
          onSaveAdjust={ajuster}
          onTrigger={declencher}
          onCloseEvent={cloturer}
        />
      )}

      {/* Modal Assistant Nouvel Événement */}
      <ModalNouvelEvenement
        isOpen={modalOpen}
        initialType={initialType}
        onClose={() => setModalOpen(false)}
        onSuccess={() => fetchEvents()}
        onToast={onToast}
      />
    </div>
  )
}
