'use client'

import React from 'react'
import { X, Shield, KeyRound, UserPlus, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { MasterUserDto } from '../_types'

interface Props {
  open: boolean
  user: MasterUserDto | null
  mfaEnabled: boolean
  onClose: () => void
  onChangePwd: () => void
  onInviteSchool: () => void
  onLogout: () => void
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function MasterMobileMenuDrawer({
  open,
  user,
  mfaEnabled,
  onClose,
  onChangePwd,
  onInviteSchool,
  onLogout,
}: Props) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 160,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Drawer content */}
      <div
        style={{
          position: 'relative',
          background: 'var(--surface, #ffffff)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: '20px 18px calc(24px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.16)',
          borderTop: '1px solid var(--border)',
          zIndex: 1,
          animation: 'slideUpDrawer 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 36,
            height: 4,
            background: 'var(--border, #e5e7eb)',
            borderRadius: 4,
            margin: '0 auto 16px',
          }}
        />

        {/* Header Profil */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              {user ? initials(user.name) : '?'}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                {user?.name ?? 'Super Admin'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                {user?.role ?? 'MASTER'} · {user?.email ?? ''}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* MFA Status Card */}
        <div
          style={{
            background: mfaEnabled ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${mfaEnabled ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
            borderRadius: 12,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {mfaEnabled ? (
              <ShieldCheck size={18} color="#16a34a" />
            ) : (
              <ShieldAlert size={18} color="#dc2626" />
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: mfaEnabled ? '#16a34a' : '#dc2626' }}>
              {mfaEnabled ? 'Authentification 2FA active' : 'Authentification 2FA désactivée'}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
            TOTP
          </span>
        </div>

        {/* Actions Menu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => {
              onClose()
              onInviteSchool()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--primary-light, #fef3c7)',
              color: 'var(--primary, #b45309)',
              border: '1px solid rgba(180, 83, 9, 0.15)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <UserPlus size={18} />
            <span>Inviter un nouvel établissement</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose()
              onChangePwd()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--surface-sunken, #f8fafc)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <KeyRound size={18} color="var(--text2)" />
            <span>Modifier mon mot de passe Master</span>
          </button>
        </div>

        {/* Bouton de Déconnexion */}
        <button
          type="button"
          onClick={() => {
            onClose()
            onLogout()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '12px 14px',
            borderRadius: 10,
            background: '#fee2e2',
            color: '#dc2626',
            border: '1px solid rgba(220, 38, 38, 0.2)',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
          }}
        >
          <LogOut size={16} />
          <span>Se déconnecter</span>
        </button>
      </div>
    </div>
  )
}
