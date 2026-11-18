'use client'

import { useEffect, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { Loader2 } from 'lucide-react'
import type { ClassItem, UserItem } from './types'
import { sErr, sIn, sInCls, sLb, sLbCls } from './UserSharedPrimitives'

interface EditModalProps {
  user: UserItem
  onClose: () => void
  onSuccess: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function UserEditModal({ user, onClose, onSuccess, onToast }: EditModalProps) {
  const t = useT('admin')
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [email, setEmail] = useState(user.email ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(user.studentProfile?.dateOfBirth ? user.studentProfile.dateOfBirth.slice(0, 10) : '')
  const [gender, setGender] = useState(user.studentProfile?.gender ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitModUser = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('users.edit_modal.required_error'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
      }
      if (user.role === 'STUDENT') {
        if (dateOfBirth) body.dateOfBirth = dateOfBirth
        if (gender) body.gender = gender
      }
      const res = await fetchApi(`/api/v2/users/${user.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('users.edit_modal.toast_success'), 'success')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-5 py-5 md:px-7 md:py-6" style={{ background: 'var(--surface)', borderRadius: 16, width: 440, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="text-[16px] md:text-[18px] mb-[12px] md:mb-[16px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('users.edit_modal.title')}</div>
        <div className="gap-[10px] md:gap-[12px]" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div className={sLbCls} style={sLb}>{t('users.edit_modal.first_name_label')}</div>
            <input className={sInCls} style={sIn} value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div>
            <div className={sLbCls} style={sLb}>{t('users.edit_modal.last_name_label')}</div>
            <input className={sInCls} style={sIn} value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        <div className={sLbCls} style={sLb}>{t('users.edit_modal.email_label')}</div>
        <input className={sInCls} style={sIn} type="email" value={email} onChange={e => setEmail(e.target.value)} />
        {user.role === 'STUDENT' && (
          <div className="gap-[10px] md:gap-[12px] mt-[8px] md:mt-[10px]" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <div className={sLbCls} style={sLb}>{t('users.create_modal.dob_label')}</div>
              <input className={sInCls} style={sIn} type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
            </div>
            <div>
              <div className={sLbCls} style={sLb}>{t('users.create_modal.gender_label')}</div>
              <select className={sInCls} style={sIn} value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">—</option>
                <option value="M">{t('users.i18n_ext.form.male')}</option>
                <option value="F">{t('users.i18n_ext.form.female')}</option>
              </select>
            </div>
          </div>
        )}
        {error && <div style={sErr}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button style={{ flex: 1, padding: '7.5px 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={onClose}>
            {t('users.i18n_ext.actions.cancel')}
          </button>
          <button style={{ flex: 1, padding: '7.5px 12px', borderRadius: 9, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={submitModUser} disabled={loading}>
            {loading ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : t('users.edit_modal.btn_save')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface TransferModalProps {
  user: UserItem
  onClose: () => void
  onSuccess: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function UserTransferModal({ user, onClose, onSuccess, onToast }: TransferModalProps) {
  const t = useT('admin')
  const userName = `${user.firstName} ${user.lastName}`
  const [classId, setClassId] = useState('')
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(async res => {
        const data = await res.json()
        if (active && res.ok) setClasses(data.data || [])
      })
      .catch(() => { /* silencieux */ })
    return () => { active = false }
  }, [])

  const submitTransfer = async () => {
    if (!classId) {
      setError(t('users.transfer_modal.select_error'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi(`/api/v2/users/students/${user.id}/transfer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newClassId: classId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('users.transfer_modal.toast_success').replace('{name}', userName), 'success')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="p-4 md:p-5" style={{ background: 'var(--surface)', borderRadius: 14, width: 400, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="text-[15px] font-bold font-spectral" style={{ color: 'var(--text)', marginBottom: 3 }}>{t('users.transfer_modal.title')}</div>
        <div className="text-[11.5px] font-medium" style={{ color: 'var(--text2)', marginBottom: 14 }}>{t('users.transfer_modal.subtitle').replace('{name}', userName)}</div>
        <div className={sLbCls} style={sLb}>{t('users.transfer_modal.select_label')}</div>
        <select className={sInCls} style={sIn} value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">{t('users.i18n_ext.form.selectClass')}</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {error && <div style={sErr}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={onClose}>
            {t('users.i18n_ext.actions.cancel')}
          </button>
          <button style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={submitTransfer} disabled={loading}>
            {loading ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : t('users.transfer_modal.btn_transfer')}
          </button>
        </div>
      </div>
    </div>
  )
}
