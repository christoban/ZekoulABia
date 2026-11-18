'use client'
import type React from 'react'
import { BookOpen, Check, Loader2, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  type BookFormValues,
  type BorrowFormState,
  CATEGORIES,
  btnPrim,
  btnSec,
  inputSt,
  labelSt,
} from './libraryTypes'

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200,
}

const modalTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 14,
}

export function LibraryBookFormModal({
  mode,
  form,
  setForm,
  saving,
  onSubmit,
  onClose,
}: {
  mode: 'add' | 'edit'
  form: BookFormValues
  setForm: React.Dispatch<React.SetStateAction<BookFormValues>>
  saving: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  const isAdd = mode === 'add'
  const fields: { label: string; key: 'title' | 'author' | 'isbn'; placeholder?: string }[] = [
    { label: t('library.titleLabel'), key: 'title', ...(isAdd ? { placeholder: 'Mathématiques 1re C' } : {}) },
    { label: t('library.authorLabel'), key: 'author', ...(isAdd ? { placeholder: 'Jean Dupont' } : {}) },
    { label: t('library.isbnLabel'), key: 'isbn', ...(isAdd ? { placeholder: '978-2-...' } : {}) },
  ]

  return (
    <>
      <div onClick={onClose} style={overlayStyle} />
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 14, width: 460, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.14)' }}>
        <div style={modalTitleStyle}>{isAdd ? t('library.addBookModalTitle') : t('library.editBookModalTitle')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={labelSt}>{f.label}</label>
              <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={inputSt} />
            </div>
          ))}
          <div>
            <label style={labelSt}>{t('library.categoryLabel')}</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputSt, cursor: 'pointer' }}>
              <option value="">{t('library.categoryPlaceholder')}</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(`library.${c.key}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>{t('library.copiesLabel')}</label>
            <input type="number" min="1" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} style={inputSt} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnSec} onClick={onClose}>{t('library.cancel')}</button>
          <button style={btnPrim} onClick={onSubmit} disabled={saving}>
            {saving ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : isAdd ? t('library.add') : t('library.save')}
          </button>
        </div>
      </div>
    </>
  )
}

export function LibraryRenewModal({
  dueDate,
  setDueDate,
  renewing,
  onSubmit,
  onClose,
}: {
  dueDate: string
  setDueDate: (val: string) => void
  renewing: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  return (
    <>
      <div onClick={onClose} style={overlayStyle} />
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 14, width: 400, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.14)' }}>
        <div style={modalTitleStyle}>{t('library.renewModalTitle')}</div>
        <div>
          <label style={labelSt}>{t('library.newDueDateLabel')}</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputSt} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnSec} onClick={onClose}>{t('library.cancel')}</button>
          <button style={btnPrim} onClick={onSubmit} disabled={renewing}>{renewing ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : t('library.renew')}</button>
        </div>
      </div>
    </>
  )
}

export function LibraryBorrowModal({
  form,
  setForm,
  onSearchStudents,
  onSubmit,
  onClose,
}: {
  form: BorrowFormState
  setForm: React.Dispatch<React.SetStateAction<BorrowFormState>>
  onSearchStudents: (q: string) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  return (
    <>
      <div onClick={onClose} style={overlayStyle} />
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 14, width: 460, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.14)' }}>
        <div style={modalTitleStyle}>{t('library.addLoanModalTitle')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelSt}>{t('library.bookLabel')}</label>
            {form.bookId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 8, border: '1px solid rgba(142,42,58,0.3)' }}>
                <span style={{ fontWeight: 600, color: 'var(--green)', flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><BookOpen size={15} strokeWidth={2} /> {form.bookTitle}</span>
                <button onClick={() => setForm(f => ({ ...f, bookId: '', bookTitle: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 15, display: 'inline-flex' }}><X size={15} strokeWidth={2} /></button>
              </div>
            ) : (
              <input value="" onChange={() => {}} placeholder={t('library.selectBookFirst')} style={{ ...inputSt, cursor: 'default', background: 'var(--bg2)' }} readOnly />
            )}
          </div>

          <div>
            <label style={labelSt}>{t('library.studentLabel')}</label>
            {form.selectedStudent ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 8, border: '1px solid rgba(142,42,58,0.3)' }}>
                <span style={{ fontWeight: 600, color: 'var(--green)', flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><Check size={15} strokeWidth={2} /> {form.selectedStudent.firstName} {form.selectedStudent.lastName}</span>
                <button onClick={() => setForm(f => ({ ...f, selectedStudent: null, studentSearch: '', studentResults: [] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 15, display: 'inline-flex' }}><X size={15} strokeWidth={2} /></button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  value={form.studentSearch}
                  onChange={e => { setForm(f => ({ ...f, studentSearch: e.target.value })); onSearchStudents(e.target.value) }}
                  placeholder={t('library.studentSearchPlaceholder')}
                  style={inputSt}
                />
                {form.studentResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
                    {form.studentResults.map(s => (
                      <div
                        key={s.id}
                        onClick={() => setForm(f => ({ ...f, selectedStudent: s, studentSearch: '', studentResults: [] }))}
                        style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--bg)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                      >
                        {s.firstName} {s.lastName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label style={labelSt}>{t('library.dueDateLabel')}</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inputSt} />
          </div>

          {form.error && (
            <div style={{ padding: '8px 12px', background: 'var(--red-light)', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--red)' }}>{form.error}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnSec} onClick={onClose}>{t('library.cancel')}</button>
          <button style={btnPrim} onClick={onSubmit} disabled={form.loading || !form.bookId}>
            {form.loading ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : t('library.save')}
          </button>
        </div>
      </div>
    </>
  )
}
