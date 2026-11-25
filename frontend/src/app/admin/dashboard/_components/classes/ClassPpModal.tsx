'use client'
import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { extractAssignedTeachers, type Teacher } from '@/features/classes/classesShared'
import {
  ClassModalOverlay,
  btnPrim,
  btnSec2,
  sError,
  sInput,
  sInputCls,
  sLabel,
  sLabelCls,
  sModalTitle,
  sModalTitleCls,
  type ClassTarget,
  type ToastFn,
} from './classesUi'

interface Props {
  target: ClassTarget | null
  onClose: () => void
  onAssigned: () => void
  onToast: ToastFn
}

export default function ClassPpModal({ target, onClose, onAssigned, onToast }: Props) {
  const t = useT('admin')
  const [teacherSearch, setTeacherSearch] = useState('')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selected, setSelected] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!target) return
    let active = true
    setTeacherSearch('')
    setTeachers([])
    setSelected(null)
    setLoading(true)
    setError('')
    fetchApi(`/api/v2/teaching-assignments?classId=${encodeURIComponent(target.id)}`, { credentials: 'include' })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || t('classes.error.load'))
        if (active) {
          setTeachers(extractAssignedTeachers(data.data || []))
          setLoading(false)
        }
      })
      .catch(err => {
        if (active) {
          setLoading(false)
          setError(err instanceof Error ? err.message : t('classes.error.load'))
        }
      })
    return () => { active = false }
  }, [target, t])

  if (!target) return null

  const filteredTeachers = teacherSearch
    ? teachers.filter(item => item.name.toLowerCase().includes(teacherSearch.toLowerCase()))
    : teachers

  const submitPP = async () => {
    if (!selected) {
      setError(t('classes.pp_modal.error_required'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi(`/api/v2/classes/${target.id}/professor-principal`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherUserId: selected.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.toast.pp_assigned').replace('{name}', selected.name), 'success')
      onClose()
      onAssigned()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('classes.error.load'))
      setLoading(false)
    }
  }

  return (
    <ClassModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('classes.pp_modal.title')}</div>
      <div style={{ fontSize: 15, color: 'var(--text3)', marginBottom: 18 }}>
        {t('classes.pp_modal.class_name').replace('{name}', target.name)}
      </div>
      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>{t('classes.pp_modal.loading')}</div>
      ) : teachers.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>{error || t('classes.pp_modal.no_assignment')}</div>
      ) : (
        <>
          <div className={sLabelCls} style={sLabel}>{t('classes.pp_modal.search_label')}</div>
          <input
            className={sInputCls}
            style={sInput}
            placeholder={t('classes.pp_modal.search_placeholder')}
            value={teacherSearch}
            onChange={e => { setTeacherSearch(e.target.value); setSelected(null) }}
          />
          {selected && (
            <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> {selected.name}
            </div>
          )}
          {!selected && (
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {filteredTeachers.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>{t('classes.pp_modal.no_teacher')}</div>
              ) : filteredTeachers.map(teacher => (
                <div
                  key={teacher.id}
                  onClick={() => { setSelected(teacher); setTeacherSearch(teacher.name) }}
                  style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--bg2)', color: 'var(--text)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                >
                  {teacher.name}
                </div>
              ))}
            </div>
          )}
          {error && <div style={sError}>{error}</div>}
        </>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={onClose}>{t('classes.pp_modal.btn_cancel')}</button>
        {teachers.length > 0 && (
          <button style={{ ...btnPrim, flex: 1, opacity: loading ? 0.7 : 1 }} onClick={submitPP} disabled={loading}>
            {loading ? t('classes.pp_modal.assigning') : t('classes.pp_modal.btn_assign')}
          </button>
        )}
      </div>
    </ClassModalOverlay>
  )
}
