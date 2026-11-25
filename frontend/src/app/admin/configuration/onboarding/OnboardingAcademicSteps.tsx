'use client'

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { OnboardingBubble, OnboardingNav } from './OnboardingPrimitives'
import {
  ANGLO_STREAM_KEYS,
  CYCLE_KEYS,
  ONBOARDING_STYLES as S,
  PRIMARY_OPTIONS_EN,
  PRIMARY_OPTIONS_FR,
  SERIES_KEYS,
  SUBSYSTEM_KEYS,
  TECH_KEYS,
  TEMPLATE_LABELS,
  type AngloCombo,
  type AngloStreamsData,
  type OnboardingState,
} from './onboardingData'

interface Props {
  stepKey: string
  state: OnboardingState
  reconciled: boolean
  detectedTemplate: string
  angloCombos: AngloStreamsData | null
  angloState: 'idle' | 'loading' | 'ready' | 'error'
  loadAngloCombos: () => void
  patch: (p: Partial<OnboardingState>) => void
  toggleIn: (key: keyof OnboardingState, value: string) => void
  canBack: boolean
  goBack: () => void
  goNext: () => void
}

export function OnboardingAcademicSteps({
  stepKey,
  state,
  reconciled,
  detectedTemplate,
  angloCombos,
  angloState,
  loadAngloCombos,
  patch,
  toggleIn,
  canBack,
  goBack,
  goNext,
}: Props) {
  const t = useT('onboarding')

  const cycleOptions = useMemo(() => CYCLE_KEYS.map((c) => ({ value: c.value, icon: c.icon, label: t(c.key) })), [t])
  const subsystemOptions = useMemo(() => SUBSYSTEM_KEYS.map((s) => ({ value: s.value, label: t(s.key) })), [t])
  const seriesOptions = useMemo(() => SERIES_KEYS.map((s) => ({ value: s.value, label: t(s.key) })), [t])
  const angloStreamOptions = useMemo(() => ANGLO_STREAM_KEYS.map((a) => ({ value: a.value, label: t(a.key) })), [t])
  const techOptions = useMemo(() => TECH_KEYS.map((tc) => ({ value: tc.value, label: t(tc.key) })), [t])

  const navProps = { canBack, onBack: goBack, onNext: goNext }

  switch (stepKey) {
    case 'intro':
      return (
        <>
          <OnboardingBubble>
            <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: t('phase2.intro.bubble', { schoolName: state.schoolName ?? '' }) }} />
          </OnboardingBubble>
          {reconciled && <OnboardingBubble>{t('phase2.intro.reconciled')}</OnboardingBubble>}
          <button style={{ ...S.primary, width: '100%' }} onClick={goNext}>
            {t('phase2.intro.start')}
          </button>
        </>
      )

    case 'cycles':
      return (
        <>
          <OnboardingBubble>{t('phase2.cycles.title')}</OnboardingBubble>
          {cycleOptions.map((o) => (
            <button key={o.value} style={S.opt(state.cycles.includes(o.value))} onClick={() => toggleIn('cycles', o.value)}>
              <span style={{ display: 'flex', alignItems: 'center' }}><o.icon size={20} /></span>
              <span style={{ flex: 1 }}>{o.label}</span>
              {state.cycles.includes(o.value) && <Check size={16} color="var(--green)" strokeWidth={3} />}
            </button>
          ))}
          <OnboardingNav {...navProps} canNext={state.cycles.length > 0} />
        </>
      )

    case 'subsystem':
      return (
        <>
          <OnboardingBubble>{t('phase2.subsystem.title')}</OnboardingBubble>
          {subsystemOptions.map((o) => (
            <button key={o.value} style={S.opt(state.subSystem === o.value)} onClick={() => patch({ subSystem: o.value as OnboardingState['subSystem'] })}>
              <span style={{ flex: 1 }}>{o.label}</span>
              {state.subSystem === o.value && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
            </button>
          ))}
          <OnboardingNav {...navProps} canNext={!!state.subSystem} />
        </>
      )

    case 'templateConfirm':
      return (
        <>
          <OnboardingBubble>
            <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: t('phase2.template.bubble', { template: TEMPLATE_LABELS[detectedTemplate] ?? detectedTemplate }) }} />
          </OnboardingBubble>
          <button style={S.opt(state.template === detectedTemplate)} onClick={() => { patch({ template: detectedTemplate }); goNext() }}>
            <span style={{ flex: 1 }}>{t('phase2.template.yes')}</span>
          </button>
          <button style={S.opt(false)} onClick={() => { patch({ template: detectedTemplate }); goNext() }}>
            <span style={{ flex: 1 }}>{t('phase2.template.later')}</span>
          </button>
          <OnboardingNav {...navProps} onNext={() => { patch({ template: detectedTemplate }); goNext() }} />
        </>
      )

    case 'series':
      return (
        <>
          <OnboardingBubble>{t('phase2.series.title')}</OnboardingBubble>
          {seriesOptions.map((o) => (
            <button key={o.value} style={S.opt(state.series.includes(o.value))} onClick={() => toggleIn('series', o.value)}>
              <span style={{ flex: 1 }}>{o.label}</span>
              {state.series.includes(o.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
            </button>
          ))}
          <div style={{ fontSize: 13, color: 'var(--amber)', background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 9, padding: '9px 12px', marginTop: 4 }}>
            {t('phase2.series.note')}
          </div>
          <OnboardingNav {...navProps} canNext={state.series.length > 0} />
        </>
      )

    case 'enStreams':
      return (
        <>
          <OnboardingBubble>
            {state.subSystem === 'BILINGUAL' ? t('phase2.enStreams.titleBilingual') : t('phase2.enStreams.title')}
          </OnboardingBubble>
          {angloStreamOptions.map((o) => (
            <button key={o.value} style={S.opt(state.anglophoneStreams.includes(o.value))} onClick={() => toggleIn('anglophoneStreams', o.value)}>
              <span style={{ flex: 1 }}>{o.label}</span>
              {state.anglophoneStreams.includes(o.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
            </button>
          ))}
          <OnboardingNav {...navProps} canNext={state.anglophoneStreams.length > 0} />
        </>
      )

    case 'enCombos': {
      const showArts = state.anglophoneStreams.includes('ARTS') || state.anglophoneStreams.includes('COMMERCIAL')
      const showSci = state.anglophoneStreams.includes('SCIENCES')
      const combos: AngloCombo[] = angloCombos
        ? [...(showArts ? angloCombos.arts : []), ...(showSci ? angloCombos.science : [])]
        : []
      return (
        <>
          <OnboardingBubble>{t('phase2.enCombos.title')}</OnboardingBubble>

          {angloState === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 4px', color: 'var(--text3)', fontSize: 14 }}>
              <div style={{ width: 20, height: 20, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', flexShrink: 0 }} />
              {t('phase2.enCombos.loading')}
              <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {angloState === 'error' && (
            <div style={{ background: 'var(--red-light)', border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 6 }}>
              <div style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('phase2.enCombos.error')}</div>
              <button style={{ ...S.secondary, padding: '8px 16px', fontSize: 14 }} onClick={loadAngloCombos}>{t('phase2.enCombos.retry')}</button>
            </div>
          )}

          {angloState === 'ready' && combos.map((c) => (
            <button key={c.code} style={S.opt(state.anglophoneCombinations.includes(c.code))} onClick={() => toggleIn('anglophoneCombinations', c.code)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{c.code} — {c.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 500 }}>{c.subjects.join(', ')}</div>
              </div>
              {state.anglophoneCombinations.includes(c.code) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
            </button>
          ))}

          <div style={{ fontSize: 13, color: 'var(--blue)', background: 'var(--blue-light)', border: '1px solid var(--blue-light)', borderRadius: 9, padding: '9px 12px', marginTop: 4 }}>
            {t('phase2.enCombos.info')}
          </div>
          <OnboardingNav {...navProps} />
        </>
      )
    }

    case 'technical':
      return (
        <>
          <OnboardingBubble>{t('phase2.technical.title')}</OnboardingBubble>
          {techOptions.map((o) => (
            <button key={o.value} style={S.opt(state.technicalFilieres.includes(o.value))} onClick={() => toggleIn('technicalFilieres', o.value)}>
              <span style={{ flex: 1 }}>{o.label}</span>
              {state.technicalFilieres.includes(o.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
            </button>
          ))}
          <OnboardingNav {...navProps} canNext={state.technicalFilieres.length > 0} />
        </>
      )

    case 'primaryLevels': {
      const opts = state.subSystem === 'ANGLOPHONE' ? PRIMARY_OPTIONS_EN : PRIMARY_OPTIONS_FR
      return (
        <>
          <OnboardingBubble>{t('phase2.primaryLevels.title')}</OnboardingBubble>
          {opts.map((o) => (
            <button key={o.value} style={S.opt(state.primaryLevels.includes(o.value))} onClick={() => toggleIn('primaryLevels', o.value)}>
              <span style={{ flex: 1 }}>{o.label}</span>
              {state.primaryLevels.includes(o.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
            </button>
          ))}
          <OnboardingNav {...navProps} canNext={state.primaryLevels.length > 0} />
        </>
      )
    }

    default:
      return null
  }
}
