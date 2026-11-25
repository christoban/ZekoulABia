'use client'
import { Star, ChevronRight, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  STATUS_BADGE,
  btnSecSm,
  fmtDate,
  getPStatus,
  type AcademicYear,
} from './academicYearUi'

interface Props {
  currentYear: AcademicYear
  openPeriods: Set<string>
  settingCurrentId: string | null
  settingSequenceId: string | null
  onTogglePeriod: (id: string) => void
  onSetCurrent: (periodId: string) => void
  onSetSequenceCurrent: (sequenceId: string) => void
  onOpenCalendar: (year: AcademicYear) => void
}

export default function CurrentYearPanel({
  currentYear,
  openPeriods,
  settingCurrentId,
  settingSequenceId,
  onTogglePeriod,
  onSetCurrent,
  onSetSequenceCurrent,
  onOpenCalendar,
}: Props) {
  const t = useT('admin')
  const currentPeriod = currentYear.periods.find(p => p.isCurrent)
  const currentSeq = currentPeriod?.sequences.find(s => s.isCurrent)

  const bannerMetrics = [
    { label: t('academic_year.currentPeriodLabel'), value: currentPeriod?.name ?? '' },
    { label: t('academic_year.type'), value: currentPeriod?.type === 'TRIMESTER' ? t('academic_year.trimesters') : t('academic_year.semesters') },
    ...(currentSeq ? [{ label: t('academic_year.sequenceLabel'), value: currentSeq.name }] : []),
  ]

  return (
    <>
      {/* Bannière année courante */}
      <div
        className="rounded-[18px] md:rounded-[20px] p-[22px] md:px-[36px] md:py-[32px] mb-[16px] md:mb-[22px]"
        style={{
          background: 'linear-gradient(135deg,var(--sidebar) 0%,var(--sidebar2) 60%,var(--sidebar) 100%)',
          border: '1.5px solid rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="hidden md:block" style={{ position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)', opacity: 0.04, color: 'white', pointerEvents: 'none' }}>
          <Star size={100} fill="white" />
        </div>

        <div className="mb-[16px] md:mb-[20px]" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="text-[11px] md:text-[13px] mb-[6px] md:mb-[8px]" style={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              {t('academic_year.currentYearLabel')}
            </div>
            <div className="text-[26px] md:text-[44px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'white', lineHeight: 1 }}>
              {currentYear.name}
            </div>
            <div className="text-[13px] md:text-[17px] mt-[6px] md:mt-[8px]" style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {fmtDate(currentYear.startDate)} → {fmtDate(currentYear.endDate)}
            </div>
          </div>
          {currentSeq && (
            <span className="text-[13px] md:text-[14px] px-[14px] md:px-[16px] py-[5px] md:py-[6px]" style={{ background: 'var(--amber-light)', color: 'var(--amber)', borderRadius: 20, fontWeight: 800, alignSelf: 'flex-start', marginTop: 8 }}>
              {t('academic_year.seqInProgress', { name: currentSeq.name })}
            </span>
          )}
        </div>

        {currentPeriod && (
          <div className="gap-[20px] md:gap-[28px]" style={{ display: 'flex', flexWrap: 'wrap' }}>
            {bannerMetrics.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div className="text-[11px] md:text-[13px]" style={{ fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {m.label}
                </div>
                <div className="text-[14px] md:text-[17px]" style={{ fontWeight: 700, color: 'white' }}>{m.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendrier scolaire */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden', marginBottom: 22 }}>
        <div className="px-[16px] py-[13px] md:px-[22px] md:py-[16px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span className="text-[14.5px] md:text-[17px]" style={{ fontWeight: 800, color: 'var(--text)' }}>
            {t('academic_year.calendarTitle', { name: currentYear.name })}
          </span>
          <button style={btnSecSm} onClick={() => onOpenCalendar(currentYear)}>{t('academic_year.editCalendar')}</button>
        </div>

        {currentYear.periods.length === 0 ? (
          <div style={{ padding: '30px 22px', color: 'var(--text3)', textAlign: 'center' }}>
            {t('academic_year.noPeriod')}
          </div>
        ) : (
          currentYear.periods.map(period => {
            const ps = getPStatus(period.isCurrent, period.startDate, period.endDate)
            const badge = STATUS_BADGE[ps]
            const open = openPeriods.has(period.id)
            return (
              <div key={period.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  onClick={() => onTogglePeriod(period.id)}
                  className="gap-[10px] md:gap-[14px] px-[16px] py-[14px] md:px-[22px] md:py-[18px]"
                  style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer', userSelect: 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                >
                  <span style={{ color: 'var(--text3)', transition: 'transform 0.2s', display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
                    <ChevronRight size={14} />
                  </span>
                  <span className="text-[14px] md:text-[20px] md:[font-family:var(--font-spectral),Spectral,serif]" style={{ fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                    {period.name}
                  </span>
                  <span className="text-[12px] md:text-[15px]" style={{ color: 'var(--text3)', fontWeight: 600 }}>
                    {fmtDate(period.startDate)} → {fmtDate(period.endDate)}
                  </span>
                  <span className="text-[11.5px] md:text-[14px] px-[10px] md:px-[12px] py-[3px] md:py-[4px]" style={{ background: badge.bg, color: badge.color, borderRadius: 22, fontWeight: 800 }}>
                    {t(`academic_year.status.${ps}`)}
                  </span>
                  {!period.isCurrent && (
                    <button
                      style={btnSecSm}
                      onClick={e => { e.stopPropagation(); onSetCurrent(period.id) }}
                      disabled={settingCurrentId === period.id}
                    >
                      {settingCurrentId === period.id ? <Loader2 size={14} className="animate-spin" /> : t('academic_year.setActive')}
                    </button>
                  )}
                </div>

                {open && period.sequences.length > 0 && (
                  <div className="px-[14px] pb-[14px] md:px-[22px] md:pb-[20px]" style={{ paddingTop: 0 }}>
                    <div className="border-l-[2px] md:border-l-[3px] ml-[6px] md:ml-[10px] pl-[16px] md:pl-[22px]" style={{ borderColor: 'var(--border)', display: 'flex', flexDirection: 'column' }}>
                      {period.sequences.map((seq, si) => {
                        const ss = getPStatus(seq.isCurrent, seq.startDate ?? period.startDate, seq.endDate ?? period.endDate)
                        const sb = STATUS_BADGE[ss]
                        return (
                          <div key={seq.id} className="gap-[8px] md:gap-[14px] py-[9px] md:py-[12px]" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', position: 'relative', borderBottom: si < period.sequences.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <div
                              className="w-[10px] h-[10px] md:w-[13px] md:h-[13px] left-[-22px] md:left-[-30px]"
                              style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', borderRadius: '50%', background: ss === 'done' ? 'var(--green)' : ss === 'active' ? 'var(--amber)' : 'var(--border2)', border: '2px solid white', boxShadow: ss === 'active' ? '0 0 0 4px rgba(217,119,6,0.18)' : 'none' }}
                            />
                            <span className="text-[13.5px] md:text-[17px] min-w-[90px] md:min-w-[120px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{seq.name}</span>
                            <span className="text-[12px] md:text-[15px]" style={{ color: 'var(--text3)', fontWeight: 600, flex: 1 }}>
                              {seq.startDate ? `${fmtDate(seq.startDate)} → ${fmtDate(seq.endDate)}` : t('academic_year.noDates')}
                            </span>
                            <span className="text-[11px] md:text-[13px] px-[8px] md:px-[10px] py-[2px] md:py-[3px]" style={{ background: sb.bg, color: sb.color, borderRadius: 20, fontWeight: 800 }}>
                              {t(`academic_year.status.${ss}`)}
                            </span>
                            {!seq.isCurrent && (
                              <button
                                className="text-[12px] md:text-[15px] px-[10px] md:px-[14px] py-[5px] md:py-[7px]"
                                style={{ ...btnSecSm, fontSize: undefined, padding: undefined }}
                                onClick={e => { e.stopPropagation(); onSetSequenceCurrent(seq.id) }}
                                disabled={settingSequenceId === seq.id}
                              >
                                {settingSequenceId === seq.id ? <Loader2 size={14} className="animate-spin" /> : t('academic_year.setActiveFem')}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
