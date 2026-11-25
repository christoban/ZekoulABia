import type React from 'react'

export interface Book {
  id: string
  title: string
  author: string | null
  isbn: string | null
  quantity: number
  available: number
  category: string | null
  createdAt: string
  _count?: { loans: number }
}

export interface StudentResult {
  id: string
  firstName: string
  lastName: string
}

export interface BookLoan {
  id: string
  status: string
  borrowedAt: string
  dueDate: string | null
  returnedAt: string | null
  book: { id: string; title: string; author: string | null; isbn: string | null }
  student: { id: string; firstName: string; lastName: string }
}

export interface Pagination {
  total: number
  page: number
  pages: number
}

export interface BookFormValues {
  title: string
  author: string
  isbn: string
  quantity: string
  category: string
}

export interface BorrowFormState {
  bookId: string
  bookTitle: string
  studentSearch: string
  studentResults: StudentResult[]
  selectedStudent: StudentResult | null
  dueDate: string
  loading: boolean
  error: string
}

export const LOAN_STATUS: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: 'var(--amber-light)', color: 'var(--amber)' },
  RETURNED: { bg: 'var(--green-light)', color: 'var(--green)' },
  OVERDUE:  { bg: 'var(--red-light)', color: 'var(--red)' },
}

export const CATEGORIES = [
  { value: 'Manuel / Ouvrage au programme', key: 'catManual' },
  { value: 'Roman / Œuvre littéraire au programme', key: 'catLiterature' },
  { value: 'Lecture libre / Culture générale', key: 'catFreeReading' },
  { value: 'Référence / Encyclopédie / Dictionnaire', key: 'catReference' },
  { value: 'Autre', key: 'catOther' },
]

export const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }
export const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
export const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
export const btnSec: React.CSSProperties = { padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
export const btnRetry: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }
export const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
export const inputSt: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--text)', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box' }
export const labelSt: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }
export const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
export const tdSt: React.CSSProperties = { padding: '8px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
