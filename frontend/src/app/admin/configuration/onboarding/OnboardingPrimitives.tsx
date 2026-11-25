'use client'

import type React from 'react'
import { useT } from '@/lib/i18n'
import { ONBOARDING_STYLES as S } from './onboardingData'

export function OnboardingBubble({ children }: { children: React.ReactNode }) {
  return <div style={S.bubble}>{children}</div>
}

interface NavProps {
  nextLabel?: string
  canNext?: boolean
  canBack: boolean
  onBack: () => void
  onNext: () => void
}

export function OnboardingNav({ nextLabel, canNext = true, canBack, onBack, onNext }: NavProps) {
  const t = useT('onboarding')
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 10 }}>
      <button style={S.secondary} onClick={onBack} disabled={!canBack}>
        {t('phase2.nav.back')}
      </button>
      <button style={{ ...S.primary, opacity: canNext ? 1 : 0.5 }} onClick={onNext} disabled={!canNext}>
        {nextLabel ?? t('phase2.nav.continue')}
      </button>
    </div>
  )
}
