'use client'
import { Search } from 'lucide-react'
import { useT } from '@/lib/i18n'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/NotificationBell'
import MobileMenuButton from '@/components/MobileMenuButton'
import CalendarTopbarButton from '@/components/CalendarTopbarButton'

interface UserInfo { firstName: string; lastName: string }

interface Props {
  title: string
  user?: UserInfo | null
  onMenuClick?: () => void
}

export default function TeacherTopbar({ title, user, onMenuClick }: Props) {
  const tcommon = useT('common')
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '??'

  return (
    <header style={{
      height: 48, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 20px',
      gap: 10, flexShrink: 0
    }}>
      {onMenuClick && <MobileMenuButton onClick={onMenuClick} />}
      <div className="truncate" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
        {title}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <CalendarTopbarButton />
        <div className="hidden sm:block" style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input type="text" placeholder={tcommon('actions.search')}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 12px 7px 34px', fontSize: 13, fontWeight: 600, color: 'var(--text)', outline: 'none', width: 220, fontFamily: 'inherit' }} />
        </div>
        <ThemeToggle />
        <NotificationBell />
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,var(--blue),var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--surface)', fontWeight: 800, fontSize: 13 }}>
          {initials}
        </div>
      </div>
    </header>
  )
}
