'use client'
import { Settings } from 'lucide-react'
import { useT } from '@/lib/i18n'
import PushNotificationToggle from '@/components/PushNotificationToggle'

export default function SectionParentSettings() {
  const t = useT('parent')
  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 flex flex-col gap-4 h-full" style={{ overflowY: 'auto' }}>
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
