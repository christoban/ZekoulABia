'use client'

import { useT } from '@/lib/i18n'
import { AppTopbar } from '@/components/shell/AppTopbar'

interface SessionUser {
  nomComplet?: string
  firstName?: string
  role?: string
  avatarUrl?: string | null
}

interface Props {
  title: string
  onNavigate?: (section: string) => void
  onChangePassword?: () => void
  onMenuClick?: () => void
  sessionUser?: SessionUser | null
  onLogout?: () => void
}

export default function AdminTopbar({ title, onNavigate, onChangePassword, onMenuClick, sessionUser, onLogout }: Props) {
  const tcommon = useT('common')
  return (
    <AppTopbar
      title={title}
      onNavigate={onNavigate}
      onChangePassword={onChangePassword}
      onMenuClick={onMenuClick}
      user={sessionUser}
      fallbackInitials="AD"
      roleLabel={tcommon('user.roleLabel')}
      avatarGradient="linear-gradient(135deg,var(--amber),var(--red))"
      syncNamespace="admin"
      onLogout={onLogout}
    />
  )
}
