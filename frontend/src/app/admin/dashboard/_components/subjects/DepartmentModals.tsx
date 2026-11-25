'use client'

import { useState } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import type { Department, TeacherWithSubjects } from './types'
import { btnPrim, btnSec2, ModalOverlay, sError, sInput, sInputCls, sLabel, sLabelCls, sModalTitle, sModalTitleCls } from './subjectsUi'

const DEPT_COLORS = [
  { name: 'Lettres', color: 'var(--blue)' },
  { name: 'Sciences Humaines', color: 'var(--amber)' },
  { name: 'Langues Vivantes', color: 'var(--green)' },
  { name: 'Maths & Sciences', color: 'var(--red)' },
  { name: 'Informatique', color: 'var(--purple)' },
  { name: 'Arts & Culture', color: 'var(--orange)' },
  { name: 'Gris', color: 'var(--text3)' },
  { name: 'Personnalisé', color: 'var(--text)' },
]

function DeptColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [custom, setCustom] = useState(value)
  const selected = DEPT_COLORS.find(c => c.color === value)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {DEPT_COLORS.map(c => (
          <div
            key={c.color}
            onClick={() => onChange(c.color)}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: c.color,
              cursor: 'pointer',
              border: value === c.color ? '3px solid var(--text)' : '3px solid transparent',
              transition: 'border 0.15s',
            }}
            title={c.name}
          />
        ))}
      </div>
      {!selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={custom}
            onChange={e => { setCustom(e.target.value); onChange(e.target.value) }}
            style={{ width: 40, height: 32, padding: 0, border: '1.5px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{custom}</span>
          <button onClick={() => onChange(custom)} style={{ ...btnSec2, padding: '4px 12px', fontSize: 13 }}>Appliquer</button>
        </div>
      )}
    </div>
  )
}

export function DeptCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT('admin')
  const [name, setName] = useState('')
  const [color, setColor] = useState('var(--text3)')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitCreateDept = async () => {
    if (!name.trim()) {
      setError(t('subjects.departments.create_modal.name_required'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi('/api/v2/departments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.departments.create_modal.title')}</div>
      <div className={sLabelCls} style={sLabel}>Nom *</div>
      <input className={sInputCls} style={sInput} placeholder="Ex: Lettres, Sciences…" value={name} onChange={e => setName(e.target.value)} />
      <div className={sLabelCls} style={sLabel}>Couleur</div>
      <DeptColorPicker value={color} onChange={setColor} />
      {error && <div style={sError}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={onClose}>{t('subjects.departments.create_modal.btn_cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: loading ? 0.7 : 1 }} onClick={submitCreateDept} disabled={loading}>
          {loading ? t('subjects.departments.create_modal.creating') : t('subjects.departments.create_modal.btn_create')}
        </button>
      </div>
    </ModalOverlay>
  )
}

export function DeptEditModal({
  dept,
  allTeachers,
  onClose,
  onUpdated,
  onToast,
}: {
  dept: Department
  allTeachers: TeacherWithSubjects[]
  onClose: () => void
  onUpdated: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
  const t = useT('admin')
  const deptSubjectIds = new Set(dept.subjects.map(s => s.id))
  const eligibleTeachers = dept.subjects.length === 0
    ? []
    : allTeachers.filter(teacher => teacher.teacherProfile?.teacherSubjects?.some(ts => deptSubjectIds.has(ts.subjectId)) ?? false)

  const [name, setName] = useState(dept.name)
  const [color, setColor] = useState(dept.color)
  const [headId, setHeadId] = useState(dept.head?.id ?? '')
  const [teacherSearch, setTeacherSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasSubjects = dept.subjects.length > 0
  const filteredTeachers = teacherSearch
    ? eligibleTeachers.filter(item => `${item.firstName} ${item.lastName}`.toLowerCase().includes(teacherSearch.toLowerCase()))
    : eligibleTeachers

  const submitEditDept = async () => {
    if (!name.trim()) {
      setError(t('subjects.departments.edit_modal.name_required'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi(`/api/v2/departments/${dept.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color, headId: headId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onUpdated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  const handleDeleteDept = async () => {
    if (!(await confirmAction(t('subjects.departments.edit_modal.delete_confirm').replace('{name}', dept.name)))) return
    try {
      const res = await fetchApi(`/api/v2/departments/${dept.id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onUpdated()
      onClose()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('subjects.departments.edit_modal.title')}</div>
      <div className={sLabelCls} style={sLabel}>Nom *</div>
      <input className={sInputCls} style={sInput} value={name} onChange={e => setName(e.target.value)} />
      <div className={sLabelCls} style={sLabel}>Couleur</div>
      <DeptColorPicker value={color} onChange={setColor} />
      <div className={sLabelCls} style={sLabel}>{t('subjects.departments.edit_modal.ap_label')}</div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input
          className={sInputCls}
          style={sInput}
          placeholder={t('subjects.departments.edit_modal.search_placeholder')}
          value={teacherSearch}
          onChange={e => { setTeacherSearch(e.target.value); setHeadId('') }}
          onFocus={() => { if (!headId) setTeacherSearch('') }}
        />
        {headId && (
          <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '8px 14px', borderRadius: 8, marginBottom: 8, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} strokeWidth={2} /> {eligibleTeachers.find(item => item.id === headId)?.firstName} {eligibleTeachers.find(item => item.id === headId)?.lastName}
            </span>
            <button onClick={() => { setHeadId(''); setTeacherSearch('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <X size={13} strokeWidth={2} /> Retirer
            </button>
          </div>
        )}
        {!headId && (
          <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, maxHeight: 180, overflowY: 'auto' }}>
            {filteredTeachers.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>{t('subjects.departments.edit_modal.no_teacher')}</div>
            ) : (
              filteredTeachers.map(item => (
                <div
                  key={item.id}
                  onClick={() => { setHeadId(item.id); setTeacherSearch(`${item.firstName} ${item.lastName}`) }}
                  style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--bg2)', color: 'var(--text)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                >
                  <div style={{ fontWeight: 600 }}>{item.firstName} {item.lastName}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {error && <div style={sError}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={{ ...btnSec2, flex: 1 }} onClick={onClose}>{t('subjects.departments.edit_modal.btn_cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: loading ? 0.7 : 1 }} onClick={submitEditDept} disabled={loading}>
          {loading ? t('subjects.coeff_modal.saving') : t('subjects.departments.edit_modal.btn_save')}
        </button>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 18, paddingTop: 16 }}>
        <button
          onClick={handleDeleteDept}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            cursor: hasSubjects ? 'not-allowed' : 'pointer',
            background: hasSubjects ? 'var(--bg2)' : 'var(--red-light)',
            color: hasSubjects ? 'var(--text3)' : 'var(--red)',
            border: `1.5px solid ${hasSubjects ? 'var(--border)' : 'var(--red-light)'}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          disabled={hasSubjects}
          title={hasSubjects ? t('subjects.departments.toast_move_error') : t('subjects.departments.edit_modal.btn_delete')}
        >
          <Trash2 size={14} strokeWidth={2} /> {t('subjects.departments.edit_modal.btn_delete')}
        </button>
        {hasSubjects && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{t('subjects.departments.toast_move_error')}</div>
        )}
      </div>
    </ModalOverlay>
  )
}
