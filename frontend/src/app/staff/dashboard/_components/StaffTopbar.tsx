'use client'
import { KeyRound } from 'lucide-react'
import type { StaffSection } from '../_types'
import { useT } from '@/lib/i18n'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/NotificationBell'
import MobileMenuButton from '@/components/MobileMenuButton'

import OfflineSyncButtonPopover from '@/components/OfflineSyncButtonPopover'

const SECTION_KEY: Record<string, string> = {
  'grille-horaire': 'grilleHoraire',
  'suivi-eleves': 'suiviEleves',
  'eleves-affectations': 'elevesAffectations',
  'import-eleves': 'importEleves',
  'moderation-messagerie': 'moderationMessagerie',
  'mon-profil-rh': 'monProfilRh',
  'sync-offline': 'syncOffline',
  'bulletin-validation': 'bulletinValidation',
  'configuration': 'configuration',
}

interface Props {
  section: StaffSection
  periodLabel?: string
  onChangePassword?: () => void
  onNav?: (section: string) => void
  onMenuClick?: () => void
}

export default function StaffTopbar({ section, periodLabel, onChangePassword, onNav, onMenuClick }: Props) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  return (
    <header style={{
      height: 48, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, flexShrink: 0,
    }}>
      {onMenuClick && <MobileMenuButton onClick={onMenuClick} />}
      <div className="truncate" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
        {tnav(`pageTitle.staff_${SECTION_KEY[section] ?? section}`)}
      </div>
      {periodLabel && (
        <span className="hidden sm:inline" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 10px', fontSize: 12.5, fontWeight: 700, color: 'var(--text3)' }}>
          {periodLabel}
        </span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <OfflineSyncButtonPopover namespace="staff" />
        {onChangePassword && (
          <button onClick={onChangePassword} title={tcommon('auth.changePassword')}
            style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <KeyRound size={16} color="var(--text2)" />
          </button>
        )}
        <ThemeToggle />
        <NotificationBell onNav={onNav} />
      </div>
    </header>
  )
}
