'use client'

import { useState, useEffect } from 'react'
import { FlaskConical } from 'lucide-react'
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

interface Props {
  onManageClick?: () => void
}

export default function ModeTestBanner({ onManageClick }: Props = {}) {
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
      className="px-3.5 py-2 md:px-6 md:py-2"
      style={{
        flexShrink: 0,
        width: '100%',
        boxSizing: 'border-box',
        background: 'var(--amber-light)',
        borderBottom: '1px solid rgba(217, 119, 6, 0.35)',
        color: 'var(--amber)',
        fontSize: 12,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        <FlaskConical size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span className="md:hidden truncate">{t('login.mode_test_bandeau_msg_short')}</span>
        <span className="hidden md:inline">{t('login.mode_test_bandeau_msg')}</span>
      </div>
      {onManageClick && (
        <button
          type="button"
          onClick={onManageClick}
          style={{
            background: 'rgba(217, 119, 6, 0.14)',
            border: '1px solid rgba(217, 119, 6, 0.35)',
            borderRadius: 6,
            padding: '4px 10px',
            color: 'var(--amber)',
            fontSize: 11.5,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {t('login.mode_test_bandeau_cta')}
        </button>
      )}
    </div>
  )
}
