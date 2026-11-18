'use client'
import { AlertTriangle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  btnSecSm,
  fmtDate,
  tdStyle,
  thStyle,
  type AcademicYear,
  type YearToastFn,
} from './academicYearUi'

interface Props {
  historyYears: AcademicYear[]
  currentYear: AcademicYear | undefined
  closingId: string | null
  onOpenCalendar: (year: AcademicYear) => void
  onCloseYear: (yearId: string) => void
  onToast: YearToastFn
}

export default function AcademicYearHistoryPanel({
  historyYears,
  currentYear,
  closingId,
  onOpenCalendar,
  onCloseYear,
  onToast,
}: Props) {
  const t = useT('admin')

  return (
    <>
      {/* Historique */}
      {historyYears.length > 0 && (
        <div className="rounded-none md:rounded-[16px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]" style={{ overflow: 'hidden', marginBottom: 22 }}>
          <div className="px-0 pb-[10px] md:px-[22px] md:py-[16px] md:border-b md:border-[var(--border)]">
            <span className="text-[12.5px] md:text-[17px] uppercase md:normal-case" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('academic_year.historyTitle')}</span>
          </div>

          {/* ── Cartes empilées — mobile ── */}
          <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
            {historyYears.map(y => (
              <div key={y.id} className="rounded-[14px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div className="text-[13.5px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{y.name}</div>
                  <span className="text-[10.5px]" style={{ background: y.status === 'CLOSED' ? 'var(--bg2)' : 'var(--green-light)', color: y.status === 'CLOSED' ? 'var(--text2)' : 'var(--green)', padding: '3px 9px', borderRadius: 20, fontWeight: 800, flexShrink: 0 }}>
                    {y.status === 'CLOSED' ? t('academic_year.archived') : y.status}
                  </span>
                </div>
                <div className="text-[11.5px]" style={{ color: 'var(--text3)', marginTop: 4 }}>{fmtDate(y.startDate)} → {fmtDate(y.endDate)}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button className="text-[12px] px-[10px] py-[5px]" style={{ ...btnSecSm, fontSize: undefined, padding: undefined }} onClick={() => onToast(t('academic_year.archivesToast', { name: y.name }), 'info')}>{t('academic_year.view')}</button>
                  <button className="text-[12px] px-[10px] py-[5px]" style={{ ...btnSecSm, fontSize: undefined, padding: undefined }} onClick={() => onOpenCalendar(y)}>{t('academic_year.calendar')}</button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Tableau — desktop ── */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  {[t('academic_year.thYear'), t('academic_year.thFrom'), t('academic_year.thTo'), t('academic_year.thStatus'), t('academic_year.thActions')].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyYears.map(y => (
                  <tr
                    key={y.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{y.name}</div>
                    </td>
                    <td style={tdStyle}>{fmtDate(y.startDate)}</td>
                    <td style={tdStyle}>{fmtDate(y.endDate)}</td>
                    <td style={tdStyle}>
                      <span style={{ background: y.status === 'CLOSED' ? 'var(--bg2)' : 'var(--green-light)', color: y.status === 'CLOSED' ? 'var(--text2)' : 'var(--green)', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                        {y.status === 'CLOSED' ? t('academic_year.archived') : y.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={btnSecSm} onClick={() => onToast(t('academic_year.archivesToast', { name: y.name }), 'info')}>{t('academic_year.view')}</button>
                        <button style={btnSecSm} onClick={() => onOpenCalendar(y)}>{t('academic_year.calendar')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Danger zone — clôture de l'année courante */}
      {currentYear && (
        <div className="rounded-[16px] md:rounded-[18px] border-[1.5px] md:border-2" style={{ background: 'var(--surface)', borderColor: 'rgba(220,38,38,0.2)', borderStyle: 'solid', overflow: 'hidden' }}>
          <div className="px-[14px] py-[13px] md:px-[26px] md:py-[20px] gap-[8px] md:gap-[12px]" style={{ background: 'var(--red-light)', borderBottom: '1px solid rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center' }}>
            <AlertTriangle size={16} className="md:hidden" color="var(--red)" />
            <AlertTriangle size={22} className="hidden md:block" color="var(--red)" />
            <div className="text-[13.5px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--red)' }}>{t('academic_year.dangerZone')}</div>
          </div>
          <div className="p-[14px] md:px-[26px] md:py-[22px]">
            <p className="text-[12.5px] md:text-[17px] mb-[14px] md:mb-[20px]" style={{ color: 'var(--text2)', lineHeight: 1.55 }}>
              {t('academic_year.dangerText')}
            </p>
            <button
              className="w-full md:w-auto text-[12.5px] md:text-[16px] py-[11px] md:py-[10px] px-[16px] md:px-[20px] rounded-[10px] md:rounded-[11px]"
              style={{ background: 'var(--red-light)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: closingId ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 800, opacity: closingId ? 0.6 : 1 }}
              onClick={() => onCloseYear(currentYear.id)}
              disabled={!!closingId}
            >
              {closingId ? t('academic_year.closingInProgress') : t('academic_year.closeYear', { name: currentYear.name })}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
