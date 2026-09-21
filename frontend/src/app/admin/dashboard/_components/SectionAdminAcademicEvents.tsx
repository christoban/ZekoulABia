'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  CalendarClock,
  Plus,
  Zap,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  ArrowRight,
  BookOpen,
  School,
  Sparkles,
  GraduationCap,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import ModalNouvelEvenement from './academicEvents/ModalNouvelEvenement'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface AcademicEvent {
  id: string
  type: string
  category: 'FIXED_DATE' | 'MANUAL_TRIGGER' | 'SLIDING_WINDOW'
  title: string
  description: string | null
  targetRoles: string[]
  openDate: string | null
  closeDate: string | null
  status: 'UPCOMING' | 'ACTIVE' | 'CLOSED'
  entranceExamSessionId?: string | null
  createdBy?: { firstName: string; lastName: string }
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  UPCOMING: { bg: 'var(--blue-light)', color: 'var(--blue)' },
  ACTIVE: { bg: 'var(--green-light)', color: 'var(--green)' },
  CLOSED: { bg: 'var(--bg2)', color: 'var(--text3)' },
}
const CATEGORY_COLOR: Record<string, { bg: string; color: string }> = {
  FIXED_DATE: { bg: 'var(--purple-light)', color: 'var(--purple)' },
  MANUAL_TRIGGER: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  SLIDING_WINDOW: { bg: 'var(--teal-light)', color: 'var(--teal)' },
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

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/academic-events', { credentials: 'include' })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message || 'Erreur lors du chargement des événements')
      }
      setEvents(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des événements')
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
    if (!window.confirm(t('academicEvents.confirmClose'))) return
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

  const fmtDatetime = (d: string | null) => {
    if (!d) return '—'
    const dt = new Date(d)
    return dt.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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

      {/* Explicative Banner */}
      <div className="mb-3.5 p-2.5 md:p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 text-xs text-[var(--text)] flex items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-purple-500/15 text-purple-600 flex-shrink-0">
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
        <div className="flex flex-col gap-4">
          <div
            className="px-4 py-8 md:px-6 md:py-10 rounded-xl border border-[var(--border)]"
            style={{ background: 'var(--surface)', textAlign: 'center' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <CalendarClock size={36} className="text-purple-600" />
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
              <Sparkles size={16} className="text-purple-600" /> {t('academicEvents.suggestionsTitle')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Suggestion 1: Concours 6e */}
              <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-600">
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
                  onClick={() => openNewEventModal('CONCOURS_ENTREE')}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {t('academicEvents.planAction')} <ArrowRight size={13} />
                </button>
              </div>

              {/* Suggestion 2: Choix LV2 */}
              <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-600">
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
                  onClick={() => openNewEventModal('CHOIX_LV2')}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {t('academicEvents.planAction')} <ArrowRight size={13} />
                </button>
              </div>

              {/* Suggestion 3: Rentrée */}
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600">
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
                  onClick={() => openNewEventModal('RENTREE_6E_5E')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {t('academicEvents.planAction')} <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      {!loading && !error && events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map((ev) => (
            <div
              key={ev.id}
              className="rounded-xl p-3 md:px-4 md:py-3.5 border border-[var(--border)]"
              style={{ background: 'var(--surface)' }}
            >
              <div
                className="mb-1.5 gap-2"
                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}
              >
                <div className="text-[13.5px] md:text-[15px]" style={{ fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                  {ev.title}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span
                    className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: CATEGORY_COLOR[ev.category]?.bg, color: CATEGORY_COLOR[ev.category]?.color }}
                  >
                    {t(`academicEvents.category.${ev.category}`)}
                  </span>
                  <span
                    className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: STATUS_COLOR[ev.status]?.bg, color: STATUS_COLOR[ev.status]?.color }}
                  >
                    {t(`academicEvents.status.${ev.status}`)}
                  </span>
                </div>
              </div>

              {ev.description && (
                <div className="text-xs md:text-[12.5px]" style={{ color: 'var(--text3)', marginBottom: 6 }}>
                  {ev.description}
                </div>
              )}

              <div
                className="text-[11px] md:text-xs gap-1"
                style={{ color: 'var(--text3)', display: 'flex', flexDirection: 'column' }}
              >
                <span>
                  {t('academicEvents.opensOn')} {fmtDatetime(ev.openDate)} · {t('academicEvents.closesOn')}{' '}
                  {fmtDatetime(ev.closeDate)}
                </span>
                <span>
                  {t('academicEvents.roles')}{' '}
                  {ev.targetRoles.map((r) => t(`academicEvents.roleNames.${r}`) ?? r).join(', ')}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-[var(--border)]/60">
                {ev.category === 'MANUAL_TRIGGER' && ev.status === 'UPCOMING' && (
                  <button
                    onClick={() => declencher(ev.id)}
                    className="text-xs md:text-[12.5px] px-3 py-1.5 rounded-lg"
                    style={btnPrim}
                  >
                    <Zap size={13} /> {t('academicEvents.triggerNow')}
                  </button>
                )}

                {ev.category === 'SLIDING_WINDOW' && ev.status === 'ACTIVE' && (
                  adjustingId === ev.id ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        type="datetime-local"
                        value={adjustDate}
                        onChange={(e) => setAdjustDate(e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={inputSt}
                      />
                      <button onClick={() => ajuster(ev.id)} className="text-xs px-3 py-1.5 rounded-lg" style={btnPrim}>
                        {t('academicEvents.save')}
                      </button>
                      <button
                        onClick={() => {
                          setAdjustingId(null)
                          setAdjustDate('')
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg"
                        style={btnSec}
                      >
                        {t('academicEvents.cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAdjustingId(ev.id)}
                      className="text-xs md:text-[12.5px] px-3 py-1.5 rounded-lg"
                      style={btnSec}
                    >
                      {t('academicEvents.adjustWindow')}
                    </button>
                  )
                )}

                {/* Bouton Clôturer si ACTIVE */}
                {ev.status === 'ACTIVE' && (
                  <button
                    onClick={() => cloturer(ev.id)}
                    disabled={closingId === ev.id}
                    className="text-xs md:text-[12px] px-2.5 py-1.5 rounded-lg font-bold border border-red-500/30 text-red-600 hover:bg-red-500/10 flex items-center gap-1 transition-colors"
                  >
                    {closingId === ev.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Lock size={13} />
                    )}
                    {t('academicEvents.closeAction')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
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

const sTitle: React.CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif',
  fontWeight: 700,
  color: 'var(--text)',
}
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 700,
  background: 'linear-gradient(135deg,var(--green),var(--green2))',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
}
const btnSec: React.CSSProperties = {
  padding: '5px 11px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--surface)',
  color: 'var(--text2)',
  border: '1.5px solid var(--border2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const btnRetry: React.CSSProperties = {
  padding: '5px 11px',
  borderRadius: 7,
  background: 'var(--surface)',
  color: 'var(--red)',
  border: '1.5px solid rgba(220,38,38,0.3)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 12,
}
const inputSt: React.CSSProperties = {
  padding: '5px 9px',
  borderRadius: 7,
  border: '1.5px solid var(--border2)',
  fontSize: 12,
  fontFamily: 'inherit',
  color: 'var(--text)',
  background: 'var(--bg2)',
  outline: 'none',
}
