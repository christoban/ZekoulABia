'use client'

import type React from 'react'
import { useMemo } from 'react'
import { Check, HelpCircle, XCircle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { OnboardingBubble, OnboardingNav } from './OnboardingPrimitives'
import {
  generateClassList,
  generateClassName,
  LV2_LANG_KEYS,
  ONBOARDING_STYLES as S,
  type LV2OrgRule,
  type OnboardingState,
  type PebsAnalysisData,
} from './onboardingData'

interface Props {
  stepKey: string
  state: OnboardingState
  concernedLevels: string[]
  lv2Levels: string[]
  patch: (p: Partial<OnboardingState>) => void
  toggleIn: (key: keyof OnboardingState, value: string) => void
  setPerClass: (level: string, className: string, patchRule: Partial<LV2OrgRule>) => void
  pebsDescription: string
  setPebsDescription: React.Dispatch<React.SetStateAction<string>>
  pebsAnalysis: PebsAnalysisData | null
  setPebsAnalysis: React.Dispatch<React.SetStateAction<PebsAnalysisData | null>>
  pebsLoading: boolean
  setPebsLoading: React.Dispatch<React.SetStateAction<boolean>>
  pebsError: string
  setPebsError: React.Dispatch<React.SetStateAction<string>>
  pebsConversation: { role: 'user' | 'assistant'; content: string }[]
  setPebsConversation: React.Dispatch<React.SetStateAction<{ role: 'user' | 'assistant'; content: string }[]>>
  canBack: boolean
  goBack: () => void
  goNext: () => void
}

export function OnboardingLanguageSteps({
  stepKey,
  state,
  concernedLevels,
  lv2Levels,
  patch,
  toggleIn,
  setPerClass,
  pebsDescription,
  setPebsDescription,
  pebsAnalysis,
  setPebsAnalysis,
  pebsLoading,
  setPebsLoading,
  pebsError,
  setPebsError,
  pebsConversation,
  setPebsConversation,
  canBack,
  goBack,
  goNext,
}: Props) {
  const t = useT('onboarding')
  const lv2LangOptions = useMemo(() => LV2_LANG_KEYS.map((l) => ({ value: l.value, label: t(l.key) })), [t])
  const navProps = { canBack, onBack: goBack, onNext: goNext }

  switch (stepKey) {
    case 'lv2Active':
      return (
        <>
          <OnboardingBubble>{t('phase2.lv2.activeTitle')}</OnboardingBubble>
          <button style={S.opt(state.lv2Active === true)} onClick={() => patch({ lv2Active: true })}>
            <span style={{ flex: 1 }}>{t('phase2.lv2.yes')}</span>
          </button>
          <button style={S.opt(state.lv2Active === false)} onClick={() => patch({ lv2Active: false })}>
            <span style={{ flex: 1 }}>{t('phase2.lv2.no')}</span>
          </button>
          <OnboardingNav {...navProps} canNext={state.lv2Active !== undefined} />
        </>
      )

    case 'lv2Languages':
      return (
        <>
          <OnboardingBubble>{t('phase2.lv2.languagesTitle')}</OnboardingBubble>
          {lv2LangOptions.map((l) => (
            <button key={l.value} style={S.opt(state.lv2Languages.includes(l.value))} onClick={() => toggleIn('lv2Languages', l.value)}>
              <span style={{ flex: 1 }}>{l.label}</span>
              {state.lv2Languages.includes(l.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
            </button>
          ))}
          <OnboardingNav {...navProps} canNext={state.lv2Languages.length > 0} />
        </>
      )

    case 'lv2PerLevel': {
      const lv2ClassNames = lv2Levels.flatMap((level) => {
        const count = state.classesPerLevel?.[level] ?? 2
        const convention = state.conventionNommage ?? 'LETTRES'
        return Array.from({ length: count }, (_, i) => generateClassName(level, i, convention))
      })
      const lv2Complete = lv2ClassNames.length > 0 && lv2ClassNames.every((cn) => {
        const r = state.lv2Organisation.find((o) => o.className === cn)
        if (!r) return false
        return r.organisation === 'MIXTE' ? (r.langues?.length ?? 0) > 0 : !!r.langue
      })
      return (
        <>
          <OnboardingBubble>{t('phase2.lv2.perClassTitle')}</OnboardingBubble>
          {lv2Levels.map((level) => {
            const count = state.classesPerLevel?.[level] ?? 2
            const convention = state.conventionNommage ?? 'LETTRES'
            return (
              <div key={level} style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 14px', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 10 }}>{level}</div>
                {Array.from({ length: count }, (_, i) => {
                  const cn = generateClassName(level, i, convention)
                  const rule = state.lv2Organisation.find((o) => o.className === cn)
                  const isMixte = rule?.organisation === 'MIXTE'
                  return (
                    <div key={cn} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', minWidth: 54 }}>{cn}</div>
                        {!isMixte && (
                          <select
                            style={{ ...S.input, marginBottom: 0, flex: 1, minWidth: 140 }}
                            value={rule?.langue ?? ''}
                            onChange={(e) => setPerClass(level, cn, { organisation: 'UNIFORME', langue: e.target.value, langues: undefined })}
                          >
                            <option value="">{t('phase2.lv2.chooseLang')}</option>
                            {state.lv2Languages.map((l) => <option key={l} value={l}>{t(`phase2.lv2.${l.toLowerCase()}`) ?? l}</option>)}
                          </select>
                        )}
                        <button
                          style={{ ...S.opt(isMixte), width: 'auto', marginBottom: 0, padding: '7px 12px', fontSize: 13 }}
                          onClick={() => isMixte
                            ? setPerClass(level, cn, { organisation: 'UNIFORME', langues: undefined })
                            : setPerClass(level, cn, { organisation: 'MIXTE', langue: undefined, langues: [] })}
                        >
                          {isMixte ? t('phase2.lv2.singleLangBack') : t('phase2.lv2.mixteClass')}
                        </button>
                      </div>
                      {isMixte && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>{t('phase2.lv2.mixedLanguages')}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {state.lv2Languages.map((l) => {
                              const active = rule?.langues?.includes(l) ?? false
                              return (
                                <button
                                  key={l}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    border: `1.5px solid ${active ? 'var(--green)' : 'var(--border)'}`,
                                    background: active ? 'var(--green-light)' : 'var(--surface)',
                                    color: active ? 'var(--green2)' : 'var(--text2)',
                                  }}
                                  onClick={() => {
                                    const next = active
                                      ? (rule?.langues ?? []).filter((x) => x !== l)
                                      : [...(rule?.langues ?? []), l]
                                    setPerClass(level, cn, { langues: next })
                                  }}
                                >
                                  {active && <Check size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                                  {t(`phase2.lv2.${l.toLowerCase()}`) ?? l}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
          <OnboardingNav {...navProps} canNext={lv2Complete} />
        </>
      )
    }

    case 'pebsOrg': {
      const hasPEBS = state.hasPEBSFrancophone || state.hasPEBSAnglophone
      const classList = generateClassList(concernedLevels, state.classesPerLevel, state.conventionNommage ?? 'LETTRES')
      const analyzePEBS = async () => {
        if (!pebsDescription.trim()) return
        setPebsLoading(true)
        setPebsError('')
        try {
          const updatedHistory = pebsConversation.length === 0
            ? [{ role: 'user' as const, content: pebsDescription }]
            : [...pebsConversation, { role: 'user' as const, content: pebsDescription }]
          setPebsConversation(updatedHistory)

          const res = await fetchApi('/api/v2/onboarding/analyze-pebs', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: pebsDescription,
              conversationHistory: updatedHistory,
              context: {
                subSystem: state.subSystem,
                cycles: state.cycles,
                levels: concernedLevels,
                classesPerLevel: state.classesPerLevel,
                conventionNommage: state.conventionNommage ?? 'LETTRES',
                hasPEBSFrancophone: state.hasPEBSFrancophone,
                hasPEBSAnglophone: state.hasPEBSAnglophone,
              },
            }),
          })
          const data = await res.json()
          if (!data.success) throw new Error(data.message || "Erreur d'analyse")
          if (data.data.clarificationNeeded && data.data.clarifications?.length) {
            const assistantMsg = `Question de clarification : ${data.data.clarifications.join(' ')}`
            setPebsConversation((prev) => [...prev, { role: 'assistant', content: assistantMsg }])
          }
          setPebsAnalysis(data.data)
        } catch (e: unknown) {
          setPebsError(e instanceof Error ? e.message : 'Erreur réseau')
        } finally {
          setPebsLoading(false)
        }
      }
      return (
        <>
          <OnboardingBubble>{t(hasPEBS && state.subSystem === 'FRANCOPHONE' ? 'phase2.pebs.bubbleFR' : 'phase2.pebs.bubbleEN')}</OnboardingBubble>
          {!pebsAnalysis && (
            <>
              <textarea
                style={{ ...S.input, minHeight: 120, resize: 'vertical' }}
                value={pebsDescription}
                onChange={(e) => setPebsDescription(e.target.value)}
                placeholder={t('phase2.pebs.placeholder')}
              />
              {pebsError && (
                <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 9, padding: '9px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={14} style={{ flexShrink: 0 }} /> {pebsError}
                </div>
              )}
              <button
                style={{ ...S.primary, width: '100%', justifyContent: 'center', opacity: pebsLoading || !pebsDescription.trim() ? 0.6 : 1 }}
                onClick={analyzePEBS}
                disabled={pebsLoading || !pebsDescription.trim()}
              >
                {pebsLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                    {t('phase2.pebs.analyzing')}
                  </span>
                ) : t('phase2.pebs.analyze')}
              </button>
            </>
          )}
          {pebsAnalysis && (
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
              {pebsAnalysis.clarificationNeeded ? (
                <>
                  <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HelpCircle size={15} /> {t('phase2.pebs.clarificationNeeded')}
                  </div>
                  {pebsAnalysis.clarifications.map((q, i) => (
                    <div key={i} style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 4, paddingLeft: 8 }}>• {q}</div>
                  ))}
                  <textarea
                    style={{ ...S.input, minHeight: 80, resize: 'vertical', marginTop: 8 }}
                    value={pebsDescription}
                    onChange={(e) => setPebsDescription(e.target.value)}
                    placeholder={t('phase2.pebs.clarifyPlaceholder')}
                  />
                  <button style={{ ...S.primary, width: '100%', marginTop: 4 }} onClick={() => { setPebsAnalysis(null); analyzePEBS() }}>
                    {t('phase2.pebs.reanalyze')}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('phase2.pebs.reformulation')}</div>
                  <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12, background: 'var(--surface)', borderRadius: 8, padding: '10px 12px' }}>
                    {pebsAnalysis.reformulation}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
                    {t('phase2.pebs.classesCount')} {classList.length}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...S.secondary, flex: 1 }} onClick={() => { setPebsAnalysis(null); setPebsDescription(''); setPebsConversation([]) }}>
                      {t('phase2.pebs.reject')}
                    </button>
                    <button style={{ ...S.primary, flex: 1 }} onClick={() => { patch({ pebsOrganisation: pebsAnalysis.pebsOrganisation }); goNext() }}>
                      {t('phase2.pebs.approve')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {!pebsAnalysis && <OnboardingNav {...navProps} canNext={false} />}
        </>
      )
    }

    default:
      return null
  }
}
