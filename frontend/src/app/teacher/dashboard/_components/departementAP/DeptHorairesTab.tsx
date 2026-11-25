'use client'
import { Inbox, AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import type { HoraireRow, TranslateFn } from './types'

interface Props {
  horaires: HoraireRow[]
  loading: boolean
  t: TranslateFn
  tcommon: TranslateFn
}

export default function DeptHorairesTab({ horaires, loading, t, tcommon }: Props) {
  return (
    <div className="space-y-3">
      <div style={{ padding: '8px 12px', background: 'var(--amber-light)', border: '1px solid var(--amber-light)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ display: 'flex', flexShrink: 0 }}><AlertTriangle size={15} strokeWidth={2} /></span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{t('department.hours_legal_warn')} — <span style={{ fontWeight: 500 }}>{t('department.hours_legal_hint')}</span></div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('department.hours_title')}</span>
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{tcommon('status.loading')}</div>
        ) : horaires.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Inbox size={26} strokeWidth={2} /></div>
            <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('department.hours_empty')}</div>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-[var(--border)]">
              {horaires.map((row, i) => (
                <div key={i} className="p-3.5 space-y-2" style={{ background: row.isOverLimit ? 'var(--red-light)' : undefined }}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold" style={{ color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>{row.teacherName}</div>
                      <div className="text-xs text-[var(--text2)]">{row.subjectName}</div>
                    </div>
                    {row.isOverLimit
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--red-light)', color: 'var(--red)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><Circle size={6} fill="var(--red)" stroke="none" />{t('department.hours_over')}</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--green-light)', color: 'var(--green)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><CheckCircle2 size={11} strokeWidth={2} />{t('department.hours_ok')}</span>
                    }
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black" style={{ color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>{row.totalHours.toFixed(1)}h</span>
                    <div className="flex-1 bg-[var(--bg2)] rounded-full h-1.5 overflow-hidden">
                      <div style={{ height: '100%', width: `${Math.min((row.totalHours / 20) * 100, 100)}%`, background: row.isOverLimit ? 'var(--red)' : 'var(--green)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    {[t('department.hours_table_teacher'), t('department.hours_table_subject'), t('department.hours_table_hours'), t('department.hours_table_status')].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {horaires.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--bg)', background: row.isOverLimit ? 'var(--red-light)' : i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>{row.teacherName}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.subjectName}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>
                            {row.totalHours.toFixed(1)}h
                          </span>
                          <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 3, height: 4, maxWidth: 80, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${Math.min((row.totalHours / 20) * 100, 100)}%`, background: row.isOverLimit ? 'var(--red)' : 'var(--green)' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {row.isOverLimit
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--red-light)', color: 'var(--red)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><Circle size={6} fill="var(--red)" stroke="none" />{t('department.hours_over')}</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--green-light)', color: 'var(--green)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><CheckCircle2 size={11} strokeWidth={2} />{t('department.hours_ok')}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
