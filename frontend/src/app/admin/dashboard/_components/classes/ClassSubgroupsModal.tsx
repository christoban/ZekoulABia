'use client'
import { useState } from 'react'
import { Link2, ArrowLeft } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import {
  ClassModalOverlay,
  btnPrim,
  btnSec2,
  btnSecSm,
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

interface SubGroup {
  id: string
  name: string
}

interface StudentItem {
  id: string
  firstName: string
  lastName: string
  studentProfile?: { id: string } | null
}

interface Props {
  target: ClassTarget
  onClose: () => void
  onToast: ToastFn
}

const EMPTY_ASSIGN = {
  open: false,
  subGroupId: '',
  subGroupName: '',
  students: [] as StudentItem[],
  selected: new Set<string>(),
  loading: false,
  submitting: false,
  error: '',
}

export default function ClassSubgroupsModal({ target, onClose, onToast }: Props) {
  const t = useT('admin')
  const [subgroups, setSubgroups] = useState<SubGroup[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [sgError, setSgError] = useState('')
  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN)

  const createSubgroup = async () => {
    if (!newName.trim()) {
      setSgError('Nom du sous-groupe obligatoire')
      return
    }
    setCreating(true)
    setSgError('')
    try {
      const res = await fetchApi(`/api/v2/classes/${target.id}/subgroups`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      const newSg: SubGroup = { id: data.data.sousGroupeId, name: newName.trim() }
      setSubgroups(prev => [...prev, newSg])
      setNewName('')
      setCreating(false)
      onToast(t('classes.toast.subgroup_created').replace('{name}', newSg.name), 'success')
    } catch (err) {
      setSgError(err instanceof Error ? err.message : t('classes.error.load'))
      setCreating(false)
    }
  }

  const openAssign = async (sg: SubGroup) => {
    setAssignForm({
      open: true, subGroupId: sg.id, subGroupName: sg.name,
      students: [], selected: new Set(), loading: true, submitting: false, error: '',
    })
    try {
      const res = await fetchApi(`/api/v2/users?role=STUDENT&classId=${target.id}&limit=200`, { credentials: 'include' })
      const data = await res.json()
      setAssignForm(f => ({ ...f, students: data.data ?? [], loading: false }))
    } catch {
      setAssignForm(f => ({ ...f, loading: false, error: t('classes.subgroups.assign_modal.loading_error') }))
    }
  }

  const toggleStudent = (id: string) => {
    setAssignForm(f => {
      const next = new Set(f.selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...f, selected: next }
    })
  }

  const submitAssign = async () => {
    if (assignForm.selected.size === 0) {
      setAssignForm(f => ({ ...f, error: t('classes.subgroups.assign_modal.selected_error') }))
      return
    }
    setAssignForm(f => ({ ...f, submitting: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/classes/subgroups/${assignForm.subGroupId}/students`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentProfileIds: Array.from(assignForm.selected) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.subgroups.assign_modal.toast_success').replace('{name}', assignForm.subGroupName), 'success')
      setAssignForm(EMPTY_ASSIGN)
    } catch (err) {
      setAssignForm(f => ({ ...f, error: err instanceof Error ? err.message : t('classes.error.load'), submitting: false }))
    }
  }

  if (assignForm.open) {
    return (
      <ClassModalOverlay onClose={() => setAssignForm(EMPTY_ASSIGN)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <button
            onClick={() => setAssignForm(EMPTY_ASSIGN)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, lineHeight: 1, display: 'flex' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div className={sModalTitleCls} style={sModalTitle}>{t('classes.subgroups.btn_assign')}</div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 18 }}>
          Sous-groupe : <strong style={{ color: 'var(--text2)' }}>{assignForm.subGroupName}</strong>
        </div>

        {assignForm.loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        ) : assignForm.students.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 14, textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
            {t('classes.lv2.no_students')}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              {t('classes.lv2.bulk_selected').replace('{count}', String(assignForm.selected.size))}
            </div>
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, maxHeight: 260, overflowY: 'auto', marginBottom: 14 }}>
              {assignForm.students.map((s, i) => {
                const profileId = s.studentProfile?.id ?? s.id
                return (
                  <label
                    key={s.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: i < assignForm.students.length - 1 ? '1px solid var(--bg2)' : 'none', fontSize: 14, color: 'var(--text)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                  >
                    <input
                      type="checkbox"
                      checked={assignForm.selected.has(profileId)}
                      onChange={() => toggleStudent(profileId)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--green)' }}
                    />
                    {s.firstName} {s.lastName}
                  </label>
                )
              })}
            </div>
          </>
        )}

        {assignForm.error && <div style={{ ...sError, marginBottom: 12 }}>{assignForm.error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...btnSec2, flex: 1 }} onClick={() => setAssignForm(EMPTY_ASSIGN)}>{t('classes.create_modal.btn_cancel')}</button>
          <button
            style={{ ...btnPrim, flex: 1, opacity: (assignForm.submitting || assignForm.selected.size === 0) ? 0.6 : 1 }}
            onClick={submitAssign}
            disabled={assignForm.submitting || assignForm.selected.size === 0 || assignForm.loading}
          >
            {assignForm.submitting ? t('classes.edit_modal.saving') : t('classes.edit_modal.btn_save')}
          </button>
        </div>
      </ClassModalOverlay>
    )
  }

  return (
    <ClassModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={sModalTitle}>{t('classes.subgroups.title').replace('{name}', target.name)}</div>

      {subgroups.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 18, fontStyle: 'italic' }}>
          {t('classes.subgroups.empty')}
        </div>
      ) : (
        <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
          {subgroups.map((sg, i) => (
            <div key={sg.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < subgroups.length - 1 ? '1px solid var(--bg2)' : 'none', fontSize: 14, color: 'var(--text)' }}>
              <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Link2 size={14} /> {sg.name}</span>
              <button onClick={() => openAssign(sg)} style={btnSecSm}>{t('classes.subgroups.btn_assign')}</button>
            </div>
          ))}
        </div>
      )}

      <div className={sLabelCls} style={sLabel}>{t('classes.subgroups.new_name_label')}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <input
          className={sInputCls}
          style={{ ...sInput, marginBottom: 0, flex: 1 }}
          placeholder={t('classes.subgroups.new_name_placeholder')}
          value={newName}
          onChange={e => { setNewName(e.target.value); setSgError('') }}
          onKeyDown={e => e.key === 'Enter' && createSubgroup()}
        />
        <button
          style={{ ...btnPrim, whiteSpace: 'nowrap', opacity: creating ? 0.7 : 1 }}
          onClick={createSubgroup}
          disabled={creating}
        >
          {creating ? '…' : t('classes.subgroups.btn_create')}
        </button>
      </div>
      {sgError && <div style={{ ...sError, marginBottom: 12 }}>{sgError}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button style={btnSec2} onClick={onClose}>{t('classes.subgroups.btn_close')}</button>
      </div>
    </ClassModalOverlay>
  )
}
