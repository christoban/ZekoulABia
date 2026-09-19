'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { BookOpen, CheckCircle2, AlertTriangle, Search, Loader2, Trash2, Check, X, Pencil, RefreshCw, WifiOff } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface Book {
  id: string; title: string; author: string | null; isbn: string | null
  quantity: number; available: number; category: string | null; createdAt: string
  _count?: { loans: number }
}

interface StudentResult { id: string; firstName: string; lastName: string }

interface BookLoan {
  id: string; status: string; borrowedAt: string; dueDate: string | null; returnedAt: string | null
  book: { id: string; title: string; author: string | null; isbn: string | null }
  student: { id: string; firstName: string; lastName: string }
}

interface Pagination { total: number; page: number; pages: number }

const LOAN_STATUS: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: 'var(--amber-light)', color: 'var(--amber)' },
  RETURNED: { bg: 'var(--green-light)', color: 'var(--green)' },
  OVERDUE:  { bg: 'var(--red-light)', color: 'var(--red)' },
}

const CATEGORIES = [
  { value: 'Manuel / Ouvrage au programme', key: 'catManual' },
  { value: 'Roman / Œuvre littéraire au programme', key: 'catLiterature' },
  { value: 'Lecture libre / Culture générale', key: 'catFreeReading' },
  { value: 'Référence / Encyclopédie / Dictionnaire', key: 'catReference' },
  { value: 'Autre', key: 'catOther' },
]

export default function SectionLibrary({ onToast }: Props) {
  const t = useT('staff')
  const [tab, setTab]             = useState<'books' | 'loans'>('books')
  const [books, setBooks]         = useState<Book[]>([])
  const [loans, setLoans]         = useState<BookLoan[]>([])
  const [bookPag, setBookPag]     = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loanPag, setLoanPag]     = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [bookSearch, setBookSearch] = useState('')
  const [bookCategory, setBookCategory] = useState('')
  const [loanStatus, setLoanStatus] = useState('ACTIVE')
  const [returningId, setReturningId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { isOnline, addToQueue } = useSyncQueue()

  // ── Modal ajout livre ──
  const [addBookOpen, setAddBookOpen] = useState(false)
  const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '', quantity: '1', category: '' })
  const [savingBook, setSavingBook] = useState(false)

  // ── Modal modification livre ──
  const [editBookOpen, setEditBookOpen] = useState(false)
  const [editBookId, setEditBookId] = useState<string | null>(null)
  const [editBookForm, setEditBookForm] = useState({ title: '', author: '', isbn: '', quantity: '1', category: '' })
  const [savingEditBook, setSavingEditBook] = useState(false)

  // ── Modal emprunt ──
  const [borrowOpen, setBorrowOpen] = useState(false)
  const [borrowForm, setBorrowForm] = useState({ bookId: '', bookTitle: '', studentSearch: '', studentResults: [] as StudentResult[], selectedStudent: null as StudentResult | null, dueDate: '', loading: false, error: '' })

  // ── Modal renouvellement emprunt ──
  const [renewOpen, setRenewOpen] = useState(false)
  const [renewLoanId, setRenewLoanId] = useState<string | null>(null)
  const [renewDueDate, setRenewDueDate] = useState('')
  const [renewing, setRenewing] = useState(false)

  const fetchBooks = useCallback(async (page = 1) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page) })
      if (bookSearch) params.set('search', bookSearch)
      if (bookCategory) params.set('category', bookCategory)
      const res = await fetchApi(`/api/v2/library/books?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setBooks(data.data || [])
      setBookPag(data.pagination ?? { total: 0, page, pages: 1 })
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') }
    finally { setLoading(false) }
  }, [bookSearch])

  const fetchLoans = useCallback(async (page = 1) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page) })
      if (loanStatus) params.set('status', loanStatus)
      const res = await fetchApi(`/api/v2/library/loans?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setLoans(data.data || [])
      setLoanPag(data.pagination ?? { total: 0, page, pages: 1 })
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') }
    finally { setLoading(false) }
  }, [loanStatus])

  useEffect(() => {
    if (tab === 'books') fetchBooks(1)
    else fetchLoans(1)
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rafraîchissement temps réel quand l'assistant IA enregistre un emprunt/retour de livre.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'bookLoan') {
        if (tab === 'books') fetchBooks(1); else fetchLoans(1)
      }
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [tab, fetchBooks, fetchLoans])

  const addBook = async () => {
    if (!bookForm.title.trim()) { onToast(t('library.titleRequired'), 'error'); return }

    const payload = { title: bookForm.title.trim(), author: bookForm.author || undefined, isbn: bookForm.isbn || undefined, quantity: bookForm.quantity, category: bookForm.category || undefined }

    if (!isOnline) {
      await addToQueue({ type: 'LIBRARY_BOOK_CREATE', endpoint: '/api/v2/library/books', method: 'POST', payload })
      onToast(t('library.addQueued', { title: bookForm.title }), 'success')
      setAddBookOpen(false)
      setBookForm({ title: '', author: '', isbn: '', quantity: '1', category: '' })
      return
    }

    setSavingBook(true)
    try {
      const res = await fetchApi('/api/v2/library/books', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('library.addSuccess', { title: bookForm.title }), 'success')
      setAddBookOpen(false)
      setBookForm({ title: '', author: '', isbn: '', quantity: '1', category: '' })
      fetchBooks(1)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setSavingBook(false) }
  }

  const openEditBook = (b: Book) => {
    setEditBookId(b.id)
    setEditBookForm({ title: b.title, author: b.author ?? '', isbn: b.isbn ?? '', quantity: String(b.quantity), category: b.category ?? '' })
    setEditBookOpen(true)
  }

  const submitEditBook = async () => {
    if (!editBookId || !editBookForm.title.trim()) { onToast(t('library.titleRequired'), 'error'); return }

    const payload = {
      title: editBookForm.title.trim(),
      author: editBookForm.author || null,
      isbn: editBookForm.isbn || null,
      category: editBookForm.category || null,
      quantity: Math.max(1, parseInt(editBookForm.quantity) || 1),
    }

    if (!isOnline) {
      await addToQueue({ type: 'LIBRARY_BOOK_UPDATE', endpoint: `/api/v2/library/books/${editBookId}`, method: 'PATCH', payload })
      onToast(t('library.editQueued', { title: editBookForm.title }), 'success')
      setEditBookOpen(false)
      setEditBookId(null)
      return
    }

    setSavingEditBook(true)
    try {
      const res = await fetchApi(`/api/v2/library/books/${editBookId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('library.editSuccess', { title: editBookForm.title }), 'success')
      setEditBookOpen(false)
      setEditBookId(null)
      fetchBooks(bookPag.page)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setSavingEditBook(false) }
  }

  const openRenew = (loanId: string, currentDueDate: string | null) => {
    setRenewLoanId(loanId)
    const base = currentDueDate && new Date(currentDueDate) > new Date() ? new Date(currentDueDate) : new Date()
    base.setDate(base.getDate() + 14)
    setRenewDueDate(base.toISOString().slice(0, 10))
    setRenewOpen(true)
  }

  const submitRenew = async () => {
    if (!renewLoanId || !renewDueDate) return
    setRenewing(true)
    try {
      const res = await fetchApi(`/api/v2/library/loans/${renewLoanId}/renew`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: renewDueDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('library.renewSuccess'), 'success')
      setRenewOpen(false)
      setRenewLoanId(null)
      fetchLoans(loanPag.page)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setRenewing(false) }
  }

  const searchStudents = async (q: string) => {
    if (q.trim().length < 2) { setBorrowForm(f => ({ ...f, studentResults: [] })); return }
    try {
      const res = await fetchApi(`/api/v2/users?role=STUDENT&search=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' })
      const data = await res.json()
      setBorrowForm(f => ({ ...f, studentResults: data.data || [] }))
    } catch { setBorrowForm(f => ({ ...f, studentResults: [] })) }
  }

  const submitBorrow = async () => {
    if (!borrowForm.bookId || !borrowForm.selectedStudent) { setBorrowForm(f => ({ ...f, error: t('library.bookRequired') })); return }
    setBorrowForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/library/loans', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: borrowForm.bookId, studentId: borrowForm.selectedStudent.id, dueDate: borrowForm.dueDate || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('library.loanRegistered', { firstName: borrowForm.selectedStudent.firstName, lastName: borrowForm.selectedStudent.lastName }), 'success')
      setBorrowOpen(false)
      setBorrowForm({ bookId: '', bookTitle: '', studentSearch: '', studentResults: [], selectedStudent: null, dueDate: '', loading: false, error: '' })
      fetchBooks(1)
      if (tab === 'loans') fetchLoans(1)
    } catch (err) {
      setBorrowForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const deleteBook = async (bookId: string, bookTitle: string) => {
    if (!confirm(t('library.deleteConfirm', { title: bookTitle }))) return
    setDeletingId(bookId)
    try {
      const res = await fetchApi(`/api/v2/library/books/${bookId}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('library.deleteSuccess', { title: bookTitle }), 'success')
      fetchBooks(bookPag.page)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setDeletingId(null) }
  }

  const returnLoan = async (loanId: string, bookTitle: string) => {
    if (!confirm(t('library.returnConfirm', { title: bookTitle }))) return
    setReturningId(loanId)
    try {
      const res = await fetchApi(`/api/v2/library/loans/${loanId}/return`, { method: 'PATCH', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('library.returnSuccess'), 'success')
      fetchLoans(1)
      fetchBooks(1)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setReturningId(null) }
  }

  const totalAvailable = books.reduce((s, b) => s + b.available, 0)
  const totalBooks = books.reduce((s, b) => s + b.quantity, 0)
  const activeLoans = tab === 'loans' && loanStatus === 'ACTIVE' ? loanPag.total : null

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={sTitle}>{t('library.title')}</div>
          <div style={sSub}>{t('library.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnSec} onClick={() => setAddBookOpen(true)}>{t('library.addBook')}</button>
          <button style={btnPrim} onClick={() => setBorrowOpen(true)}>{t('library.addLoan')}</button>
        </div>
      </div>

      {!isOnline && tab === 'books' && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>{t('library.offlineHint')}</span>
        </div>
      )}

      {/* KPIs */}
      {tab === 'books' && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { icon: <BookOpen size={16} strokeWidth={2} />, bg: 'var(--blue-light)', val: String(bookPag.total), label: t('library.kpiTitles'), color: 'var(--blue)' },
            { icon: <CheckCircle2 size={16} strokeWidth={2} />, bg: 'var(--green-light)', val: String(totalAvailable), label: t('library.kpiAvailable'), color: 'var(--green)' },
            { icon: <BookOpen size={16} strokeWidth={2} />, bg: 'var(--amber-light)', val: String(totalBooks - totalAvailable), label: t('library.kpiBorrowed'), color: 'var(--amber)' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '10px 14px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>{k.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--bg2)', padding: 3, borderRadius: 8, marginBottom: 14, width: 'fit-content' }}>
        {(['books', 'loans'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: tab === tabKey ? 'white' : 'transparent', color: tab === tabKey ? 'var(--text)' : 'var(--text3)', boxShadow: tab === tabKey ? '0 1px 3px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.12s' }}>
            {tabKey === 'books' ? t('library.tabCatalog') : `${t('library.tabLoans')}${activeLoans != null ? ` (${activeLoans})` : ''}`}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 26, height: 26, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={15} strokeWidth={2} /></span><span style={{ fontWeight: 600, color: 'var(--red)', flex: 1, fontSize: 12.5 }}>{error}</span>
          <button onClick={() => tab === 'books' ? fetchBooks(1) : fetchLoans(1)} style={btnRetry}>{t('library.retry')}</button>
        </div>
      )}

      {/* Catalogue */}
      {!loading && !error && tab === 'books' && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', flex: 1, minWidth: 160 }}>
              <span style={{ display: 'inline-flex' }}><Search size={14} strokeWidth={2} /></span>
              <input value={bookSearch} onChange={e => setBookSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchBooks(1)}
                placeholder={t('library.searchPlaceholder')}
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
            </div>
            <select value={bookCategory} onChange={e => setBookCategory(e.target.value)} style={filterSt}>
              <option value="">{t('library.allCategories')}</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(`library.${c.key}`)}</option>)}
            </select>
            <button style={btnSec} onClick={() => fetchBooks(1)}>{t('library.search')}</button>
            {bookCategory && <button style={{ ...btnSec, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)' }} onClick={() => { setBookCategory(''); fetchBooks(1) }}>{t('library.reset')}</button>}
          </div>

          {books.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              {bookSearch ? t('library.noResults') : t('library.emptyCatalog')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                <thead>
                  <tr>{[t('library.tableHeaderTitle'), t('library.tableHeaderAuthor'), t('library.tableHeaderIsbn'), t('library.tableHeaderCategory'), t('library.tableHeaderStock'), t('library.tableHeaderAvailable'), t('library.tableHeaderActions')].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {books.map(b => (
                    <tr key={b.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
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
                          onClick={() => { setBorrowForm(f => ({ ...f, bookId: b.id, bookTitle: b.title })); setBorrowOpen(true) }}>
                          {t('library.borrow')}
                        </button>
                        <button
                          style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', marginRight: 5 }}
                          onClick={() => openEditBook(b)}>
                          <Pencil size={12} strokeWidth={2} />
                        </button>
                        <button
                          style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(153,27,27,0.2)', cursor: deletingId === b.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: deletingId === b.id ? 0.5 : 1 }}
                          disabled={deletingId === b.id}
                          onClick={() => deleteBook(b.id, b.title)}>
                          {deletingId === b.id ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <Trash2 size={12} strokeWidth={2} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {bookPag.pages > 1 && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
              <button style={btnSec} disabled={bookPag.page <= 1} onClick={() => fetchBooks(bookPag.page - 1)}>{t('library.previous')}</button>
              <span style={{ padding: '4px 8px', fontSize: 12, fontWeight: 600 }}>{bookPag.page}/{bookPag.pages}</span>
              <button style={btnSec} disabled={bookPag.page >= bookPag.pages} onClick={() => fetchBooks(bookPag.page + 1)}>{t('library.next')}</button>
            </div>
          )}
        </div>
      )}

      {/* Emprunts */}
      {!loading && !error && tab === 'loans' && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={loanStatus} onChange={e => setLoanStatus(e.target.value)} style={filterSt}>
              <option value="ACTIVE">{t('library.filterActive')}</option>
              <option value="RETURNED">{t('library.filterReturned')}</option>
              <option value="OVERDUE">{t('library.filterOverdue')}</option>
              <option value="">{t('library.filterAll')}</option>
            </select>
            <button style={btnSec} onClick={() => fetchLoans(1)}>{t('library.filter')}</button>
          </div>

          {loans.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              {loanStatus === 'ACTIVE' ? t('library.noLoansActive') : loanStatus === 'RETURNED' ? t('library.noLoansReturned') : t('library.noLoansOverdue')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
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
                      <tr key={l.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={{ ...tdSt, fontWeight: 600, color: 'var(--text)' }}>{l.student.firstName} {l.student.lastName}</td>
                        <td style={tdSt}>
                          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{l.book.title}</div>
                          {l.book.author && <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{l.book.author}</div>}
                        </td>
                        <td style={tdSt}>{new Date(l.borrowedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
                        <td style={tdSt}>
                          {l.dueDate ? (
                            <span style={{ fontWeight: 600, color: isOverdue ? 'var(--red)' : 'var(--text2)' }}>
                              {isOverdue && <AlertTriangle size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />}{new Date(l.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
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
                                style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.25)', cursor: 'pointer', fontFamily: 'inherit', marginRight: 5 }}
                                onClick={() => returnLoan(l.id, l.book.title)}
                                disabled={returningId === l.id}>
                                {returningId === l.id ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : t('library.return')}
                              </button>
                              <button
                                style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid rgba(29,78,216,0.2)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={() => openRenew(l.id, l.dueDate)}>
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
          )}
          {loanPag.pages > 1 && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button style={btnSec} disabled={loanPag.page <= 1} onClick={() => fetchLoans(loanPag.page - 1)}>{t('library.previous')}</button>
              <span style={{ padding: '6px 12px', fontSize: 14, fontWeight: 700 }}>{loanPag.page}/{loanPag.pages}</span>
              <button style={btnSec} disabled={loanPag.page >= loanPag.pages} onClick={() => fetchLoans(loanPag.page + 1)}>{t('library.next')}</button>
            </div>
          )}
        </div>
      )}

      {/* Modal ajouter livre */}
      {addBookOpen && (
        <>
          <div onClick={() => setAddBookOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div className="px-4 py-4 md:px-6 md:py-5" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 14, width: 460, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.14)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('library.addBookModalTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { label: t('library.titleLabel'), key: 'title', placeholder: 'Mathématiques 1re C' },
                { label: t('library.authorLabel'), key: 'author', placeholder: 'Jean Dupont' },
                { label: t('library.isbnLabel'), key: 'isbn', placeholder: '978-2-...' },
              ] as { label: string; key: keyof typeof bookForm; placeholder: string }[]).map(f => (
                <div key={f.key}>
                  <label style={labelSt}>{f.label}</label>
                  <input value={bookForm[f.key]} onChange={e => setBookForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} style={inputSt} />
                </div>
              ))}
              <div>
                <label style={labelSt}>{t('library.categoryLabel')}</label>
                <select value={bookForm.category} onChange={e => setBookForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputSt, cursor: 'pointer' }}>
                  <option value="">{t('library.categoryPlaceholder')}</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(`library.${c.key}`)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>{t('library.copiesLabel')}</label>
                <input type="number" min="1" value={bookForm.quantity} onChange={e => setBookForm(p => ({ ...p, quantity: e.target.value }))} style={inputSt} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={btnSec} onClick={() => setAddBookOpen(false)}>{t('library.cancel')}</button>
              <button style={btnPrim} onClick={addBook} disabled={savingBook}>{savingBook ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : t('library.add')}</button>
            </div>
          </div>
        </>
      )}

      {/* Modal modification livre */}
      {editBookOpen && (
        <>
          <div onClick={() => setEditBookOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div className="px-4 py-4 md:px-6 md:py-5" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 14, width: 460, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.14)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('library.editBookModalTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { label: t('library.titleLabel'), key: 'title' },
                { label: t('library.authorLabel'), key: 'author' },
                { label: t('library.isbnLabel'), key: 'isbn' },
              ] as { label: string; key: keyof typeof editBookForm }[]).map(f => (
                <div key={f.key}>
                  <label style={labelSt}>{f.label}</label>
                  <input value={editBookForm[f.key]} onChange={e => setEditBookForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputSt} />
                </div>
              ))}
              <div>
                <label style={labelSt}>{t('library.categoryLabel')}</label>
                <select value={editBookForm.category} onChange={e => setEditBookForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputSt, cursor: 'pointer' }}>
                  <option value="">{t('library.categoryPlaceholder')}</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(`library.${c.key}`)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>{t('library.copiesLabel')}</label>
                <input type="number" min="1" value={editBookForm.quantity} onChange={e => setEditBookForm(p => ({ ...p, quantity: e.target.value }))} style={inputSt} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={btnSec} onClick={() => setEditBookOpen(false)}>{t('library.cancel')}</button>
              <button style={btnPrim} onClick={submitEditBook} disabled={savingEditBook}>{savingEditBook ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : t('library.save')}</button>
            </div>
          </div>
        </>
      )}

      {/* Modal renouvellement emprunt */}
      {renewOpen && (
        <>
          <div onClick={() => setRenewOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div className="px-4 py-4 md:px-6 md:py-5" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 14, width: 400, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.14)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('library.renewModalTitle')}</div>
            <div>
              <label style={labelSt}>{t('library.newDueDateLabel')}</label>
              <input type="date" value={renewDueDate} onChange={e => setRenewDueDate(e.target.value)} style={inputSt} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={btnSec} onClick={() => setRenewOpen(false)}>{t('library.cancel')}</button>
              <button style={btnPrim} onClick={submitRenew} disabled={renewing}>{renewing ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : t('library.renew')}</button>
            </div>
          </div>
        </>
      )}

      {/* Modal emprunt */}
      {borrowOpen && (
        <>
          <div onClick={() => setBorrowOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div className="px-4 py-4 md:px-6 md:py-5" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 14, width: 460, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.14)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('library.addLoanModalTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Livre */}
              <div>
                <label style={labelSt}>{t('library.bookLabel')}</label>
                {borrowForm.bookId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 8, border: '1px solid rgba(5,150,105,0.3)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--green)', flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><BookOpen size={15} strokeWidth={2} /> {borrowForm.bookTitle}</span>
                    <button onClick={() => setBorrowForm(f => ({ ...f, bookId: '', bookTitle: '' }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 15, display: 'inline-flex' }}><X size={15} strokeWidth={2} /></button>
                  </div>
                ) : (
                  <input
                    value=""
                    onChange={() => {}}
                    placeholder={t('library.selectBookFirst')}
                    style={{ ...inputSt, cursor: 'default', background: 'var(--bg2)' }}
                    readOnly
                  />
                )}
              </div>

              {/* Élève */}
              <div>
                <label style={labelSt}>{t('library.studentLabel')}</label>
                {borrowForm.selectedStudent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 8, border: '1px solid rgba(5,150,105,0.3)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--green)', flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><Check size={15} strokeWidth={2} /> {borrowForm.selectedStudent.firstName} {borrowForm.selectedStudent.lastName}</span>
                    <button onClick={() => setBorrowForm(f => ({ ...f, selectedStudent: null, studentSearch: '', studentResults: [] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 15, display: 'inline-flex' }}><X size={15} strokeWidth={2} /></button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      value={borrowForm.studentSearch}
                      onChange={e => { setBorrowForm(f => ({ ...f, studentSearch: e.target.value })); searchStudents(e.target.value) }}
                      placeholder={t('library.studentSearchPlaceholder')}
                      style={inputSt}
                    />
                    {borrowForm.studentResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
                        {borrowForm.studentResults.map(s => (
                          <div key={s.id}
                            onClick={() => setBorrowForm(f => ({ ...f, selectedStudent: s, studentSearch: '', studentResults: [] }))}
                            style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--bg)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                            {s.firstName} {s.lastName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Date limite */}
              <div>
                <label style={labelSt}>{t('library.dueDateLabel')}</label>
                <input type="date" value={borrowForm.dueDate} onChange={e => setBorrowForm(f => ({ ...f, dueDate: e.target.value }))} style={inputSt} />
              </div>

              {borrowForm.error && (
                <div style={{ padding: '8px 12px', background: 'var(--red-light)', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--red)' }}>{borrowForm.error}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={btnSec} onClick={() => setBorrowOpen(false)}>{t('library.cancel')}</button>
              <button style={btnPrim} onClick={submitBorrow} disabled={borrowForm.loading || !borrowForm.bookId}>
                {borrowForm.loading ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : t('library.save')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const inputSt: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--text)', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box' }
const labelSt: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
