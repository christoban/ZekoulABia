'use client'

import { useState, useEffect } from 'react'
import { Shield } from 'lucide-react'
import { useT } from '@/lib/i18n'

const PUBLIC_PLATFORM_SETTINGS_ENDPOINT = '/api/v2/platform-settings/public'

function readCurrentSchoolId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { schoolId?: string }
    return typeof parsed?.schoolId === 'string' && parsed.schoolId.trim().length > 0
      ? parsed.schoolId.trim()
      : null
  } catch {
    return null
  }
}

export default function ModeTestBanner() {
  const t = useT('common')
  const [outboundMessagingEnabled, setOutboundMessagingEnabled] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const schoolId = readCurrentSchoolId()
        const url = schoolId
          ? `${PUBLIC_PLATFORM_SETTINGS_ENDPOINT}?schoolId=${encodeURIComponent(schoolId)}`
          : PUBLIC_PLATFORM_SETTINGS_ENDPOINT
        const res = await fetch(url)
        if (!res.ok) return
        const data = (await res.json()) as { outboundMessagingEnabled?: boolean }
        if (!cancelled && typeof data.outboundMessagingEnabled === 'boolean') {
          setOutboundMessagingEnabled(data.outboundMessagingEnabled)
        }
      } catch {
        // Erreur réseau : pas de bandeau
      }
    }

    void load()

    const onModeTestChanged = (e: Event) => {
      const enabled = (e as CustomEvent<{ outboundMessagingEnabled?: boolean }>).detail?.outboundMessagingEnabled
      if (typeof enabled === 'boolean') {
        setOutboundMessagingEnabled(enabled)
      } else {
        void load()
      }
    }

    window.addEventListener('zekoulabia:mode-test-changed', onModeTestChanged)
    return () => {
      cancelled = true
      window.removeEventListener('zekoulabia:mode-test-changed', onModeTestChanged)
    }
  }, [])

  if (outboundMessagingEnabled) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        flexShrink: 0,
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 16px',
        background: 'var(--red-light)',
        borderBottom: '1px solid rgba(220, 38, 38, 0.25)',
        color: 'var(--red)',
        fontSize: 12.5,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Shield size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span>{t('login.mode_test_bandeau_msg')}</span>
    </div>
  )
}
