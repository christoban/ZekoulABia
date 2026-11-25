'use client'
import { AlertTriangle, CheckCircle2, Loader2, WifiOff } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  type DisciplineRecord,
  STATUS_BADGE,
  TYPE_STYLE,
  btnRetry,
  btnSec,
  filterSt,
  tdSt,
  thSt,
} from './disciplineTypes'

interface Props {
  isOnline: boolean
  typeFilter: string
  setTypeFilter: (val: string) => void
  statusFilter: string
  setStatusFilter: (val: string) => void
  loading: boolean
  error: string | null
  records: DisciplineRecord[]
  liftingId: string | null
  onFetchRecords: () => void
  onLiftSanction: (recordId: string, studentName: string) => void
}

export default function DisciplineSanctionsView({
  isOnline,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  loading,
  error,
  records,
  liftingId,
  onFetchRecords,
  onLiftSanction,
}: Props) {
  const t = useT('discipline')

  return (
    <>
      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>{t('offline_hint')}</span>
        </div>
      )}

      <div className="p-3 sm:px-4 sm:py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row gap-2 sm:items-center">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...filterSt, minHeight: 38 }} className="flex-1">
          <option value="">{t('filter_labels.all_types')}</option>
          {Object.keys(TYPE_STYLE).map(k => <option key={k} value={k}>{t(`sanction_types.${k}`)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...filterSt, minHeight: 38 }} className="flex-1">
          <option value="">{t('filter_labels.all_statuses')}</option>
          <option value="ACTIVE">{t('filter_labels.ACTIVE')}</option>
          <option value="LIFTED">{t('filter_labels.LIFTED')}</option>
          <option value="APPEALED">{t('filter_labels.APPEALED')}</option>
        </select>
        <button style={{ ...btnSec, minHeight: 38 }} onClick={onFetchRecords}>{t('actions.filter')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={15} strokeWidth={2} /></span>
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, fontSize: 13 }}>{error}</span>
          <button onClick={onFetchRecords} style={btnRetry}>{t('actions.retry')}</button>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}><CheckCircle2 size={40} strokeWidth={1.8} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('empty_state.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('empty_state.description')}</div>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div className="md:hidden divide-y divide-[var(--border)]">
            {records.map((r) => {
              const tl = TYPE_STYLE[r.type] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
              const sb = STATUS_BADGE[r.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
              return (
                <div key={r.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm text-[var(--text)]">{r.student.firstName} {r.student.lastName}</div>
                    <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, background: sb.bg, color: sb.color }}>
                      {t(`status_badges.${r.status}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: tl.bg, color: tl.color }}>
                      {t(`sanction_types.${r.type}`)}
                    </span>
                    <span className="text-xs text-[var(--text3)]">
                      {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text2)] line-clamp-2">{r.reason}</div>
                  <div className="text-[11px] text-[var(--text3)]">
                    Décidée par {r.decidedBy.firstName} {r.decidedBy.lastName}
                  </div>
                  {r.status === 'ACTIVE' && (
                    <div className="pt-1">
                      <button
                        style={{ width: '100%', minHeight: 38, borderRadius: 6, fontSize: 12, fontWeight: 800, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(142,42,58,0.25)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onClick={() => onLiftSanction(r.id, `${r.student.firstName} ${r.student.lastName}`)}
                        disabled={liftingId === r.id}
                      >
                        {liftingId === r.id ? <Loader2 size={13} className="animate-spin" /> : t('actions.lift')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>{[
                  t('table_headers.student'),
                  t('table_headers.type'),
                  t('table_headers.reason'),
                  t('table_headers.date'),
                  t('table_headers.status'),
                  t('table_headers.decided_by'),
                  t('table_headers.actions'),
                ].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const tl = TYPE_STYLE[r.type] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                  const sb = STATUS_BADGE[r.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                  return (
                    <tr
                      key={r.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                    >
                      <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{r.student.firstName} {r.student.lastName}</td>
                      <td style={tdSt}>
                        <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800, background: tl.bg, color: tl.color }}>
                          {t(`sanction_types.${r.type}`)}
                        </span>
                      </td>
                      <td style={tdSt}>
                        <span style={{ fontSize: 12.5, color: 'var(--text2)', maxWidth: 180, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.reason}
                        </span>
                      </td>
                      <td style={tdSt}>{new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={tdSt}>
                        <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800, background: sb.bg, color: sb.color }}>
                          {t(`status_badges.${r.status}`)}
                        </span>
                      </td>
                      <td style={tdSt}>{r.decidedBy.firstName} {r.decidedBy.lastName}</td>
                      <td style={tdSt}>
                        {r.status === 'ACTIVE' && (
                          <button
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(142,42,58,0.25)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => onLiftSanction(r.id, `${r.student.firstName} ${r.student.lastName}`)}
                            disabled={liftingId === r.id}
                          >
                            {liftingId === r.id ? <Loader2 size={12} className="animate-spin" /> : t('actions.lift')}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
