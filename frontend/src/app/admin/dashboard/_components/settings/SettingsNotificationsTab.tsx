'use client'

import type React from 'react'
import { Mail, Smartphone } from 'lucide-react'
import { useT } from '@/lib/i18n'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import { btnSec, btnSecCls, cardHeader, cardHeaderCls, cardTitle, type NotifSettings } from './types'

interface SettingsNotificationsTabProps {
  notifData: NotifSettings | null
  notifLoading: boolean
  notifSaving: keyof NotifSettings | null
  onToggle: (key: keyof NotifSettings) => void
  onRetry: () => void
}

export default function SettingsNotificationsTab({
  notifData,
  notifLoading,
  notifSaving,
  onToggle,
  onRetry,
}: SettingsNotificationsTabProps) {
  const t = useT('admin')

  const NOTIF_ROWS: Array<{ key: keyof NotifSettings; icon: React.ReactNode; label: string; sub: string }> = [
    { key: 'smsAbsences', icon: <Smartphone size={16} strokeWidth={2} />, label: t('settings.notifications.rows.0.label'), sub: t('settings.notifications.rows.0.sub') },
    { key: 'smsPayments', icon: <Smartphone size={16} strokeWidth={2} />, label: t('settings.notifications.rows.1.label'), sub: t('settings.notifications.rows.1.sub') },
    { key: 'smsBulletins', icon: <Smartphone size={16} strokeWidth={2} />, label: t('settings.notifications.rows.2.label'), sub: t('settings.notifications.rows.2.sub') },
    { key: 'emailDigestAdmin', icon: <Mail size={16} strokeWidth={2} />, label: t('settings.notifications.rows.3.label'), sub: t('settings.notifications.rows.3.sub') },
    { key: 'smsLowBalance', icon: <Smartphone size={16} strokeWidth={2} />, label: t('settings.notifications.rows.4.label'), sub: t('settings.notifications.rows.4.sub') },
  ]

  return (
    <div className="bg-transparent border-0 md:bg-[var(--surface)] md:border md:border-[var(--border)]" style={{ borderRadius: 12, overflow: 'hidden' }}>
      <div className={`${cardHeaderCls} hidden md:flex`} style={cardHeader}>
        <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.notifications.title')}</span>
      </div>

      {notifLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!notifLoading && !notifData && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)' }}>
          {t('settings.notifications.load_error')}
          <button className={btnSecCls} style={{ ...btnSec, marginLeft: 10 }} onClick={onRetry}>
            {t('settings.notifications.btn_retry')}
          </button>
        </div>
      )}

      {!notifLoading && notifData && (
        <div className="flex flex-col gap-[6px] md:gap-0">
          <div className="rounded-[10px] md:rounded-none shadow-[0_1px_2px_rgba(20,20,15,0.05)] md:shadow-none bg-[var(--surface)] md:border-b md:border-[var(--bg)]">
            <PushNotificationToggle style={{ border: 'none', borderRadius: 0, padding: '12px 18px' }} />
          </div>
          {NOTIF_ROWS.map((n, i) => {
            const on = notifData[n.key]
            const saving = notifSaving === n.key
            return (
              <div
                key={n.key}
                className={`rounded-[10px] md:rounded-none shadow-[0_1px_2px_rgba(20,20,15,0.05)] md:shadow-none bg-[var(--surface)] px-3.5 py-2.5 md:px-5 md:py-3 ${i < NOTIF_ROWS.length - 1 ? 'md:border-b md:border-[var(--bg)]' : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
              >
                <div>
                  <div className="text-[12.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>{n.icon} {n.label}</div>
                  <div className="text-[11px] md:text-[12.5px]" style={{ color: 'var(--text3)', marginTop: 2 }}>{n.sub}</div>
                </div>
                <div
                  onClick={() => !saving && onToggle(n.key)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: on ? 'var(--green)' : 'var(--border2)', cursor: saving ? 'wait' : 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, opacity: saving ? 0.6 : 1 }}
                >
                  <div style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
