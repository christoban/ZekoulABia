'use client'

import { Zap, Loader2, Lock } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  CATEGORY_COLOR,
  STATUS_COLOR,
  btnPrim,
  btnSec,
  inputSt,
  type AcademicEvent,
} from './academicEventsStyles'

interface AcademicEventsListProps {
  events: AcademicEvent[]
  adjustingId: string | null
  adjustDate: string
  closingId: string | null
  onStartAdjust: (id: string) => void
  onChangeAdjustDate: (date: string) => void
  onCancelAdjust: () => void
  onSaveAdjust: (id: string) => void
  onTrigger: (id: string) => void
  onCloseEvent: (id: string) => void
}

function fmtDatetime(d: string | null) {
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

export default function AcademicEventsList({
  events,
  adjustingId,
  adjustDate,
  closingId,
  onStartAdjust,
  onChangeAdjustDate,
  onCancelAdjust,
  onSaveAdjust,
  onTrigger,
  onCloseEvent,
}: AcademicEventsListProps) {
  const t = useT('admin')

  return (
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
                onClick={() => onTrigger(ev.id)}
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
                    onChange={(e) => onChangeAdjustDate(e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={inputSt}
                  />
                  <button onClick={() => onSaveAdjust(ev.id)} className="text-xs px-3 py-1.5 rounded-lg" style={btnPrim}>
                    {t('academicEvents.save')}
                  </button>
                  <button
                    onClick={onCancelAdjust}
                    className="text-xs px-2.5 py-1.5 rounded-lg"
                    style={btnSec}
                  >
                    {t('academicEvents.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onStartAdjust(ev.id)}
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
                onClick={() => onCloseEvent(ev.id)}
                disabled={closingId === ev.id}
                className="text-xs md:text-[12px] px-2.5 py-1.5 rounded-lg font-bold border border-red-500/30 text-red-600 dark:text-red-300 hover:bg-red-500/10 flex items-center gap-1 transition-colors"
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
  )
}
