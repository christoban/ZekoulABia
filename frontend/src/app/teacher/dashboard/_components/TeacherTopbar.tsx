'use client'
import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useT } from '@/lib/i18n'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/NotificationBell'
import MobileMenuButton from '@/components/MobileMenuButton'

interface UserInfo { firstName: string; lastName: string }

interface Props {
  title: string
  user?: UserInfo | null
  onMenuClick?: () => void
}

export default function TeacherTopbar({ title, user, onMenuClick }: Props) {
  const tcommon = useT('common')
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '??'
  const [todayLabel, setTodayLabel] = useState('')

  useEffect(() => {
    const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    setTodayLabel(d.charAt(0).toUpperCase() + d.slice(1))
  }, [])

  return (
    <header style={{
      height: 40, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 16px',
      gap: 8, flexShrink: 0
    }}>
      {onMenuClick && <MobileMenuButton onClick={onMenuClick} />}
      <div className="truncate" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
        {title}
      </div>
      {todayLabel && (
        <span className="hidden lg:inline" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '3px 8px', fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>
          📅 {todayLabel}
        </span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="hidden sm:block" style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input type="text" placeholder={tcommon('actions.search')}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px 6px 30px', fontSize: 12, fontWeight: 600, color: 'var(--text)', outline: 'none', width: 200, fontFamily: 'inherit' }} />
        </div>
        <ThemeToggle />
        <NotificationBell />
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,var(--blue),var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--surface)', fontWeight: 800, fontSize: 12 }}>
          {initials}
        </div>
      </div>
    </header>
  )
}
