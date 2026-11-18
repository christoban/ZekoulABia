'use client'
import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { serieToFiliere, isCollegLevel, inferFromName } from '@/features/classes/classesShared'
import {
  ClassModalOverlay,
  FILIERE_VALUES,
  SECOND_CYCLE_SERIES_VALUES,
  btnPrim,
  btnSec2,
  getCollegeFiliereOptions,
  sError,
  sInput,
  sInputCls,
  sLabel,
  sLabelCls,
  sModalTitle,
  sModalTitleCls,
  type ClassItem,
  type ClassTarget,
  type SchoolInfo,
  type ToastFn,
} from './classesUi'

interface CreateModalProps {
  open: boolean
  schoolInfo: SchoolInfo | null
  onClose: () => void
  onCreated: () => void
  onToast: ToastFn
}

const EMPTY_CREATE = { name: '', level: '', filiere: '', serie: '', capacity: '40', loading: false, error: '' }

export function CreateClassModal({ open, schoolInfo, onClose, onCreated, onToast }: CreateModalProps) {
  const t = useT('admin')
  const [form, setForm] = useState(EMPTY_CREATE)

  if (!open) return null

  const secondCycleSeries = SECOND_CYCLE_SERIES_VALUES.map((v, i) => ({
    value: v, label: t(`classes.second_cycle_series.${i}.label`),
  }))
  const filiereOptions = FILIERE_VALUES.map((v, i) => ({
    value: v, label: t(`classes.filiere_options.${i}.label`),
  }))
  const college = isCollegLevel(form.level, form.name)

  const handleClose = () => {
    setForm(EMPTY_CREATE)
    onClose()
  }

  const submitCreate = async () => {
    if (!form.name.trim()) {
      setForm(f => ({ ...f, error: t('classes.create_modal.error_required') }))
      return
    }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/classes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          level: form.level || undefined,
          filiere: form.filiere || undefined,
          serie: form.serie || undefined,
          capacity: parseInt(form.capacity) || 40,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.toast.created').replace('{name}', form.name.trim()), 'success')
      setForm(EMPTY_CREATE)
      onClose()
      onCreated()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : t('classes.error.load'), loading: false }))
    }
  }

  return (
    <ClassModalOverlay onClose={handleClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('classes.create_modal.title')}</div>
      <div className={sLabelCls} style={sLabel}>{t('classes.create_modal.name_label')}</div>
      <input className={sInputCls} style={sInput} placeholder={t('classes.create_modal.name_placeholder')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div className={sLabelCls} style={sLabel}>{t('classes.create_modal.level_label')}</div>
          <input className={sInputCls} style={sInput} placeholder={t('classes.create_modal.level_placeholder')} value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} />
        </div>
        <div>
          <div className={sLabelCls} style={sLabel}>{t('classes.create_modal.filiere_label')}</div>
          <select className={sInputCls} style={sInput} value={form.filiere} onChange={e => setForm(f => ({ ...f, filiere: e.target.value }))}>
            <option value="">{college ? t('classes.create_modal.filiere_select') : t('classes.create_modal.filiere_select_empty')}</option>
            {(college ? getCollegeFiliereOptions(college, schoolInfo, t) : filiereOptions).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {!college && (
          <div>
            <div className={sLabelCls} style={sLabel}>{t('classes.create_modal.serie_label')}</div>
            <select
              className={sInputCls}
              style={sInput}
              value={form.serie}
              onChange={e => {
                const serie = e.target.value
                setForm(f => ({ ...f, serie, filiere: f.filiere || serieToFiliere(serie) }))
              }}
            >
              <option value="">{t('classes.create_modal.serie_select_empty')}</option>
              {secondCycleSeries.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <div className={sLabelCls} style={sLabel}>{t('classes.create_modal.capacity_label')}</div>
          <input className={sInputCls} style={sInput} type="number" min="1" max="200" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
        </div>
      </div>
      {form.error && <div style={sError}>{form.error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={handleClose}>{t('classes.create_modal.btn_cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={submitCreate} disabled={form.loading}>
          {form.loading ? t('classes.create_modal.creating') : t('classes.create_modal.btn_create')}
        </button>
      </div>
    </ClassModalOverlay>
  )
}

interface EditModalProps {
  target: ClassItem | null
  schoolInfo: SchoolInfo | null
  onClose: () => void
  onUpdated: () => void
  onToast: ToastFn
}

export function EditClassModal({ target, schoolInfo, onClose, onUpdated, onToast }: EditModalProps) {
  const t = useT('admin')
  const [form, setForm] = useState({ name: '', level: '', filiere: '', serie: '', capacity: '', loading: false, error: '' })

  useEffect(() => {
    if (!target) return
    const college = isCollegLevel(target.level ?? '', target.name)
    let filiere = target.filiere ?? ''
    let serie = target.serie ?? ''
    if (!college) {
      if (!filiere && !serie) {
        const inferred = inferFromName(target.name)
        filiere = inferred.filiere
        serie = inferred.serie
      } else if (!filiere && serie) {
        filiere = serieToFiliere(serie)
      }
    }
    setForm({
      name: target.name,
      level: target.level ?? '',
      filiere,
      serie,
      capacity: String(target.capacity),
      loading: false,
      error: '',
    })
  }, [target])

  if (!target) return null

  const secondCycleSeries = SECOND_CYCLE_SERIES_VALUES.map((v, i) => ({
    value: v, label: t(`classes.second_cycle_series.${i}.label`),
  }))
  const filiereOptions = FILIERE_VALUES.map((v, i) => ({
    value: v, label: t(`classes.filiere_options.${i}.label`),
  }))
  const college = isCollegLevel(form.level, form.name)

  const submitMod = async () => {
    if (!form.name.trim()) {
      setForm(f => ({ ...f, error: t('classes.edit_modal.error_required') }))
      return
    }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/classes/${target.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          level: form.level || undefined,
          filiere: form.filiere || undefined,
          serie: form.serie || undefined,
          capacity: parseInt(form.capacity) || 40,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.toast.modified'), 'success')
      onClose()
      onUpdated()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : t('classes.error.load'), loading: false }))
    }
  }

  return (
    <ClassModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('classes.edit_modal.title')}</div>
      <div className={sLabelCls} style={sLabel}>{t('classes.edit_modal.name_label')}</div>
      <input className={sInputCls} style={sInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div className={sLabelCls} style={sLabel}>{t('classes.edit_modal.level_label')}</div>
          <input className={sInputCls} style={sInput} placeholder={t('classes.edit_modal.level_placeholder')} value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} />
        </div>
        <div>
          <div className={sLabelCls} style={sLabel}>{t('classes.edit_modal.filiere_label')}</div>
          <select className={sInputCls} style={sInput} value={form.filiere} onChange={e => setForm(f => ({ ...f, filiere: e.target.value }))}>
            <option value="">{college ? t('classes.create_modal.filiere_select') : t('classes.create_modal.filiere_select_empty')}</option>
            {(college ? getCollegeFiliereOptions(college, schoolInfo, t) : filiereOptions).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {!college && (
          <div>
            <div className={sLabelCls} style={sLabel}>{t('classes.edit_modal.serie_label')}</div>
            <select
              className={sInputCls}
              style={sInput}
              value={form.serie}
              onChange={e => {
                const serie = e.target.value
                setForm(f => ({ ...f, serie, filiere: f.filiere || serieToFiliere(serie) }))
              }}
            >
              <option value="">{t('classes.create_modal.serie_select_empty')}</option>
              {secondCycleSeries.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <div className={sLabelCls} style={sLabel}>{t('classes.edit_modal.capacity_label')}</div>
          <input className={sInputCls} style={sInput} type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
        </div>
      </div>
      {form.error && <div style={sError}>{form.error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={onClose}>{t('classes.edit_modal.btn_cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={submitMod} disabled={form.loading}>
          {form.loading ? t('classes.edit_modal.saving') : t('classes.edit_modal.btn_save')}
        </button>
      </div>
    </ClassModalOverlay>
  )
}

interface DeleteModalProps {
  target: ClassTarget | null
  onClose: () => void
  onDeleted: (classId: string) => void
  onToast: ToastFn
}

export function DeleteClassModal({ target, onClose, onDeleted, onToast }: DeleteModalProps) {
  const t = useT('admin')
  const [deleting, setDeleting] = useState(false)

  if (!target) return null

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetchApi(`/api/v2/classes/${target.id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.toast.deleted').replace('{name}', target.name), 'success')
      onDeleted(target.id)
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ClassModalOverlay onClose={() => !deleting && onClose()}>
      <div className={sModalTitleCls} style={{ ...sModalTitle, color: 'var(--red)' }}>{t('classes.delete_modal.title')}</div>
      <div
        className="text-[13.5px] md:text-[15px] mb-[18px] md:mb-[24px]"
        style={{ color: 'var(--text2)', lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: t('classes.delete_modal.confirm').replace('{name}', target.name) }}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={onClose} disabled={deleting}>{t('classes.delete_modal.btn_cancel')}</button>
        <button
          style={{ ...btnPrim, flex: 1, background: 'linear-gradient(135deg,var(--red),var(--red))', opacity: deleting ? 0.7 : 1 }}
          onClick={confirmDelete}
          disabled={deleting}
        >
          {deleting ? t('classes.delete_modal.deleting') : t('classes.delete_modal.btn_confirm')}
        </button>
      </div>
    </ClassModalOverlay>
  )
}
