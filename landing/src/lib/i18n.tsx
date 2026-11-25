'use client'

/**
 * i18n minimal pour le site marketing — volontairement PAS le système complet de l'app
 * (frontend/src/lib/i18n/index.tsx), qui charge 13 espaces de noms de traductions (admin,
 * teacher, staff, grades, finance...) totalement hors sujet ici. Ce site n'a besoin que d'un
 * état de langue FR/EN : le contenu lui-même vit directement dans LandingPage.tsx (textsFR/
 * textsEN), pas dans des dictionnaires JSON séparés.
 *
 * Pas de résolution "langue de l'établissement" non plus (ça n'existe pas ici, aucun
 * utilisateur connecté sur ce domaine) — juste : préférence mémorisée > langue du navigateur >
 * français par défaut. Même clé localStorage que l'app principale, sans effet de partage réel
 * puisque ce site vit sur un domaine séparé (zekoulabia.com vs app.zekoulabia.com) —
 * localStorage n'est jamais partagé entre origines différentes.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Language = 'fr' | 'en'

const STORAGE_KEY = 'zekoulabia_lang_override'

function getBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'fr'
  return navigator.language?.startsWith('en') ? 'en' : 'fr'
}

interface I18nContextValue {
  lang: Language
  changeLanguage: (lang: Language) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('fr')

  useEffect(() => {
    let override: string | null = null
    try { override = localStorage.getItem(STORAGE_KEY) } catch { /* ignore */ }
    setLang(override === 'fr' || override === 'en' ? override : getBrowserLanguage())
  }, [])

  const changeLanguage = useCallback((newLang: Language) => {
    try { localStorage.setItem(STORAGE_KEY, newLang) } catch { /* ignore */ }
    setLang(newLang)
  }, [])

  return <I18nContext.Provider value={{ lang, changeLanguage }}>{children}</I18nContext.Provider>
}

export function useLanguage(): { lang: Language } {
  const ctx = useContext(I18nContext)
  if (!ctx) return { lang: 'fr' }
  return { lang: ctx.lang }
}

export function useChangeLanguage(): (lang: Language) => void {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useChangeLanguage must be used within a LanguageProvider')
  return ctx.changeLanguage
}
