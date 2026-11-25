import { describe, it, expect } from 'bun:test'
import {
  calculerProfilAcces,
  resoudreCycle,
} from '@/components/enrollment/stepper/types'

describe('Enrollment Stepper — CycleResolver & Profil d\'accès', () => {
  it('résout correctement le 1er cycle pour 6e, 5e, 4e, 3e, Form 1 à 5', () => {
    expect(resoudreCycle('6e')).toBe('PREMIER_CYCLE')
    expect(resoudreCycle('3e')).toBe('PREMIER_CYCLE')
    expect(resoudreCycle('Form 1')).toBe('PREMIER_CYCLE')
    expect(resoudreCycle('Form 5')).toBe('PREMIER_CYCLE')
  })

  it('résout correctement le 2nd cycle pour 2nde, 1ere, Tle, Lower Sixth, Upper Sixth', () => {
    expect(resoudreCycle('2nde')).toBe('SECOND_CYCLE')
    expect(resoudreCycle('1ere')).toBe('SECOND_CYCLE')
    expect(resoudreCycle('Tle')).toBe('SECOND_CYCLE')
    expect(resoudreCycle('Lower Sixth')).toBe('SECOND_CYCLE')
    expect(resoudreCycle('Upper Sixth')).toBe('SECOND_CYCLE')
  })

  it('oriente vers support papier si aucun téléphone disponible', () => {
    const res = calculerProfilAcces('6e', 'AUCUN', 'AUCUN', true)
    expect(res.canalNotification).toBe('papier')
    expect(res.profilGerePar).toBe('secrétariat')
    expect(res.compteEleve).toBe('aucun')
    expect(res.phraseClaire).toContain('support papier')
  })

  it('attribue un compte supervisé au parent en 1er cycle avec smartphone parent', () => {
    const res = calculerProfilAcces('6e', 'AUCUN', 'SMARTPHONE_ANDROID', false)
    expect(res.canalNotification).toBe('appli')
    expect(res.profilGerePar).toBe('parent')
    expect(res.compteEleve).toBe('aucun')
    expect(res.phraseClaire).toContain('parent')
  })

  it('permet l\'autonomie de l\'élève en 2nd cycle avec smartphone élève', () => {
    const res = calculerProfilAcces('Tle', 'SMARTPHONE_ANDROID', 'SIMPLE', false)
    expect(res.canalNotification).toBe('appli')
    expect(res.profilGerePar).toBe('eleve')
    expect(res.compteEleve).toBe('complet')
    expect(res.phraseClaire).toContain('Second cycle avec smartphone')
  })

  it('notifie par SMS si le parent n\'a qu\'un téléphone simple sans smartphone', () => {
    const res = calculerProfilAcces('4e', 'AUCUN', 'SIMPLE', false)
    expect(res.canalNotification).toBe('sms')
    expect(res.profilGerePar).toBe('parent')
    expect(res.compteEleve).toBe('aucun')
    expect(res.phraseClaire).toContain('SMS')
  })
})
