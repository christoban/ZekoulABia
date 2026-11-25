'use client'
import { Inbox } from 'lucide-react'
import type { PerfRow, TranslateFn } from './types'

interface Props {
  perf: PerfRow[]
  loading: boolean
  t: TranslateFn
  tcommon: TranslateFn
}

export default function DeptPerformancesTab({ perf, loading, t, tcommon }: Props) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('department.performance_title')}</span>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{t('department.performance_count').replace('{count}', String(perf.length))}</span>
      </div>
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{tcommon('status.loading')}</div>
      ) : perf.length === 0 ? (
        <div style={{ padding: 36, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Inbox size={26} strokeWidth={2} /></div>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('department.performance_empty')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--border2)', marginTop: 4 }}>{t('department.performance_empty_hint')}</div>
        </div>
      ) : (
        <>
          {/* Vue mobile par cartes */}
          <div className="md:hidden divide-y divide-[var(--border)]">
            {perf.map((row, i) => {
              const moy = row.moyenne
              const moyBg = moy === null ? 'var(--bg2)' : moy >= 12 ? 'var(--green-light)' : moy >= 8 ? 'var(--amber-light)' : 'var(--red-light)'
              const moyColor = moy === null ? 'var(--text3)' : moy >= 12 ? 'var(--green)' : moy >= 8 ? 'var(--amber)' : 'var(--red)'
              return (
                <div key={i} className="p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[var(--text)]">{row.teacherName}</span>
                    <span style={{ background: moyBg, color: moyColor, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                      {moy !== null ? `${moy.toFixed(2)}/20` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--text2)]">
                    <span>{row.subjectName} · <strong>{row.className}</strong></span>
                    <span className="text-[var(--text3)]">{row.nbEleves} élèves</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Table desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {[t('department.perf_table_teacher'), t('department.perf_table_subject'), t('department.perf_table_class'), t('department.perf_table_average'), t('department.perf_table_students')].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perf.map((row, i) => {
                  const moy = row.moyenne
                  const moyBg = moy === null ? 'var(--bg2)' : moy >= 12 ? 'var(--green-light)' : moy >= 8 ? 'var(--amber-light)' : 'var(--red-light)'
                  const moyColor = moy === null ? 'var(--text3)' : moy >= 12 ? 'var(--green)' : moy >= 8 ? 'var(--amber)' : 'var(--red)'
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--bg)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{row.teacherName}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.subjectName}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.className}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: moyBg, color: moyColor, padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800 }}>
                          {moy !== null ? moy.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.nbEleves}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
