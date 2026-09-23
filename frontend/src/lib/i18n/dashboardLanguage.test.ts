import { describe, expect, it } from 'bun:test'
import { getDashboardLanguageKey, resolveDashboardLanguage } from './index'

describe('langue du dashboard par utilisateur', () => {
  it("ignore la langue publique quand l'utilisateur a une préférence", () => {
    expect(resolveDashboardLanguage('user-a', 'fr', 'en', 'en')).toBe('fr')
  })

  it('isole les préférences de deux comptes sur le même navigateur', () => {
    const languages = new Map([
      [getDashboardLanguageKey('user-a'), 'fr'],
      [getDashboardLanguageKey('user-b'), 'en'],
    ])

    expect(resolveDashboardLanguage('user-a', languages.get('zekoulabia_dashboard_lang_user-a') ?? null, 'en', 'fr')).toBe('fr')
    expect(resolveDashboardLanguage('user-b', languages.get('zekoulabia_dashboard_lang_user-b') ?? null, 'fr', 'fr')).toBe('en')
  })

  it('conserve le choix de langue sur les pages publiques', () => {
    expect(resolveDashboardLanguage(null, null, 'en', 'fr')).toBe('en')
  })
})
