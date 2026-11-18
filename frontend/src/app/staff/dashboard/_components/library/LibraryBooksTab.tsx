'use client'
import { Loader2, Pencil, Search, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  type Book,
  CATEGORIES,
  type Pagination,
  btnSec,
  filterSt,
  tdSt,
  thSt,
} from './libraryTypes'

interface Props {
  books: Book[]
  bookPag: Pagination
  bookSearch: string
  setBookSearch: (val: string) => void
  bookCategory: string
  setBookCategory: (val: string) => void
  deletingId: string | null
  onFetchBooks: (page?: number) => void
  onOpenBorrow: (book: Book) => void
  onOpenEdit: (book: Book) => void
  onDeleteBook: (bookId: string, bookTitle: string) => void
}

export default function LibraryBooksTab({
  books,
  bookPag,
  bookSearch,
  setBookSearch,
  bookCategory,
  setBookCategory,
  deletingId,
  onFetchBooks,
  onOpenBorrow,
  onOpenEdit,
  onDeleteBook,
}: Props) {
  const t = useT('staff')

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div className="p-2.5 sm:p-3 border-b border-[var(--border)] flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 bg-[var(--bg2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 flex-1 min-w-[160px] min-h-[38px]">
          <span style={{ display: 'inline-flex' }}><Search size={14} strokeWidth={2} /></span>
          <input
            value={bookSearch}
            onChange={e => setBookSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onFetchBooks(1)}
            placeholder={t('library.searchPlaceholder')}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, width: '100%' }}
          />
        </div>
        <select value={bookCategory} onChange={e => setBookCategory(e.target.value)} style={filterSt} className="min-h-[38px] text-xs">
          <option value="">{t('library.allCategories')}</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(`library.${c.key}`)}</option>)}
        </select>
        <button style={btnSec} className="min-h-[38px] px-3 text-xs" onClick={() => onFetchBooks(1)}>{t('library.search')}</button>
        {bookCategory && (
          <button style={{ ...btnSec, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)' }} className="min-h-[38px] px-3 text-xs" onClick={() => { setBookCategory(''); onFetchBooks(1) }}>
            {t('library.reset')}
          </button>
        )}
      </div>

      {books.length === 0 ? (
        <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          {bookSearch ? t('library.noResults') : t('library.emptyCatalog')}
        </div>
      ) : (
        <>
          <div className="md:hidden divide-y divide-[var(--border)]">
            {books.map(b => (
              <div key={b.id} className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-sm text-[var(--text)] leading-snug">{b.title}</div>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: b.available === 0 ? 'var(--red-light)' : 'var(--green-light)', color: b.available === 0 ? 'var(--red)' : 'var(--green)', whiteSpace: 'nowrap' }}>
                    {b.available === 0 ? t('library.outOfStock') : t('library.availableCount', { count: b.available })}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text2)]">
                  {b.author && <div><span className="text-[var(--text3)]">Auteur:</span> {b.author}</div>}
                  {b.category && <div><span className="text-[var(--text3)]">Cat:</span> {b.category}</div>}
                  <div><span className="text-[var(--text3)]">Stock:</span> <span className="font-bold">{b.quantity}</span></div>
                </div>

                {b.isbn && (
                  <div className="text-[11px] text-[var(--text3)]">
                    ISBN: <code className="bg-[var(--bg2)] px-1.5 py-0.5 rounded">{b.isbn}</code>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid rgba(29,78,216,0.2)', cursor: b.available === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: b.available === 0 ? 0.5 : 1 }}
                    className="flex-1 min-h-[38px] flex items-center justify-center font-bold"
                    disabled={b.available === 0}
                    onClick={() => onOpenBorrow(b)}
                  >
                    {t('library.borrow')}
                  </button>
                  <button
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
                    className="min-h-[38px] px-3 flex items-center justify-center"
                    onClick={() => onOpenEdit(b)}
                  >
                    <Pencil size={14} strokeWidth={2} />
                  </button>
                  <button
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(153,27,27,0.2)', cursor: deletingId === b.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: deletingId === b.id ? 0.5 : 1 }}
                    className="min-h-[38px] px-3 flex items-center justify-center"
                    disabled={deletingId === b.id}
                    onClick={() => onDeleteBook(b.id, b.title)}
                  >
                    {deletingId === b.id ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr>{[t('library.tableHeaderTitle'), t('library.tableHeaderAuthor'), t('library.tableHeaderIsbn'), t('library.tableHeaderCategory'), t('library.tableHeaderStock'), t('library.tableHeaderAvailable'), t('library.tableHeaderActions')].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {books.map(b => (
                  <tr
                    key={b.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                  >
                    <td style={{ ...tdSt, fontWeight: 600, color: 'var(--text)', maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                    </td>
                    <td style={tdSt}>{b.author ?? '—'}</td>
                    <td style={tdSt}>{b.isbn ? <code style={{ background: 'var(--bg2)', padding: '2px 5px', borderRadius: 4, fontSize: 11.5 }}>{b.isbn}</code> : '—'}</td>
                    <td style={tdSt}>{b.category ?? '—'}</td>
                    <td style={tdSt}><span style={{ fontWeight: 600, color: 'var(--text)' }}>{b.quantity}</span></td>
                    <td style={tdSt}>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700, background: b.available === 0 ? 'var(--red-light)' : 'var(--green-light)', color: b.available === 0 ? 'var(--red)' : 'var(--green)' }}>
                        {b.available === 0 ? t('library.outOfStock') : t('library.availableCount', { count: b.available })}
                      </span>
                    </td>
                    <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
                      <button
                        style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid rgba(29,78,216,0.2)', cursor: b.available === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: b.available === 0 ? 0.5 : 1, marginRight: 5 }}
                        disabled={b.available === 0}
                        onClick={() => onOpenBorrow(b)}
                      >
                        {t('library.borrow')}
                      </button>
                      <button
                        style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', marginRight: 5 }}
                        onClick={() => onOpenEdit(b)}
                      >
                        <Pencil size={12} strokeWidth={2} />
                      </button>
                      <button
                        style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(153,27,27,0.2)', cursor: deletingId === b.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: deletingId === b.id ? 0.5 : 1 }}
                        disabled={deletingId === b.id}
                        onClick={() => onDeleteBook(b.id, b.title)}
                      >
                        {deletingId === b.id ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <Trash2 size={12} strokeWidth={2} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {bookPag.pages > 1 && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
          <button style={btnSec} disabled={bookPag.page <= 1} onClick={() => onFetchBooks(bookPag.page - 1)}>{t('library.previous')}</button>
          <span style={{ padding: '4px 8px', fontSize: 12, fontWeight: 600 }}>{bookPag.page}/{bookPag.pages}</span>
          <button style={btnSec} disabled={bookPag.page >= bookPag.pages} onClick={() => onFetchBooks(bookPag.page + 1)}>{t('library.next')}</button>
        </div>
      )}
    </div>
  )
}
