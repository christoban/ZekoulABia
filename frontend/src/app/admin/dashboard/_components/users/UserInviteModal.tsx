'use client'

import { useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { X } from 'lucide-react'
import {
  EMPTY_INVITE_FORM,
  iconForTitle,
  mergePermissions,
  type InviteForm,
  type StaffPermission,
  type StaffTitle,
} from './types'
import { Field, inputSt, inputStCls, PasswordOnceNotice } from './UserSharedPrimitives'

interface UserInviteModalProps {
  onClose: () => void
  onSuccess: (msg: string) => void
  staffTitles: StaffTitle[]
}

export default function UserInviteModal({ onClose, onSuccess, staffTitles }: UserInviteModalProps) {
  const t = useT('admin')
  const [form, setForm] = useState<InviteForm>(EMPTY_INVITE_FORM)

  const set = (field: keyof InviteForm, val: unknown) =>
    setForm(prev => ({ ...prev, [field]: val }))

  const toggleTitle = (key: string) => {
    const next = form.selectedTitles.includes(key)
      ? form.selectedTitles.filter(k => k !== key)
      : [...form.selectedTitles, key]
    if (key === '__custom__') {
      setForm(prev => ({ ...prev, selectedTitles: next, showCustomPerms: !prev.showCustomPerms }))
    } else {
      setForm(prev => ({ ...prev, selectedTitles: next }))
    }
  }

  const toggleCustomPerm = (perm: StaffPermission) => {
    const next = form.customPerms.includes(perm)
      ? form.customPerms.filter(p => p !== perm)
      : [...form.customPerms, perm]
    set('customPerms', next)
  }

  const mergedPerms = mergePermissions(form.selectedTitles, form.customPerms, staffTitles)
  const isStaff = form.role === 'STAFF'

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      set('error', t('users.invite_modal.errors.required'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      set('error', t('users.invite_modal.errors.invalid_email'))
      return
    }
    if (isStaff && form.selectedTitles.length === 0 && form.customPerms.length === 0) {
      set('error', t('users.invite_modal.errors.select_position'))
      return
    }

    set('loading', true)
    set('error', '')
    try {
      const res = await fetchApi('/api/v2/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          role: form.role,
          password: 'ZekoulABia2025!',
          ...(isStaff && {
            staffTitle: form.selectedTitles[0] ?? 'Personnalisé',
            staffPermissions: mergedPerms,
          }),
        }),
      })
      const data = await res.json() as { success?: boolean; message?: string; data?: { motDePasseTemporaire?: string } }
      if (!res.ok || !data.success) throw new Error(data.message ?? t('users.invite_modal.errors.unknown'))
      const motDePasseTemporaire = data.data?.motDePasseTemporaire
      if (motDePasseTemporaire) {
        set('tempPassword', motDePasseTemporaire)
        return
      }
      onSuccess(t('users.invite_modal.success').replace('{name}', `${form.firstName} ${form.lastName}`))
      onClose()
    } catch (err: unknown) {
      set('error', err instanceof Error ? err.message : t('users.invite_modal.errors.send_error'))
    } finally {
      set('loading', false)
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)' }}
      />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, width: '96%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto', borderRadius: 16 }}>
        <div className="px-5 py-5 md:px-7 md:py-6" style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', animation: 'popIn 0.22s ease' }}>
          <div className="mb-[12px] md:mb-[18px]" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="text-[16px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
                {t('users.invite_modal.title')}
              </div>
              <div className="text-[12px] md:text-[12.5px]" style={{ color: 'var(--text3)', marginTop: 2 }}>
                {t('users.invite_modal.subtitle')}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'var(--bg2)', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16, padding: '5px 9px', borderRadius: 8, lineHeight: 1, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>

          <div className="mb-[14px] md:mb-[18px]" style={{ height: 1, background: 'var(--border)' }} />

          {form.tempPassword && (
            <PasswordOnceNotice
              password={form.tempPassword}
              onClose={() => onSuccess(t('users.invite_modal.success').replace('{name}', `${form.firstName} ${form.lastName}`))}
            />
          )}

          {!form.tempPassword && (
            <div className="gap-[10px] md:gap-[14px]" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="gap-[10px] md:gap-[12px]" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <Field label={t('users.invite_modal.first_name_label')}>
                  <input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder={t('users.invite_modal.first_name_placeholder')} className={inputStCls} style={inputSt} />
                </Field>
                <Field label={t('users.invite_modal.last_name_label')}>
                  <input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder={t('users.invite_modal.last_name_placeholder')} className={inputStCls} style={inputSt} />
                </Field>
              </div>

              <Field label={t('users.invite_modal.email_label')}>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder={t('users.invite_modal.email_placeholder')} className={inputStCls} style={inputSt} />
              </Field>

              <Field label={t('users.invite_modal.role_label')}>
                <select value={form.role} onChange={e => set('role', e.target.value)} className={inputStCls} style={{ ...inputSt, cursor: 'pointer', appearance: 'auto' }}>
                  <option value="TEACHER">{t('users.invite_modal.role_teacher')}</option>
                  <option value="STAFF">{t('users.invite_modal.role_staff')}</option>
                  <option value="STUDENT">{t('users.invite_modal.role_student')}</option>
                  <option value="PARENT">{t('users.invite_modal.role_parent')}</option>
                </select>
              </Field>

              {isStaff && (
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>
                    {t('users.invite_modal.staff_positions')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {staffTitles.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', padding: '6px 0' }}>{t('users.invite_modal.loading_titles')}</div>
                    )}
                    {staffTitles.map(title => {
                      const checked = form.selectedTitles.includes(title.key)
                      const TitleIcon = iconForTitle(title.key)
                      return (
                        <label
                          key={title.key}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px', borderRadius: 10, border: `1.5px solid ${checked ? 'var(--green)' : 'var(--border)'}`, background: checked ? 'var(--green-light)' : 'white', cursor: 'pointer', transition: 'all 0.12s' }}
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleTitle(title.key)} style={{ marginTop: 2, accentColor: 'var(--green)', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}><TitleIcon size={14} strokeWidth={2} /> {title.label}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 }}>
                              {(title.permissions as StaffPermission[]).slice(0, 4).map(p => t(`users.permissions.${p}`)).join(' · ')}
                              {title.permissions.length > 4 ? ` + ${title.permissions.length - 4}` : ''}
                            </div>
                          </div>
                        </label>
                      )
                    })}

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px', borderRadius: 10, border: `1.5px solid ${form.showCustomPerms ? 'var(--purple)' : 'var(--border)'}`, background: form.showCustomPerms ? 'var(--purple-light)' : 'white', cursor: 'pointer', transition: 'all 0.12s' }}>
                      <input type="checkbox" checked={form.showCustomPerms} onChange={() => setForm(prev => ({ ...prev, showCustomPerms: !prev.showCustomPerms }))} style={{ marginTop: 2, accentColor: 'var(--purple)', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{t('users.invite_modal.custom_title')}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('users.invite_modal.custom_subtitle')}</div>
                      </div>
                    </label>
                  </div>

                  {form.showCustomPerms && (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                        {t('users.invite_modal.custom_perms_header')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                        {(Object.keys(t('users.permissions') as unknown as Record<string, string>) as StaffPermission[]).map(perm => {
                          const isInherited = mergePermissions(form.selectedTitles, [], staffTitles).includes(perm)
                          const isChecked = mergedPerms.includes(perm)
                          return (
                            <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, background: isInherited ? 'var(--green-light)' : 'white', border: `1px solid ${isInherited ? 'rgba(142,42,58,0.2)' : 'var(--border)'}`, cursor: isInherited ? 'default' : 'pointer', opacity: 1 }}>
                              <input type="checkbox" checked={isChecked} disabled={isInherited} onChange={() => !isInherited && toggleCustomPerm(perm)} style={{ accentColor: 'var(--green)', width: 13, height: 13, flexShrink: 0 }} />
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: isInherited ? 'var(--green)' : 'var(--text2)', lineHeight: 1.2 }}>
                                {t(`users.permissions.${perm}`)}
                                {isInherited && <span style={{ fontSize: 10, color: 'var(--green)', marginLeft: 3 }}>{t('users.permission_inherited')}</span>}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {mergedPerms.length > 0 && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 8, border: '1px solid rgba(142,42,58,0.2)', fontSize: 11.5, color: 'var(--green)', fontWeight: 600 }}>
                      {t('users.invite_modal.merged_count').replace('{count}', String(mergedPerms.length))} :&nbsp;
                      {mergedPerms.slice(0, 5).map(p => t(`users.permissions.${p}`)).join(', ')}
                      {mergedPerms.length > 5 ? t('users.invite_modal.merged_plus').replace('{count}', String(mergedPerms.length - 5)) : ''}
                    </div>
                  )}
                </div>
              )}

              {form.error && (
                <div style={{ padding: '8px 12px', background: 'var(--red-light)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.2)', fontSize: 12.5, fontWeight: 700, color: 'var(--red)' }}>
                  {form.error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={form.loading}
                className="text-[13px] md:text-[14px] py-[10px] px-[18px]"
                style={{ width: '100%', background: form.loading ? 'var(--border)' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', fontWeight: 800, borderRadius: 9, border: 'none', cursor: form.loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {form.loading ? t('users.invite_modal.sending') : t('users.invite_modal.send')}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
