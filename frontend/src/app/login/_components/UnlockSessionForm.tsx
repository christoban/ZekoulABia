'use client'

import { Eye, EyeOff, Loader2, AlertTriangle, Lock } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { InactiveUserInfo } from '../_helpers/loginConfig'

interface Props {
  inactiveUser: InactiveUserInfo
  unlockPassword: string
  onChangePassword: (val: string) => void
  showUnlockPwd: boolean
  onToggleShowPwd: () => void
  unlockLoading: boolean
  unlockAlert: string | null
  onSubmit: (e?: React.FormEvent) => void
  onCancel: () => void
}

export default function UnlockSessionForm({
  inactiveUser,
  unlockPassword,
  onChangePassword,
  showUnlockPwd,
  onToggleShowPwd,
  unlockLoading,
  unlockAlert,
  onSubmit,
  onCancel,
}: Props) {
  const t = useT('common')

  return (
    <form onSubmit={onSubmit} style={{ animation: 'edu-fadeUp 0.25s ease both' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg,var(--primary),var(--accent))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            color: 'white',
            boxShadow: '0 4px 14px rgba(180,83,42,0.22)',
          }}
        >
          <Lock size={24} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
          {t('login.inactive_title')}
        </h2>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', marginBottom: 6 }}>
          {inactiveUser.nomComplet}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
          {t('login.inactive_subtitle')}
        </p>
      </div>

      {unlockAlert && (
        <div
          style={{
            borderRadius: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            marginBottom: 14,
            background: 'var(--red-light)',
            border: '1px solid rgba(217,72,31,0.2)',
            color: 'var(--red)',
            fontSize: 13,
          }}
        >
          <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>{unlockAlert}</span>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', display: 'block', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
          {t('fields.password')}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showUnlockPwd ? 'text' : 'password'}
            value={unlockPassword}
            onChange={(e) => onChangePassword(e.target.value)}
            placeholder="••••••••••••"
            autoFocus
            style={{
              width: '100%',
              minHeight: 48,
              padding: '12px 44px 12px 14px',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: 16,
              fontWeight: 600,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={onToggleShowPwd}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {showUnlockPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={unlockLoading}
        style={{
          width: '100%',
          minHeight: 48,
          background: 'var(--primary)',
          color: 'white',
          fontSize: 15,
          fontWeight: 800,
          border: 'none',
          borderRadius: 10,
          cursor: unlockLoading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: '0 4px 14px rgba(180,83,42,0.22)',
          marginBottom: 14,
          opacity: unlockLoading ? 0.8 : 1,
        }}
      >
        {unlockLoading ? <Loader2 size={18} className="animate-spin" /> : null}
        {t('login.inactive_unlock_btn')}
      </button>

      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text3)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: '4px 0',
          }}
        >
          {t('login.inactive_switch_account')}
        </button>
      </div>
    </form>
  )
}
