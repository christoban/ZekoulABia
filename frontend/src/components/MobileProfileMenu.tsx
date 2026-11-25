'use client'

import { useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'

interface Props {
  name: string
  role?: string
  initials: string
  onLogout?: () => void
}

export default function MobileProfileMenu({ name, role, initials, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} className="relative md:hidden" style={{ flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(value => !value)} aria-label={name}
        style={{ width: 34, height: 34, borderRadius: 17, border: 'none', background: 'linear-gradient(135deg,var(--primary),var(--blue))', color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        {initials}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 42, right: 0, width: 220, background: 'var(--surface)', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.18),0 2px 6px rgba(0,0,0,0.08)', padding: 8, zIndex: 20 }}>
          <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{name}</div>
            {role && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{role}</div>}
          </div>
          {onLogout && (
            <button type="button" onClick={onLogout}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', border: 'none', background: 'transparent', borderRadius: 10, cursor: 'pointer', color: 'var(--red)' }}>
              <LogOut size={18} color="var(--red)" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Se déconnecter</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
