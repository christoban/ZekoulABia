'use client'

import type React from 'react'
import { useT } from '@/lib/i18n'
import type { MasterTeamRole } from '../../_api'

interface Props {
  name: string
  email: string
  role: MasterTeamRole
  roleDescription: string
  creating: boolean
  onNameChange: (val: string) => void
  onEmailChange: (val: string) => void
  onRoleChange: (val: MasterTeamRole) => void
  onCancel: () => void
  onSubmit: (e: React.FormEvent) => void
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
}

/** Formulaire de création d'un opérateur Master */
export default function TeamCreateMemberForm({
  name,
  email,
  role,
  roleDescription,
  creating,
  onNameChange,
  onEmailChange,
  onRoleChange,
  onCancel,
  onSubmit,
}: Props) {
  const t = useT('master')

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 'clamp(12px, 3.6vw, 18px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
        {t('team.form_title')}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
            {t('team.label_name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('team.placeholder_name')}
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
            {t('team.label_email')}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t('team.placeholder_email')}
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
            {t('team.label_role')}
          </label>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value as MasterTeamRole)}
            style={fieldStyle}
          >
            <option value="PLATFORM_ADMIN">{t('team.role_platform_option')}</option>
            <option value="SCHOOL_MANAGER">{t('team.role_school_option')}</option>
            <option value="SUPPORT">{t('team.role_support_option')}</option>
          </select>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text2)' }}>
        {roleDescription}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border2)',
            background: 'var(--surface)',
            color: 'var(--text2)',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('team.cancel')}
        </button>
        <button
          type="submit"
          disabled={creating}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
            color: '#fff',
            fontSize: 12.5,
            fontWeight: 800,
            cursor: creating ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {creating ? t('team.creating') : t('team.submit_create')}
        </button>
      </div>
    </form>
  )
}
