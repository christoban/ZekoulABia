'use client'

import { useT } from '@/lib/i18n'
import { AppTopbar } from '@/components/shell/AppTopbar'
import type { StaffSection, SessionUser } from '../_types'

const SECTION_KEY: Record<string, string> = {
  'grille-horaire': 'grilleHoraire',
  'suivi-eleves': 'suiviEleves',
  'eleves-affectations': 'elevesAffectations',
  'import-eleves': 'importEleves',
  'moderation-messagerie': 'moderationMessagerie',
  'carnet-liaison': 'carnetLiaison',
  'mon-profil-rh': 'monProfilRh',
  'sync-offline': 'syncOffline',
  configuration: 'configuration',
  'eleves-familles': 'elevesFamilles',
}

interface Props {
  section: StaffSection
  periodLabel?: string
  onChangePassword?: () => void
  onNav?: (section: string) => void
  onMenuClick?: () => void
  sessionUser?: SessionUser | null
  onLogout?: () => void
}

export default function StaffTopbar({
  section,
  periodLabel,
  onChangePassword,
  onNav,
  onMenuClick,
  sessionUser,
  onLogout,
}: Props) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const title = tnav(`pageTitle.staff_${SECTION_KEY[section] ?? section}`)

  return (
    <AppTopbar
      title={title}
      periodLabel={periodLabel}
      onNavigate={onNav}
      onChangePassword={onChangePassword}
      onMenuClick={onMenuClick}
      user={sessionUser}
      fallbackInitials="ST"
      roleLabel={tcommon('user.roleLabel')}
      avatarGradient="linear-gradient(135deg,var(--primary),var(--blue,#2563eb))"
      syncNamespace="staff"
      onLogout={onLogout}
    />
  )
}
