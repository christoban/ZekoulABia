'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useT, useChangeLanguage, useLanguage } from '@/lib/i18n'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import { pickEffectiveTemplateCode, suggestTemplateCode } from '@/lib/onboarding/templateSelection'
import { resolveTemplateCandidates } from '@/lib/onboarding/resolveTemplateCandidates'
import type { LevelFamily, OfferFlag, Phase1Profile, SchoolStructure, SecondarySpan } from '@/lib/onboarding/phase1Profile'
import { deriveEducationType } from '@/lib/onboarding/phase1Profile'
import { CONVENTION_KEYS, INITIAL_FORM, OWNERSHIP_KEYS, SUBSYSTEM_KEYS, toSlug } from './constants'
import {
  fetchPreviewStructureApi,
  fetchTemplateCatalogApi,
  submitOnboardingApi,
  verifyInviteTokenApi,
} from './onboardingApi'
import type { FormData, InviteData, LoadState, PreviewData, Step } from './types'
import { useStep3ExtraState } from './useStep3ExtraState'
import { useTemplateScopeSync } from './useTemplateScopeSync'
import { validateStep1Data, validateStep2Data, validateStep3Data } from './validation'

export function useOnboardingWizard() {
  const params = useParams()
  const token = params?.token as string
  const t = useT('onboarding')
  const { lang: currentLang } = useLanguage()
  const changeLanguage = useChangeLanguage()

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [step, setStep] = useState<Step>(1)
  const [done, setDone] = useState(false)
  const [createdStats, setCreatedStats] = useState<{ classCount?: number; subjectCount?: number; academicYear?: string } | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [stepError, setStepError] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [templateCatalog, setTemplateCatalog] = useState<TemplateCatalogEntry[]>([])
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string | null>(null)
  const [structure, setStructure] = useState<SchoolStructure | null>(null)
  const [levelFamily, setLevelFamily] = useState<LevelFamily | null>(null)
  const [offers, setOffers] = useState<OfferFlag[]>([])
  const [secondarySpan, setSecondarySpan] = useState<SecondarySpan>(null)
  const [form, setForm] = useState<FormData>(INITIAL_FORM)

  const extra = useStep3ExtraState()
  const slRef = useRef(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    fetchTemplateCatalogApi().then((templates) => {
      if (templates) setTemplateCatalog(templates)
    })
  }, [])

  const profile = useMemo<Phase1Profile>(
    () => ({
      subsystem:
        form.subsystem === 'FRANCOPHONE' || form.subsystem === 'ANGLOPHONE' || form.subsystem === 'BILINGUAL'
          ? form.subsystem
          : null,
      structure,
      levelFamily,
      offers,
      secondarySpan,
      ownership:
        form.ownership === 'PUBLIC' || form.ownership === 'PRIVATE_SECULAR' || form.ownership === 'PRIVATE_FAITH'
          ? form.ownership
          : null,
      selectedTemplateCode,
    }),
    [form.subsystem, form.ownership, structure, levelFamily, offers, secondarySpan, selectedTemplateCode]
  )

  const suggestedCode = useMemo(() => suggestTemplateCode(profile, templateCatalog), [profile, templateCatalog])
  const effectiveCode = useMemo(() => pickEffectiveTemplateCode(selectedTemplateCode, suggestedCode), [selectedTemplateCode, suggestedCode])
  const template = useMemo(
    () => (effectiveCode ? templateCatalog.find((entry) => entry.code === effectiveCode) ?? null : null),
    [effectiveCode, templateCatalog]
  )
  const filteredTemplates = useMemo(() => resolveTemplateCandidates(templateCatalog, profile), [templateCatalog, profile])

  useEffect(() => {
    setForm((current) => ({ ...current, educationType: deriveEducationType(offers) ?? (structure === 'COMPLEX' ? 'MIXED' : '') }))
  }, [offers, structure])

  useEffect(() => {
    if (selectedTemplateCode !== null && !filteredTemplates.some((candidate) => candidate.code === selectedTemplateCode)) {
      setSelectedTemplateCode(null)
    }
    if (levelFamily !== 'SECONDARY' && secondarySpan !== null) setSecondarySpan(null)
  }, [filteredTemplates, selectedTemplateCode, levelFamily, secondarySpan])

  const setWithTemplateReset = (k: 'subsystem' | 'ownership') => (v: string) => {
    setSelectedTemplateCode(null)
    setForm((f) => ({ ...f, [k]: v }))
  }

  const set = (k: keyof FormData) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const subsystemOptions = useMemo(() => SUBSYSTEM_KEYS.map((k) => ({ ...k, label: t(k.key) })), [t])
  const ownershipOptions = useMemo(() => OWNERSHIP_KEYS.map((k) => ({ ...k, label: t(k.key) })), [t])
  const conventionOptions = useMemo(() => CONVENTION_KEYS.map((k) => ({ ...k, label: t(k.key), desc: t(k.descKey) })), [t])

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) {
      setStepError(t('phase1.step1.logo.errorSize'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => set('logoBase64')(reader.result as string)
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!slRef.current && form.nom) {
      setForm((f) => ({ ...f, subdomain: toSlug(f.nom) }))
    }
  }, [form.nom])

  useEffect(() => {
    if (!token) {
      const timer = setTimeout(() => {
        setLoadState('invalid')
        setErrorMsg("Lien d'invitation invalide ou incomplet.")
      }, 1000)
      return () => clearTimeout(timer)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    verifyInviteTokenApi(token, controller.signal)
      .then((data) => {
        if (data.success && data.data) {
          setInviteData(data.data)
          setForm((f) => ({ ...f, nom: data.data!.schoolName, adminEmail: data.data!.email }))
          setLoadState('valid')
        } else {
          const msg = data.message ?? 'Invitation invalide.'
          if (msg.includes('expiré')) setLoadState('expired')
          else if (msg.includes('utilisée')) setLoadState('used')
          else setLoadState('invalid')
          setErrorMsg(msg)
        }
      })
      .catch((err) => {
        setLoadState('invalid')
        setErrorMsg(
          err?.name === 'AbortError'
            ? 'La vérification a pris trop de temps. Vérifiez votre connexion et réessayez.'
            : "Impossible de vérifier l'invitation. Vérifiez votre connexion."
        )
      })
      .finally(() => clearTimeout(timeout))
  }, [token])

  useTemplateScopeSync({
    template,
    offers,
    setForm,
    niveaux2eCycle: form.niveaux2eCycle,
    ...extra,
  })

  useEffect(() => {
    if (step !== 3) return
    clearTimeout(previewTimerRef.current)
    if (form.niveaux1erCycle.length === 0 && form.niveaux2eCycle.length === 0 && form.niveauxPrimaire.length === 0) {
      setPreviewData(null)
      return
    }
    previewTimerRef.current = setTimeout(() => {
      setPreviewLoading(true)
      const controller = new AbortController()
      fetchPreviewStructureApi({ templateCode: template?.code, form, signal: controller.signal })
        .then((data) => {
          if (data) setPreviewData(data)
        })
        .catch(() => {})
        .finally(() => setPreviewLoading(false))
    }, 600)
    return () => clearTimeout(previewTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    form.niveaux1erCycle,
    form.classesParNiveau,
    form.conventionNommage,
    form.niveaux2eCycle,
    form.filieres,
    form.a4Languages,
    form.classesParFiliere,
    form.lv2Disponibles,
    form.niveauxPrimaire,
    form.classesParNiveauPrimaire,
    template?.code,
  ])

  function goNext() {
    setStepError('')
    if (step === 1) {
      const err = validateStep1Data({ form, profile, effectiveCode, templateCatalog, t })
      if (err) { setStepError(err); return }
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2Data(form)
      if (err) { setStepError(err); return }
      setStep(3)
    } else if (step === 3) {
      const err = validateStep3Data({
        template,
        form,
        offers,
        maternelleSections: extra.maternelleSections,
        bilingualEnLevels: extra.bilingualEnLevels,
        bilingualEnFilieres: extra.bilingualEnFilieres,
        sarMetiers: extra.sarMetiers,
        cfmFilieres: extra.cfmFilieres,
        enStreamStartLevel: extra.enStreamStartLevel,
        enGradingSystem: extra.enGradingSystem,
        t,
      })
      if (err) { setStepError(err); return }
      setStep(4)
    }
  }

  async function handleSubmit() {
    setSubmitError('')
    setSubmitLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const stats = await submitOnboardingApi(
        {
          token,
          form,
          template,
          ...extra,
        },
        controller.signal
      )
      clearTimeout(timeout)
      if (stats) setCreatedStats(stats)
      setDone(true)
    } catch (e: unknown) {
      clearTimeout(timeout)
      const msg =
        e instanceof DOMException && e.name === 'AbortError'
          ? 'La requête a pris trop de temps (>30s). Vérifiez votre connexion et réessayez.'
          : e instanceof Error
            ? e.message
            : 'Erreur réseau. Vérifiez votre connexion et réessayez.'
      setSubmitError(msg)
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    } finally {
      setSubmitLoading(false)
    }
  }

  return {
    currentLang,
    changeLanguage,
    loadState,
    inviteData,
    errorMsg,
    step,
    setStep,
    done,
    createdStats,
    submitLoading,
    submitError,
    setSubmitError,
    stepError,
    setStepError,
    showPwd,
    setShowPwd,
    showConfirm,
    setShowConfirm,
    previewData,
    previewLoading,
    ...extra,
    templateCatalog,
    selectedTemplateCode,
    setSelectedTemplateCode,
    structure,
    setStructure,
    levelFamily,
    setLevelFamily,
    offers,
    setOffers,
    secondarySpan,
    setSecondarySpan,
    form,
    setForm,
    slRef,
    logoInputRef,
    errorRef,
    suggestedCode,
    effectiveCode,
    template,
    filteredTemplates,
    subsystemOptions,
    ownershipOptions,
    conventionOptions,
    set,
    setWithTemplateReset,
    handleLogoUpload,
    setNiveauCount: (niveau: string, count: number) =>
      setForm((f) => ({ ...f, classesParNiveau: { ...f.classesParNiveau, [niveau]: count } })),
    setNiveauPrimaireCount: (niveau: string, count: number) =>
      setForm((f) => ({ ...f, classesParNiveauPrimaire: { ...f.classesParNiveauPrimaire, [niveau]: count } })),
    goNext,
    handleSubmit,
  }
}
