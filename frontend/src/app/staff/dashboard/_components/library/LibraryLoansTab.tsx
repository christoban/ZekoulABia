'use client'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  type BookLoan,
  LOAN_STATUS,
  type Pagination,
  btnSec,
  filterSt,
  tdSt,
  thSt,
} from './libraryTypes'

interface Props {
  loans: BookLoan[]
  loanPag: Pagination
  loanStatus: string
  setLoanStatus: (val: string) => void
  returningId: string | null
  onFetchLoans: (page?: number) => void
  onReturnLoan: (loanId: string, bookTitle: string) => void
  onOpenRenew: (loanId: string, dueDate: string | null) => void
}

export default function LibraryLoansTab({
  loans,
  loanPag,
  loanStatus,
  setLoanStatus,
  returningId,
  onFetchLoans,
  onReturnLoan,
  onOpenRenew,
}: Props) {
  const t = useT('staff')

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div className="p-2.5 sm:p-3 border-b border-[var(--border)] flex flex-wrap gap-2 items-center">
        <select value={loanStatus} onChange={e => setLoanStatus(e.target.value)} style={filterSt} className="min-h-[38px] text-xs">
          <option value="ACTIVE">{t('library.filterActive')}</option>
          <option value="RETURNED">{t('library.filterReturned')}</option>
          <option value="OVERDUE">{t('library.filterOverdue')}</option>
          <option value="">{t('library.filterAll')}</option>
        </select>
        <button style={btnSec} className="min-h-[38px] px-3 text-xs" onClick={() => onFetchLoans(1)}>{t('library.filter')}</button>
      </div>

      {loans.length === 0 ? (
        <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          {loanStatus === 'ACTIVE' ? t('library.noLoansActive') : loanStatus === 'RETURNED' ? t('library.noLoansReturned') : t('library.noLoansOverdue')}
        </div>
      ) : (
        <>
          <div className="md:hidden divide-y divide-[var(--border)]">
            {loans.map(l => {
              const st = LOAN_STATUS[l.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
              const isOverdue = l.status === 'ACTIVE' && l.dueDate && new Date(l.dueDate) < new Date()
              return (
                <div key={l.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm text-[var(--text)]">{l.student.firstName} {l.student.lastName}</div>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: isOverdue ? 'var(--red-light)' : st.bg, color: isOverdue ? 'var(--red)' : st.color }}>
                      {isOverdue ? t('library.statusOverdue') : l.status === 'ACTIVE' ? t('library.statusActive') : t('library.statusReturned')}
                    </span>
                  </div>

                  <div className="text-xs text-[var(--text2)]">
                    <div className="font-semibold text-[var(--text)] text-[13px]">{l.book.title}</div>
                    {l.book.author && <div className="text-[var(--text3)] text-[11px]">{l.book.author}</div>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[var(--bg)] text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--text3)] uppercase font-bold block">{t('library.tableLoanHeaderDate')}</span>
                      <span className="font-medium text-[var(--text)]">{new Date(l.borrowedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text3)] uppercase font-bold block">{t('library.tableLoanHeaderDue')}</span>
                      <span style={{ fontWeight: 600, color: isOverdue ? 'var(--red)' : 'var(--text)' }}>
                        {l.dueDate ? new Date(l.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—'}
                      </span>
                    </div>
                  </div>

                  {(l.status === 'ACTIVE' || l.status === 'OVERDUE') && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(142,42,58,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                        className="flex-1 min-h-[38px] flex items-center justify-center font-bold"
                        onClick={() => onReturnLoan(l.id, l.book.title)}
                        disabled={returningId === l.id}
                      >
                        {returningId === l.id ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : t('library.return')}
                      </button>
                      <button
                        style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid rgba(29,78,216,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                        className="flex-1 min-h-[38px] flex items-center justify-center gap-1 font-bold"
                        onClick={() => onOpenRenew(l.id, l.dueDate)}
                      >
                        <RefreshCw size={13} strokeWidth={2} /> {t('library.renew')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>{[t('library.tableLoanHeaderStudent'), t('library.tableLoanHeaderBook'), t('library.tableLoanHeaderDate'), t('library.tableLoanHeaderDue'), t('library.tableLoanHeaderStatus'), t('library.tableLoanHeaderActions')].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loans.map(l => {
                  const st = LOAN_STATUS[l.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                  const isOverdue = l.status === 'ACTIVE' && l.dueDate && new Date(l.dueDate) < new Date()
                  return (
                    <tr
                      key={l.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                    >
                      <td style={{ ...tdSt, fontWeight: 600, color: 'var(--text)' }}>{l.student.firstName} {l.student.lastName}</td>
                      <td style={tdSt}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{l.book.title}</div>
                        {l.book.author && <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{l.book.author}</div>}
                      </td>
                      <td style={tdSt}>{new Date(l.borrowedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
                      <td style={tdSt}>
                        {l.dueDate ? (
                          <span style={{ fontWeight: 600, color: isOverdue ? 'var(--red)' : 'var(--text2)' }}>
                            {isOverdue && <AlertTriangle size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />}
                            {new Date(l.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={tdSt}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700, background: isOverdue ? 'var(--red-light)' : st.bg, color: isOverdue ? 'var(--red)' : st.color }}>
                          {isOverdue ? t('library.statusOverdue') : l.status === 'ACTIVE' ? t('library.statusActive') : t('library.statusReturned')}
                        </span>
                      </td>
                      <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
                        {(l.status === 'ACTIVE' || l.status === 'OVERDUE') && (
                          <>
                            <button
                              style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(142,42,58,0.25)', cursor: 'pointer', fontFamily: 'inherit', marginRight: 5 }}
                              onClick={() => onReturnLoan(l.id, l.book.title)}
                              disabled={returningId === l.id}
                            >
                              {returningId === l.id ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : t('library.return')}
                            </button>
                            <button
                              style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid rgba(29,78,216,0.2)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={() => onOpenRenew(l.id, l.dueDate)}
                            >
                              <RefreshCw size={11} strokeWidth={2} /> {t('library.renew')}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {loanPag.pages > 1 && (
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button style={btnSec} disabled={loanPag.page <= 1} onClick={() => onFetchLoans(loanPag.page - 1)}>{t('library.previous')}</button>
          <span style={{ padding: '6px 12px', fontSize: 14, fontWeight: 700 }}>{loanPag.page}/{loanPag.pages}</span>
          <button style={btnSec} disabled={loanPag.page >= loanPag.pages} onClick={() => onFetchLoans(loanPag.page + 1)}>{t('library.next')}</button>
        </div>
      )}
    </div>
  )
}
