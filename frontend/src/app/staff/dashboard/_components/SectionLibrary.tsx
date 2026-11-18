'use client'
import { AlertTriangle, BookOpen, CheckCircle2, WifiOff } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { btnPrim, btnRetry, btnSec, sSub, sTitle } from './library/libraryTypes'
import { useLibraryData } from './library/useLibraryData'
import LibraryBooksTab from './library/LibraryBooksTab'
import LibraryLoansTab from './library/LibraryLoansTab'
import { LibraryBookFormModal, LibraryBorrowModal, LibraryRenewModal } from './library/LibraryModals'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionLibrary({ onToast }: Props) {
  const t = useT('staff')
  const { isOnline, addToQueue } = useSyncQueue()
  const lib = useLibraryData({ isOnline, addToQueue, onToast, t })

  const totalAvailable = lib.books.reduce((s, b) => s + b.available, 0)
  const totalBooks = lib.books.reduce((s, b) => s + b.quantity, 0)
  const activeLoans = lib.tab === 'loans' && lib.loanStatus === 'ACTIVE' ? lib.loanPag.total : null

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <div style={sTitle}>{t('library.title')}</div>
          <div style={sSub}>{t('library.subtitle')}</div>
        </div>
        <div className="flex items-center gap-2">
          <button style={btnSec} className="min-h-[38px] flex-1 sm:flex-initial" onClick={() => lib.setAddBookOpen(true)}>{t('library.addBook')}</button>
          <button style={btnPrim} className="min-h-[38px] flex-1 sm:flex-initial" onClick={() => lib.setBorrowOpen(true)}>{t('library.addLoan')}</button>
        </div>
      </div>

      {!isOnline && lib.tab === 'books' && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>{t('library.offlineHint')}</span>
        </div>
      )}

      {lib.tab === 'books' && !lib.loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-3.5">
          {[
            { icon: <BookOpen size={16} strokeWidth={2} />, bg: 'var(--blue-light)', val: String(lib.bookPag.total), label: t('library.kpiTitles'), color: 'var(--blue)' },
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

      <div style={{ display: 'flex', gap: 2, background: 'var(--bg2)', padding: 3, borderRadius: 8, marginBottom: 14, width: 'fit-content' }}>
        {(['books', 'loans'] as const).map(tabKey => (
          <button
            key={tabKey}
            onClick={() => lib.setTab(tabKey)}
            className="min-h-[36px]"
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: lib.tab === tabKey ? 'white' : 'transparent', color: lib.tab === tabKey ? 'var(--text)' : 'var(--text3)', boxShadow: lib.tab === tabKey ? '0 1px 3px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.12s' }}
          >
            {tabKey === 'books' ? t('library.tabCatalog') : `${t('library.tabLoans')}${activeLoans != null ? ` (${activeLoans})` : ''}`}
          </button>
        ))}
      </div>

      {lib.loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 26, height: 26, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!lib.loading && lib.error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={15} strokeWidth={2} /></span>
          <span style={{ fontWeight: 600, color: 'var(--red)', flex: 1, fontSize: 12.5 }}>{lib.error}</span>
          <button onClick={() => lib.tab === 'books' ? lib.fetchBooks(1) : lib.fetchLoans(1)} style={btnRetry}>{t('library.retry')}</button>
        </div>
      )}

      {!lib.loading && !lib.error && lib.tab === 'books' && (
        <LibraryBooksTab
          books={lib.books}
          bookPag={lib.bookPag}
          bookSearch={lib.bookSearch}
          setBookSearch={lib.setBookSearch}
          bookCategory={lib.bookCategory}
          setBookCategory={lib.setBookCategory}
          deletingId={lib.deletingId}
          onFetchBooks={lib.fetchBooks}
          onOpenBorrow={(b) => { lib.setBorrowForm(f => ({ ...f, bookId: b.id, bookTitle: b.title })); lib.setBorrowOpen(true) }}
          onOpenEdit={lib.openEditBook}
          onDeleteBook={lib.deleteBook}
        />
      )}

      {!lib.loading && !lib.error && lib.tab === 'loans' && (
        <LibraryLoansTab
          loans={lib.loans}
          loanPag={lib.loanPag}
          loanStatus={lib.loanStatus}
          setLoanStatus={lib.setLoanStatus}
          returningId={lib.returningId}
          onFetchLoans={lib.fetchLoans}
          onReturnLoan={lib.returnLoan}
          onOpenRenew={lib.openRenew}
        />
      )}

      {lib.addBookOpen && (
        <LibraryBookFormModal
          mode="add"
          form={lib.bookForm}
          setForm={lib.setBookForm}
          saving={lib.savingBook}
          onSubmit={lib.addBook}
          onClose={() => lib.setAddBookOpen(false)}
        />
      )}

      {lib.editBookOpen && (
        <LibraryBookFormModal
          mode="edit"
          form={lib.editBookForm}
          setForm={lib.setEditBookForm}
          saving={lib.savingEditBook}
          onSubmit={lib.submitEditBook}
          onClose={() => lib.setEditBookOpen(false)}
        />
      )}

      {lib.renewOpen && (
        <LibraryRenewModal
          dueDate={lib.renewDueDate}
          setDueDate={lib.setRenewDueDate}
          renewing={lib.renewing}
          onSubmit={lib.submitRenew}
          onClose={() => lib.setRenewOpen(false)}
        />
      )}

      {lib.borrowOpen && (
        <LibraryBorrowModal
          form={lib.borrowForm}
          setForm={lib.setBorrowForm}
          onSearchStudents={lib.searchStudents}
          onSubmit={lib.submitBorrow}
          onClose={() => lib.setBorrowOpen(false)}
        />
      )}
    </div>
  )
}
