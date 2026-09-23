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
  { id: 'overview',     label: "Vue d'ensemble",           dotColor: '#4ade80' },
  { id: 'schools',      label: 'Écoles',                   dotColor: '#d97706' },
  { id: 'referentiels', label: 'Référentiels Nationaux',   dotColor: '#60a5fa' },
  { id: 'logs',         label: 'Logs & Sécurité',          dotColor: '#94a3b8' },
]

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function MasterTopbar({ user, currentSection, mfaEnabled, onNav, onLogout }: Props) {
  return (
    <header style={{
      height: 54, background: 'var(--sidebar-bg)', display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 12, flexShrink: 0, position: 'relative', zIndex: 50
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 16px,#22c55e 16px,#22c55e 32px,#ef4444 32px,#ef4444 48px,#60a5fa 48px,#60a5fa 64px)'
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#22c55e)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'white' }}>
          ZekoulABia
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
        fontSize: 11, fontWeight: 700, padding: '2px 8px',
        borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)'
      }}>HUB DE CONTRÔLE</div>

      <nav style={{ display: 'flex', gap: 6, margin: '0 12px' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)}
            style={{
              padding: '6px 12px', borderRadius: 8,
              background: currentSection === n.id ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: currentSection === n.id ? 'white' : 'rgba(255,255,255,0.6)',
              fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              transition: 'all 0.12s'
            }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.dotColor }} />
            {n.label}
          </button>
        ))}
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {mfaEnabled !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: mfaEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            border: mfaEnabled ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700,
            color: mfaEnabled ? '#4ade80' : '#f87171'
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: mfaEnabled ? '#4ade80' : '#f87171' }} />
            {mfaEnabled ? 'MFA actif' : 'MFA inactif'}
          </div>
        )}

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{user?.name ?? '...'}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{user?.role ?? '...'}</div>
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 12
        }}>{user ? initials(user.name) : '?'}</div>

        <button id="edu-logout-btn" onClick={onLogout} style={{
          padding: '6px 12px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
          color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
          display: 'flex', alignItems: 'center', gap: 6,
        }}><LogOut size={14} /> Déconnexion</button>
      </div>
    </header>
  )
}
