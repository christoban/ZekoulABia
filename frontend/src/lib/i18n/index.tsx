'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

// Dictionnaire FR importé STATIQUEMENT (synchrone) → il est disponible dès le premier
// rendu, donc aucune clé brute (ex. « sidebar.dashboard ») ne s'affiche pendant que la
// langue de l'école se résout. Une école francophone ne voit aucun flash ; une école
// anglophone bascule FR→EN une seule fois après résolution.
import frCommon from '@/locales/fr/common.json'
import frNavigation from '@/locales/fr/navigation.json'
import frAdmin from '@/locales/fr/admin.json'
import frTeacher from '@/locales/fr/teacher.json'
import frStaff from '@/locales/fr/staff.json'
import frParent from '@/locales/fr/parent.json'
import frStudent from '@/locales/fr/student.json'
import frGrades from '@/locales/fr/grades.json'
import frFinance from '@/locales/fr/finance.json'
import frDiscipline from '@/locales/fr/discipline.json'
import frErrors from '@/locales/fr/errors.json'
import frOnboarding from '@/locales/fr/onboarding.json'
import frHrSelfService from '@/locales/fr/hrSelfService.json'

// Dictionnaires EN importés STATIQUEMENT eux aussi (l'import() dynamique s'avère peu fiable
// selon le navigateur/appareil — un toggle de langue qui « ne fait rien » sur mobile en était
// le symptôme). Léger surcoût de bundle, mais bascule FR↔EN garantie partout, synchrone.
import enCommon from '@/locales/en/common.json'
import enNavigation from '@/locales/en/navigation.json'
import enAdmin from '@/locales/en/admin.json'
import enTeacher from '@/locales/en/teacher.json'
import enStaff from '@/locales/en/staff.json'
import enParent from '@/locales/en/parent.json'
import enStudent from '@/locales/en/student.json'
import enGrades from '@/locales/en/grades.json'
import enFinance from '@/locales/en/finance.json'
import enDiscipline from '@/locales/en/discipline.json'
import enErrors from '@/locales/en/errors.json'
import enOnboarding from '@/locales/en/onboarding.json'
import enHrSelfService from '@/locales/en/hrSelfService.json'

export type Language = 'fr' | 'en'
type Dictionary = Record<string, any>
type Namespace =
  | 'common' | 'navigation' | 'admin' | 'teacher' | 'staff'
  | 'parent' | 'student' | 'grades' | 'finance' | 'discipline' | 'errors'
  | 'onboarding' | 'hrSelfService'

const ALL_NAMESPACES: Namespace[] = [
  'common', 'navigation', 'admin', 'teacher', 'staff',
  'parent', 'student', 'grades', 'finance', 'discipline', 'errors',
  'onboarding', 'hrSelfService',
]

// Dictionnaires complets FR et EN, prêts synchrones dès le chargement du module.
const FR_DICTS: Record<Namespace, Dictionary> = {
  common: frCommon, navigation: frNavigation, admin: frAdmin, teacher: frTeacher,
  staff: frStaff, parent: frParent, student: frStudent, grades: frGrades,
  finance: frFinance, discipline: frDiscipline, errors: frErrors, onboarding: frOnboarding,
  hrSelfService: frHrSelfService,
}
const EN_DICTS: Record<Namespace, Dictionary> = {
  common: enCommon, navigation: enNavigation, admin: enAdmin, teacher: enTeacher,
  staff: enStaff, parent: enParent, student: enStudent, grades: enGrades,
  finance: enFinance, discipline: enDiscipline, errors: enErrors, onboarding: enOnboarding,
  hrSelfService: enHrSelfService,
}

const DICTS_BY_LANG: Record<Language, Record<Namespace, Dictionary>> = { fr: FR_DICTS, en: EN_DICTS }
const PUBLIC_LANGUAGE_KEY = 'zekoulabia_lang_override'

export function isLanguage(value: string | null | undefined): value is Language {
  return value === 'fr' || value === 'en'
}

export function getDashboardLanguageKey(userId: string): string {
  return `zekoulabia_dashboard_lang_${userId}`
}

export function resolveDashboardLanguage(
  userId: string | null,
  dashboardLanguage: string | null,
  publicLanguage: string | null,
  browserLanguage: Language,
): Language {
  if (userId) return isLanguage(dashboardLanguage) ? dashboardLanguage : browserLanguage
  return isLanguage(publicLanguage) ? publicLanguage : browserLanguage
}

function getStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem('zekoulabia_user')
    if (!raw) return null
    const userId = (JSON.parse(raw) as { userId?: unknown }).userId
    return typeof userId === 'string' && userId ? userId : null
  } catch {
    return null
  }
}

function getBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'fr'
  return navigator.language?.startsWith('en') ? 'en' : 'fr'
}

// Résolution synchrone depuis les maps statiques (plus aucun import dynamique).
function loadAllDictionaries(lang: Language): Record<Namespace, Dictionary> {
  return DICTS_BY_LANG[lang]
}

interface I18nContextValue {
  lang: Language
  t: (namespace: Namespace) => (key: string, params?: Record<string, string | number>) => string
  changeLanguage: (lang: Language) => Promise<void>
  loading: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('fr')
  // Démarre avec le dictionnaire FR synchrone (jamais null) → pas de flash de clés.
  const [dicts, setDicts] = useState<Record<Namespace, Dictionary>>(FR_DICTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const userId = getStoredUserId()
    const resolved = resolveDashboardLanguage(
      userId,
      userId ? localStorage.getItem(getDashboardLanguageKey(userId)) : null,
      localStorage.getItem(PUBLIC_LANGUAGE_KEY),
      getBrowserLanguage(),
    )

    if (resolved === 'en' && !cancelled) {
      setLang('en')
      setDicts(loadAllDictionaries('en'))
    }
    if (!cancelled) setLoading(false)
    return () => { cancelled = true }
  }, [])

  function resolveKey(namespace: Namespace, key: string, params?: Record<string, string | number>): string {
    if (!dicts) return params ? key.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : key
    const dict = dicts[namespace]
    if (!dict) return key
    let val: any = key.split('.').reduce((acc: any, part) => acc?.[part], dict)
    if (typeof val !== 'string') {
      if (Array.isArray(val) || (typeof val === 'object' && val !== null)) return val
      val = key
    }
    if (params) val = val.replace(/\{(\w+)\}/g, (_match: string, k: string) => String(params[k] ?? `{${k}}`))
    return val
  }

  const t = useCallback(
    (namespace: Namespace) => (key: string, params?: Record<string, string | number>) => resolveKey(namespace, key, params),
    [dicts],
  )

  const changeLanguage = useCallback(async (newLang: Language) => {
    setLoading(true)
    try {
      const userId = getStoredUserId()
      localStorage.setItem(userId ? getDashboardLanguageKey(userId) : PUBLIC_LANGUAGE_KEY, newLang)
    } catch { /* ignore */ }
    setLang(newLang)
    setDicts(loadAllDictionaries(newLang))
    setLoading(false)
  }, [])

  return (
    <I18nContext.Provider value={{ lang, t, changeLanguage, loading }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT(namespace: Namespace): (key: string, params?: Record<string, string | number>) => string {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used within a LanguageProvider')
  return useCallback(
    (key: string, params?: Record<string, string | number>) => ctx.t(namespace)(key, params),
    [ctx.t, namespace],
  )
}

export function useLanguage(): { lang: Language; loading: boolean } {
  const ctx = useContext(I18nContext)
  if (!ctx) return { lang: 'fr', loading: true }
  return { lang: ctx.lang, loading: ctx.loading }
}

export function useChangeLanguage(): (lang: Language) => Promise<void> {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useChangeLanguage must be used within a LanguageProvider')
  return ctx.changeLanguage
}
