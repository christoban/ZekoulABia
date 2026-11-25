import { describe, expect, it } from 'bun:test'
import { GRILLE_HORAIRE_PAR_DEFAUT, validateGrilleHoraire } from '../app/admin/configuration/timetableGridConfig'

describe('validateGrilleHoraire', () => {
  it('accepte la grille proposée par défaut', () => {
    expect(validateGrilleHoraire(GRILLE_HORAIRE_PAR_DEFAUT)).toBeNull()
  })

  it('refuse une journée sans jour actif', () => {
    expect(validateGrilleHoraire({ ...GRILLE_HORAIRE_PAR_DEFAUT, joursActifs: [] })).toBe('jours')
  })

  it('refuse une grille qui dépasse minuit', () => {
    expect(validateGrilleHoraire({
      ...GRILLE_HORAIRE_PAR_DEFAUT,
      heureDebut: '23:30',
      periodesAvantP1: 6,
      periodesAvantP2: 6,
      periodesApresP2: 0,
    })).toBe('journee')
  })

  it('refuse une grille valide en nombre de périodes mais trop longue pour la journée', () => {
    expect(validateGrilleHoraire({
      ...GRILLE_HORAIRE_PAR_DEFAUT,
      heureDebut: '18:00',
      dureePeriode: 120,
      periodesAvantP1: 3,
      periodesAvantP2: 3,
      periodesApresP2: 1,
    })).toBe('journee')
  })
})
