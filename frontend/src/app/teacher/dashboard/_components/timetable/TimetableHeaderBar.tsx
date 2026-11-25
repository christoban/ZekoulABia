'use client'
import { Calendar, Coffee, User as UserIcon, Package } from 'lucide-react'
import { sTitle, sSub, type TranslateFn } from './types'

interface Props {
  weekRangeLabel: string
  currentViewTitle: string
  fromCache: boolean
  cachedAt: number | null
  selectedView: string
  myClasses: { id: string; name: string }[]
  onSelectView: (view: string) => void
  onOpenCatchup: () => void
  t: TranslateFn
  tcommon: TranslateFn
}

export default function TimetableHeaderBar({
  weekRangeLabel,
  currentViewTitle,
  fromCache,
  cachedAt,
  selectedView,
  myClasses,
  onSelectView,
  onOpenCatchup,
  t,
  tcommon,
}: Props) {
  return (
    <>
      {/* ── En-tête : Titre, Semaine et Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
        <div>
          <div style={sTitle}>{t('timetable.title')}</div>
          <div style={sSub}>{weekRangeLabel} · <span className="font-semibold text-[var(--primary)]">{currentViewTitle}</span></div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Package size={12} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap">
          {/* Légende */}
          <div className="flex items-center gap-3">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--green)' }}>
              <div style={{ width: 9, height: 9, borderRadius: 2.5, background: 'var(--green-light)', border: '1.5px solid var(--green)' }} />
              {t('timetable.my_courses')}
            </span>
            {selectedView !== 'MY_SCHEDULE' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--text3)' }}>
                <div style={{ width: 9, height: 9, borderRadius: 2.5, background: 'var(--surface)', border: '1.5px solid var(--border)' }} />
                {t('timetable.view_by_class')}
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--amber)' }}>
              <Coffee size={12} />
              <span>Pauses</span>
            </span>
          </div>

          {/* Bouton rattrapage */}
          <button
            onClick={onOpenCatchup}
            className="h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
            style={{ background: 'var(--surface)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.35)', fontFamily: 'inherit' }}
          >
            <Calendar size={13} strokeWidth={2} />
            <span>{t('timetable.catchup_request')}</span>
          </button>
        </div>
      </div>

      {/* ── BASCULE OPTION 2 AVEC NUANCE STRICTE : Uniquement les classes où l'enseignant donne cours ── */}
      <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onSelectView('MY_SCHEDULE')}
            className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
            style={{
              background: selectedView === 'MY_SCHEDULE' ? 'var(--primary)' : 'var(--bg)',
              color: selectedView === 'MY_SCHEDULE' ? 'white' : 'var(--text2)',
              border: `1px solid ${selectedView === 'MY_SCHEDULE' ? 'var(--primary)' : 'var(--border)'}`,
              boxShadow: selectedView === 'MY_SCHEDULE' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            <UserIcon size={13} />
            <span>{t('timetable.view_my_schedule')}</span>
          </button>

          {myClasses.length > 0 && (
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <span className="text-[11px] font-semibold text-[var(--text3)] hidden sm:inline">
                {t('timetable.view_by_class')} :
              </span>
              <select
                value={selectedView === 'MY_SCHEDULE' ? '' : selectedView}
                onChange={(e) => {
                  if (e.target.value) onSelectView(e.target.value)
                  else onSelectView('MY_SCHEDULE')
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer outline-none w-full sm:w-auto"
                style={{
                  background: selectedView !== 'MY_SCHEDULE' ? 'linear-gradient(135deg,rgba(5,150,105,0.08),rgba(5,150,105,0.03))' : 'var(--bg)',
                  color: selectedView !== 'MY_SCHEDULE' ? 'var(--green2)' : 'var(--text2)',
                  borderColor: selectedView !== 'MY_SCHEDULE' ? 'var(--green)' : 'var(--border)',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">{t('timetable.select_class_placeholder')}</option>
                {myClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏫 {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedView !== 'MY_SCHEDULE' && (
          <div className="text-[11px] text-[var(--green)] font-medium bg-[var(--green-light)] px-2.5 py-1 rounded-md self-start sm:self-center">
            ★ Vos cours sont mis en surbrillance vive
          </div>
        )}
      </div>
    </>
  )
}
