'use client'
import { Settings } from 'lucide-react'
import { useT } from '@/lib/i18n'
import PushNotificationToggle from '@/components/PushNotificationToggle'

export default function SectionParentSettings() {
  const t = useT('parent')
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <PushNotificationToggle />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center', maxWidth: 420 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Settings size={36} strokeWidth={2} /></div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            {t('settings.title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 500, lineHeight: 1.6 }}>
            {t('settings.development')}<br />{t('settings.comeBack')}
          </div>
        </div>
      </div>
    </div>
  )
}
