'use client'
import { useCallback } from 'react'
import { BookOpen, AlarmClock, AlertTriangle, Package } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface BookLoan {
  id: string
  status: string
  borrowedAt: string
  dueDate: string | null
  returnedAt: string | null
  book: { id: string; title: string; author: string | null; category: string | null }
}

export default function SectionStudentLibrary() {
  const t = useT('student')

  const fetchFn = useCallback(async (): Promise<BookLoan[]> => {
    const r = await fetchApi('/api/v2/library/my-loans', { credentials: 'include' })
    const d = await r.json()
    if (!d.success) throw new Error(d.message || t('common.error_fallback'))
    return d.data || []
  }, [t])

  const { data, loading, error, fromCache, cachedAt } = useCachedFetch<BookLoan[]>('student-library', fetchFn)
  const loans = data ?? []

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  const active  = loans.filter(l => l.status === 'ACTIVE').length
  const overdue = loans.filter(l => l.status === 'OVERDUE').length

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 6 : 12 }}>
        <div style={sTitle}>{t('library.title')}</div>
        <div style={sSub}>{t('library.subtitle')}</div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Package size={13} strokeWidth={2} /> {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
          </div>
        )}
      </div>

      {!loading && !error && loans.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
          {[
            { icon: BookOpen, bg: 'var(--blue-light)', val: loans.length,  label: t('library.total_loans'), color: 'var(--blue)' },
            { icon: BookOpen, bg: 'var(--green-light)', val: active,         label: t('library.active_label'), color: 'var(--green)' },
            { icon: AlarmClock, bg: 'var(--red-light)', val: overdue,        label: t('library.overdue_label'), color: 'var(--red)' },
          ].map((k, i) => (
            <div key={i} className="rounded-xl border p-2.5 sm:p-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <k.icon size={14} strokeWidth={2} />
              </div>
              <div className="text-base sm:text-lg font-black leading-none" style={{ color: k.color }}>{k.val}</div>
              <div className="text-[10px] sm:text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--text3)' }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '10px 14px', color: 'var(--red)', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} strokeWidth={2} /> {error}</div>
      )}

      {!loading && !error && loans.length === 0 && (
        <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text3)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><BookOpen size={34} strokeWidth={2} /></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('library.empty_title')}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{t('library.empty_subtitle')}</div>
        </div>
      )}

      {!loading && !error && loans.length > 0 && (
        <>
          {/* Vue Mobile (md:hidden) : Cartes d'emprunt de livres */}
          <div className="md:hidden space-y-2.5">
            {loans.map(l => {
              const getBadge = (status: string): { bg: string; color: string; label: string } => {
                const map: Record<string, { bg: string; color: string; label: string }> = {
                  ACTIVE:   { bg: 'var(--green-light)', color: 'var(--green)', label: t('library.active_label') },
                  RETURNED: { bg: 'var(--bg2)', color: 'var(--text2)', label: t('library.returned_label') },
                  OVERDUE:  { bg: 'var(--red-light)', color: 'var(--red)', label: t('library.overdue_label') },
                }
                return map[status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: status }
              }
              const badge = getBadge(l.status)
              const isOverdue = l.status === 'ACTIVE' && l.dueDate && new Date(l.dueDate) < new Date()
              return (
                <div
                  key={l.id}
                  className="rounded-xl border p-3 shadow-xs space-y-2"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>
                        {l.book.title}
                      </div>
                      {l.book.author && (
                        <div className="text-[11px] text-[var(--text3)] truncate mt-0.5">
                          {l.book.author}
                        </div>
                      )}
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 800, background: isOverdue ? 'var(--red-light)' : badge.bg, color: isOverdue ? 'var(--red)' : badge.color, display: 'inline-flex', alignItems: 'center', gap: 4 }} className="shrink-0">
                      {isOverdue ? <><AlarmClock size={11} strokeWidth={2} /> {t('library.overdue_label')}</> : badge.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t" style={{ borderColor: 'var(--bg2)' }}>
                    <div className="text-[var(--text3)]">
                      {l.book.category && (
                        <span className="px-1.5 py-0.5 rounded-md mr-1.5" style={{ background: 'var(--bg2)' }}>
                          {l.book.category}
                        </span>
                      )}
                      <span>Emprunté le {new Date(l.borrowedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                    </div>

                    {l.dueDate && (
                      <div style={{ color: isOverdue ? 'var(--red)' : 'var(--text2)', fontWeight: 700 }} className="inline-flex items-center gap-1">
                        {isOverdue && <AlertTriangle size={12} strokeWidth={2} />}
                        <span>Retour : {new Date(l.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Vue Desktop (hidden md:block) : Tableau complet */}
          <div className="hidden md:block rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
                <thead>
                  <tr>{[
                    t('library.table_header_title'),
                    t('library.table_header_category'),
                    t('library.table_header_borrowed'),
                    t('library.table_header_due'),
                    t('library.table_header_status'),
                  ].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {loans.map(l => {
                    const getBadge = (status: string): { bg: string; color: string; label: string } => {
                      const map: Record<string, { bg: string; color: string; label: string }> = {
                        ACTIVE:   { bg: 'var(--green-light)', color: 'var(--green)', label: t('library.active_label') },
                        RETURNED: { bg: 'var(--bg2)', color: 'var(--text2)', label: t('library.returned_label') },
                        OVERDUE:  { bg: 'var(--red-light)', color: 'var(--red)', label: t('library.overdue_label') },
                      }
                      return map[status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: status }
                    }
                    const badge = getBadge(l.status)
                    const isOverdue = l.status === 'ACTIVE' && l.dueDate && new Date(l.dueDate) < new Date()
                    return (
                      <tr key={l.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)', maxWidth: 220 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.book.title}</div>
                          {l.book.author && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{l.book.author}</div>}
                        </td>
                        <td style={tdSt}>{l.book.category ?? '—'}</td>
                        <td style={tdSt}>{new Date(l.borrowedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                        <td style={tdSt}>
                          {l.dueDate ? (
                            <span style={{ fontWeight: 600, color: isOverdue ? 'var(--red)' : 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {isOverdue && <AlertTriangle size={13} strokeWidth={2} />}{new Date(l.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={tdSt}>
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: isOverdue ? 'var(--red-light)' : badge.bg, color: isOverdue ? 'var(--red)' : badge.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {isOverdue ? <><AlarmClock size={11} strokeWidth={2} /> {t('library.overdue_label')}</> : badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const thSt: React.CSSProperties = { padding: '7px 11px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8px 11px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
