'use client'
import { LogOut } from 'lucide-react'
import type { Section, MasterUserDto } from '../_types'

interface Props {
  user: MasterUserDto | null
  currentSection: Section
  mfaEnabled: boolean
  onNav: (s: Section) => void
  onLogout: () => void
}

const NAV: { id: Section; label: string; dotColor: string }[] = [
  { id: 'overview', label: "Vue d'ensemble", dotColor: '#4ade80' },
  { id: 'schools',  label: 'Écoles',          dotColor: '#d97706' },
  { id: 'logs',     label: 'Logs & Sécurité', dotColor: '#94a3b8' },
]

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function MasterTopbar({ user, currentSection, mfaEnabled, onNav, onLogout }: Props) {
  return (
    <header style={{
      height: 40, background: '#1a2e1e', display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 8, flexShrink: 0, position: 'relative', zIndex: 50
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 16px,#22c55e 16px,#22c55e 32px,#ef4444 32px,#ef4444 48px,#60a5fa 48px,#60a5fa 64px)'
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg,#f59e0b,#22c55e)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "65%", height: "65%", objectFit: "contain" }} /></div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 15, fontWeight: 700, color: 'white' }}>
          ZekoulABia
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)',
        fontSize: 10, fontWeight: 700, padding: '1px 6px',
        borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)'
      }}>HUB DE CONTRÔLE</div>

      <nav style={{ display: 'flex', gap: 4, margin: '0 10px' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)}
            style={{
              padding: '3px 8px', borderRadius: 6,
              background: currentSection === n.id ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: currentSection === n.id ? 'white' : 'rgba(255,255,255,0.5)',
              fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              transition: 'all 0.12s'
            }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: n.dotColor }} />
            {n.label}
          </button>
        ))}
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {mfaEnabled !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: mfaEnabled ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: mfaEnabled ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700,
            color: mfaEnabled ? '#4ade80' : '#f87171'
          }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: mfaEnabled ? '#4ade80' : '#f87171' }} />
            {mfaEnabled ? 'MFA actif' : 'MFA inactif'}
          </div>
        )}

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{user?.name ?? '...'}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{user?.role ?? '...'}</div>
        </div>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 11
        }}>{user ? initials(user.name) : '?'}</div>

        <button id="edu-logout-btn" onClick={onLogout} style={{
          padding: '5px 10px', borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
          color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
          display: 'flex', alignItems: 'center', gap: 4,
        }}><LogOut size={12} /> Déconnexion</button>
      </div>
    </header>
  )
}
