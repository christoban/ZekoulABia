'use client'

/**
 * Onboarding conversationnel — Phase 2
 * Questionnaire IA (chat + options) qui collecte l'OnboardingState, affiche un récapitulatif,
 * puis délègue l'exécution déterministe au backend (POST /api/v2/onboarding/execute).
 *
 * Groq n'est PAS appelé pour construire l'établissement : les coefficients MINESEC restent
 * déterministes côté serveur. Le questionnaire reste utilisable sur mobile (375px).
 */

import { useEffect, useMemo, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useChangeLanguage, useLanguage } from '@/lib/i18n'
import { OnboardingAcademicSteps } from './onboarding/OnboardingAcademicSteps'
import { OnboardingLanguageSteps } from './onboarding/OnboardingLanguageSteps'
import { OnboardingOperationsSteps } from './onboarding/OnboardingOperationsSteps'
import { OnboardingRecap } from './onboarding/OnboardingRecap'
import {
  createInitialOnboardingState,
  detectTemplate,
  mapPhase1ToState,
  ONBOARDING_STYLES as S,
  type AngloStreamsData,
  type GrilleHoraireOnboarding,
  type LV2OrgRule,
  type OnboardingProps,
  type OnboardingState,
  type PEBSOrgRule,
  type PebsAnalysisData,
} from './onboarding/onboardingData'

export type { LV2OrgRule, PEBSOrgRule, GrilleHoraireOnboarding, OnboardingState }

const ACADEMIC_STEPS = new Set([
  'intro',
  'cycles',
  'subsystem',
  'templateConfirm',
  'series',
  'enStreams',
  'enCombos',
  'technical',
  'primaryLevels',
])

const LANGUAGE_STEPS = new Set(['lv2Active', 'lv2Languages', 'lv2PerLevel', 'pebsOrg'])

export default function ConversationalOnboarding(props: OnboardingProps) {
  const changeLanguage = useChangeLanguage()
  const { lang } = useLanguage()
  const [state, setState] = useState<OnboardingState>(() => createInitialOnboardingState(props))
  const [idx, setIdx] = useState(0)
  const [angloCombos, setAngloCombos] = useState<AngloStreamsData | null>(null)
  const [angloState, setAngloState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [pebsDescription, setPebsDescription] = useState('')
  const [pebsAnalysis, setPebsAnalysis] = useState<PebsAnalysisData | null>(null)
  const [pebsLoading, setPebsLoading] = useState(false)
  const [pebsError, setPebsError] = useState('')
  const [pebsConversation, setPebsConversation] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])

  // Réconciliation : true si la Phase 1 (inscription) a déjà fourni la structure. On saute alors
  // les questions déjà répondues. Immuable (basé sur les props) → ne perturbe pas la navigation.
  const reconciled = useMemo(() => (mapPhase1ToState(props.phase1Config).cycles?.length ?? 0) > 0, [props.phase1Config])

  const loadAngloCombos = () => {
    setAngloState('loading')
    fetchApi('/api/v2/onboarding/anglophone-streams', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success || !d.data) throw new Error('bad response')
        setAngloCombos(d.data as AngloStreamsData)
        setAngloState('ready')
      })
      .catch(() => setAngloState('error'))
  }

  const patch = (p: Partial<OnboardingState>) => setState((s) => {
    if (p.subSystem && p.subSystem !== s.subSystem) {
      changeLanguage(p.subSystem === 'ANGLOPHONE' ? 'en' : 'fr')
    }
    return { ...s, ...p }
  })

  const toggleIn = (key: keyof OnboardingState, value: string) => {
    setState((s) => {
      const arr = (s[key] as string[]) ?? []
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      return { ...s, [key]: next }
    })
  }

  const steps = useMemo<string[]>(() => {
    const list = ['intro']
    if (!reconciled) {
      list.push('cycles')
      if (!state.subSystem) list.push('subsystem')
      list.push('templateConfirm')
    }
    if (state.cycles.includes('SECOND_CYCLE')) {
      const sys = state.subSystem
      if ((sys === 'FRANCOPHONE' || sys === 'BILINGUAL' || !sys) && !reconciled) list.push('series')
      if (sys === 'ANGLOPHONE' || sys === 'BILINGUAL') {
        list.push('enStreams')
        if (state.anglophoneStreams.length > 0) list.push('enCombos')
      }
    }
    if (state.cycles.includes('TECHNIQUE') && !reconciled) list.push('technical')
    if (state.cycles.includes('PRIMAIRE') && !reconciled) list.push('primaryLevels')
    const hasSecondary = state.cycles.includes('PREMIER_CYCLE') || state.cycles.includes('SECOND_CYCLE')
    if (state.cycles.includes('PREMIER_CYCLE')) {
      if (!reconciled) list.push('lv2Active')
      if (state.lv2Active) {
        if (!reconciled) list.push('lv2Languages')
        list.push('lv2PerLevel')
      }
    }
    if (hasSecondary && (state.hasPEBSFrancophone || state.hasPEBSAnglophone)) {
      list.push('pebsOrg')
    }
    list.push('calYear', 'grid', 'periods', 'sequences', 'fees', 'tranches', 'services', 'direction', 'admissions', 'recap')
    return list
  }, [reconciled, state.subSystem, state.cycles, state.lv2Active, state.anglophoneStreams, state.hasPEBSFrancophone, state.hasPEBSAnglophone])

  const stepKey = steps[Math.min(idx, steps.length - 1)]
  const goNext = () => setIdx((i) => Math.min(i + 1, steps.length - 1))
  const goBack = () => setIdx((i) => Math.max(i - 1, 0))
  const canBack = idx > 0

  useEffect(() => {
    if ((stepKey === 'enStreams' || stepKey === 'enCombos') && angloState === 'idle') {
      loadAngloCombos()
    }
  }, [stepKey, angloState])

  const concernedLevels = useMemo(() => {
    const lv: string[] = []
    if (state.cycles.includes('PREMIER_CYCLE')) lv.push('6e', '5e', '4e', '3e')
    if (state.cycles.includes('SECOND_CYCLE')) lv.push('2nde', '1ère', 'Tle')
    return lv
  }, [state.cycles])

  const lv2Levels = useMemo(
    () => (state.cycles.includes('PREMIER_CYCLE') ? ['4e', '3e'] : []),
    [state.cycles],
  )

  const setPerClass = (level: string, className: string, patchRule: Partial<LV2OrgRule>) => {
    setState((s) => {
      const others = s.lv2Organisation.filter((o) => !(o.level === level && o.className === className))
      const current = s.lv2Organisation.find((o) => o.level === level && o.className === className)
        ?? { level, className, organisation: 'UNIFORME' as const }
      return { ...s, lv2Organisation: [...others, { ...current, ...patchRule }] }
    })
  }

  const setGrid = (gridPatch: Partial<GrilleHoraireOnboarding>) => setState((s) => ({
    ...s,
    gridConfig: { ...s.gridConfig, ...gridPatch },
  }))

  const toggleGridDay = (jour: GrilleHoraireOnboarding['joursActifs'][number]) => setGrid({
    joursActifs: state.gridConfig.joursActifs.includes(jour)
      ? state.gridConfig.joursActifs.filter((value) => value !== jour)
      : [...state.gridConfig.joursActifs, jour],
  })

  const progress = Math.round((idx / (steps.length - 1)) * 100)
  const detectedTemplate = useMemo(() => detectTemplate(state), [state])

  const renderStep = () => {
    if (ACADEMIC_STEPS.has(stepKey)) {
      return (
        <OnboardingAcademicSteps
          stepKey={stepKey}
          state={state}
          reconciled={reconciled}
          detectedTemplate={detectedTemplate}
          angloCombos={angloCombos}
          angloState={angloState}
          loadAngloCombos={loadAngloCombos}
          patch={patch}
          toggleIn={toggleIn}
          canBack={canBack}
          goBack={goBack}
          goNext={goNext}
        />
      )
    }
    if (LANGUAGE_STEPS.has(stepKey)) {
      return (
        <OnboardingLanguageSteps
          stepKey={stepKey}
          state={state}
          concernedLevels={concernedLevels}
          lv2Levels={lv2Levels}
          patch={patch}
          toggleIn={toggleIn}
          setPerClass={setPerClass}
          pebsDescription={pebsDescription}
          setPebsDescription={setPebsDescription}
          pebsAnalysis={pebsAnalysis}
          setPebsAnalysis={setPebsAnalysis}
          pebsLoading={pebsLoading}
          setPebsLoading={setPebsLoading}
          pebsError={pebsError}
          setPebsError={setPebsError}
          pebsConversation={pebsConversation}
          setPebsConversation={setPebsConversation}
          canBack={canBack}
          goBack={goBack}
          goNext={goNext}
        />
      )
    }
    if (stepKey === 'recap') {
      return (
        <OnboardingRecap
          state={state}
          template={state.template ?? detectedTemplate}
          onConfirm={() => props.onComplete({ ...state, template: state.template ?? detectedTemplate })}
          onBack={goBack}
        />
      )
    }
    return (
      <OnboardingOperationsSteps
        stepKey={stepKey}
        state={state}
        patch={patch}
        toggleIn={toggleIn}
        setGrid={setGrid}
        toggleGridDay={toggleGridDay}
        canBack={canBack}
        goBack={goBack}
        goNext={goNext}
      />
    )
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 6 }}>
          {(['fr', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => changeLanguage(l)}
              style={{
                padding: '4px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: '1.5px solid',
                background: lang === l ? 'var(--green)' : 'var(--surface)',
                color: lang === l ? 'var(--surface)' : 'var(--text2)',
                borderColor: lang === l ? 'var(--green)' : 'var(--border2)',
              }}
            >
              {l === 'fr' ? 'FR' : 'EN'}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,var(--primary),var(--primary-hover))', borderRadius: 3, transition: 'width 0.35s ease' }} />
          </div>
        </div>
        {renderStep()}
      </div>
    </div>
  )
}
