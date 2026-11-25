'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import type { useSyncQueue } from '@/hooks/useSyncQueue'
import type {
  Book,
  BookFormValues,
  BookLoan,
  BorrowFormState,
  Pagination,
} from './libraryTypes'

interface UseLibraryDataParams {
  isOnline: boolean
  addToQueue: ReturnType<typeof useSyncQueue>['addToQueue']
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const EMPTY_BOOK_FORM: BookFormValues = { title: '', author: '', isbn: '', quantity: '1', category: '' }
const EMPTY_BORROW_FORM: BorrowFormState = {
  bookId: '', bookTitle: '', studentSearch: '', studentResults: [],
  selectedStudent: null, dueDate: '', loading: false, error: '',
}

export function useLibraryData({ isOnline, addToQueue, onToast, t }: UseLibraryDataParams) {
  const [tab, setTab] = useState<'books' | 'loans'>('books')
  const [books, setBooks] = useState<Book[]>([])
  const [loans, setLoans] = useState<BookLoan[]>([])
  const [bookPag, setBookPag] = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loanPag, setLoanPag] = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookSearch, setBookSearch] = useState('')
  const [bookCategory, setBookCategory] = useState('')
  const [loanStatus, setLoanStatus] = useState('ACTIVE')
  const [returningId, setReturningId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [addBookOpen, setAddBookOpen] = useState(false)
  const [bookForm, setBookForm] = useState<BookFormValues>(EMPTY_BOOK_FORM)
  const [savingBook, setSavingBook] = useState(false)

  const [editBookOpen, setEditBookOpen] = useState(false)
  const [editBookId, setEditBookId] = useState<string | null>(null)
  const [editBookForm, setEditBookForm] = useState<BookFormValues>(EMPTY_BOOK_FORM)
  const [savingEditBook, setSavingEditBook] = useState(false)

  const [borrowOpen, setBorrowOpen] = useState(false)
  const [borrowForm, setBorrowForm] = useState<BorrowFormState>(EMPTY_BORROW_FORM)

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
  }, [bookSearch, bookCategory])

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

  useEffect(() => {
    if (tab === 'books') fetchBooks(1)
  }, [bookCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'loans') fetchLoans(1)
  }, [loanStatus]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const payload = {
      title: bookForm.title.trim(),
      author: bookForm.author || undefined,
      isbn: bookForm.isbn || undefined,
      quantity: bookForm.quantity,
      category: bookForm.category || undefined,
    }

    if (!isOnline) {
      await addToQueue({ type: 'LIBRARY_BOOK_CREATE', endpoint: '/api/v2/library/books', method: 'POST', payload })
      onToast(t('library.addQueued', { title: bookForm.title }), 'success')
      setAddBookOpen(false)
      setBookForm(EMPTY_BOOK_FORM)
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
      setBookForm(EMPTY_BOOK_FORM)
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
      setBorrowForm(EMPTY_BORROW_FORM)
      fetchBooks(1)
      if (tab === 'loans') fetchLoans(1)
    } catch (err) {
      setBorrowForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const deleteBook = async (bookId: string, bookTitle: string) => {
    if (!(await confirmAction(t('library.deleteConfirm', { title: bookTitle })))) return
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
    if (!(await confirmAction(t('library.returnConfirm', { title: bookTitle })))) return
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

  return {
    tab, setTab, books, loans, bookPag, loanPag, loading, error,
    bookSearch, setBookSearch, bookCategory, setBookCategory,
    loanStatus, setLoanStatus, returningId, deletingId,
    addBookOpen, setAddBookOpen, bookForm, setBookForm, savingBook,
    editBookOpen, setEditBookOpen, editBookForm, setEditBookForm, savingEditBook,
    borrowOpen, setBorrowOpen, borrowForm, setBorrowForm,
    renewOpen, setRenewOpen, renewDueDate, setRenewDueDate, renewing,
    fetchBooks, fetchLoans, addBook, openEditBook, submitEditBook,
    openRenew, submitRenew, searchStudents, submitBorrow, deleteBook, returnLoan,
  }
}
