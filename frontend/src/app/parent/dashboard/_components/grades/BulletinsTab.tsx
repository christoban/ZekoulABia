'use client'

import { ScrollText, Loader2, Download, WifiOff, Eye } from 'lucide-react'
import type { ReportCard } from '../../_types'
import { useT } from '@/lib/i18n'
import { MENTION_COLOR, thSt, tdSt } from './types'

interface Props {
  bulletins: ReportCard[]
  selectedName: string
  isOnline: boolean
  downloading: string | null
  onSelectBulletin: (bulletin: ReportCard) => void
  onDownloadPdf: (id: string, label: string) => void
}

export default function BulletinsTab({
  bulletins,
  selectedName,
  isOnline,
  downloading,
  onSelectBulletin,
  onDownloadPdf,
}: Props) {
  const t = useT('parent')

  if (bulletins.length === 0) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <ScrollText size={36} strokeWidth={2} className="mx-auto mb-3 text-[var(--text3)]" />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {t('grades.emptyTitle')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {selectedName ? t('grades.emptyForChild').replace('{name}', selectedName) : t('grades.emptyDesc')}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Vue Mobile : Cartes tactiles */}
      <div className="md:hidden space-y-3">
        {bulletins.map((b) => {
          const [mBg, mC] = MENTION_COLOR(b.mention)
          const avg = b.generalAverage
          const avgColor =
            avg !== null
              ? avg >= 14
                ? 'var(--green)'
                : avg >= 10
                ? 'var(--blue)'
                : 'var(--red)'
              : 'var(--text3)'

          return (
            <div
              key={b.id}
              className="rounded-xl border p-3.5 shadow-xs space-y-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-start justify-between gap-2 border-b pb-2.5" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <div
                    className="text-xs font-extrabold"
                    style={{ color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}
                  >
                    {b.academicPeriod?.name || 'Période'}
                  </div>
                  {b.rank !== null && (
                    <div className="text-[11px] font-semibold text-[var(--text3)] mt-0.5">
                      Rang : {b.rank}e {b.totalStudents ? `/ ${b.totalStudents}` : ''}
                    </div>
                  )}
                </div>
                {b.mention && (
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, background: mBg, color: mC }}>
                    {b.mention}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10.5px] font-bold text-[var(--text3)]">{t('grades.average')}</div>
                  <div className="text-xl font-black leading-none mt-1" style={{ color: avgColor }}>
                    {avg !== null ? `${avg.toFixed(1)}/20` : '—'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="h-10 px-3 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs border transition-transform active:scale-[0.98]"
                    style={{
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      borderColor: 'var(--border2)',
                    }}
                    onClick={() => onSelectBulletin(b)}
                  >
                    <Eye size={13} strokeWidth={2} /> Consulter
                  </button>

                  <button
                    title={!isOnline ? t('grades.downloadUnavailable') : undefined}
                    className="h-10 px-3 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs border transition-transform active:scale-[0.98]"
                    style={{
                      background: isOnline ? 'var(--surface)' : 'var(--bg2)',
                      color: isOnline ? 'var(--green)' : 'var(--text3)',
                      borderColor: isOnline ? 'var(--green)' : 'var(--border2)',
                      opacity: downloading === b.id ? 0.6 : 1,
                    }}
                    onClick={() => onDownloadPdf(b.id, b.academicPeriod?.name || 'bulletin')}
                    disabled={downloading === b.id || !isOnline}
                  >
                    {downloading === b.id ? (
                      <>
                        <Loader2 size={13} strokeWidth={2} className="animate-spin" /> {t('grades.downloading')}
                      </>
                    ) : isOnline ? (
                      <>
                        <Download size={13} strokeWidth={2} /> {t('grades.downloadPdf')}
                      </>
                    ) : (
                      <WifiOff size={13} strokeWidth={2} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Vue Desktop : Tableau complet */}
      <div
        className="hidden md:block rounded-xl border overflow-hidden shadow-xs"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr>
                {[t('grades.period'), t('grades.average'), t('grades.rank'), t('grades.mention'), t('grades.actions')].map((h) => (
                  <th key={h} style={thSt}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bulletins.map((b) => {
                const [mBg, mC] = MENTION_COLOR(b.mention)
                const avg = b.generalAverage
                return (
                  <tr
                    key={b.id}
                    className="hover:bg-[var(--bg2)] transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{b.academicPeriod?.name || 'Période'}</td>
                    <td
                      style={{
                        ...tdSt,
                        fontWeight: 900,
                        fontSize: 14.5,
                        color: avg !== null ? (avg >= 14 ? 'var(--green)' : avg >= 10 ? 'var(--blue)' : 'var(--red)') : 'var(--text3)',
                      }}
                    >
                      {avg !== null ? `${avg}/20` : '—'}
                    </td>
                    <td style={tdSt}>
                      {b.rank !== null ? `${b.rank}e` : '—'} {b.totalStudents ? `/ ${b.totalStudents}` : ''}
                    </td>
                    <td style={tdSt}>
                      {b.mention && (
                        <span style={{ padding: '2.5px 8px', borderRadius: 14, fontSize: 11, fontWeight: 700, background: mBg, color: mC }}>
                          {b.mention}
                        </span>
                      )}
                    </td>
                    <td style={tdSt}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          style={{
                            padding: '5px 10px',
                            borderRadius: 7,
                            fontSize: 12,
                            fontWeight: 700,
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            border: '1.5px solid var(--border2)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                          onClick={() => onSelectBulletin(b)}
                        >
                          <Eye size={13} strokeWidth={2} /> Consulter
                        </button>
                        <button
                          title={!isOnline ? t('grades.downloadUnavailable') : undefined}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 7,
                            fontSize: 12,
                            fontWeight: 700,
                            background: isOnline ? 'var(--surface)' : 'var(--bg2)',
                            color: isOnline ? 'var(--green)' : 'var(--text3)',
                            border: `1.5px solid ${isOnline ? 'var(--green)' : 'var(--border2)'}`,
                            cursor: isOnline ? 'pointer' : 'not-allowed',
                            fontFamily: 'inherit',
                            opacity: downloading === b.id ? 0.6 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                          onClick={() => onDownloadPdf(b.id, b.academicPeriod?.name || 'bulletin')}
                          disabled={downloading === b.id || !isOnline}
                        >
                          {downloading === b.id ? (
                            <>
                              <Loader2 size={13} strokeWidth={2} className="animate-spin" /> {t('grades.downloading')}
                            </>
                          ) : isOnline ? (
                            <>
                              <Download size={13} strokeWidth={2} /> {t('grades.downloadPdf')}
                            </>
                          ) : (
                            <WifiOff size={13} strokeWidth={2} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
