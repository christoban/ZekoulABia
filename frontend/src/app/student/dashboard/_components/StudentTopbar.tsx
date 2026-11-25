'use client'

import { useT } from '@/lib/i18n'
import { AppTopbar } from '@/components/shell/AppTopbar'

interface UserInfo {
  firstName: string
  lastName: string
  role?: string
  avatarUrl?: string | null
}

interface Props {
  title: string
  onNavigate?: (section: string) => void
  onChangePassword?: () => void
  onMenuClick?: () => void
  user?: UserInfo | null
  onLogout?: () => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function StudentTopbar({ title, onNavigate, onChangePassword, onMenuClick, user, onLogout, onToast }: Props) {
  const tcommon = useT('common')
  return (
    <AppTopbar
      title={title}
      onNavigate={onNavigate}
      onChangePassword={onChangePassword}
      onMenuClick={onMenuClick}
      user={user}
      fallbackInitials="EL"
      roleLabel={tcommon('user.studentFallback')}
      avatarGradient="linear-gradient(135deg,var(--purple),var(--blue))"
      syncNamespace="common"
      onLogout={onLogout}
      onToast={onToast}
    />
  )
}
