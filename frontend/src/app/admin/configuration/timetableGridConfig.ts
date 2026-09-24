export type JourSemaine = 'LUNDI' | 'MARDI' | 'MERCREDI' | 'JEUDI' | 'VENDREDI' | 'SAMEDI'

export interface GrilleHoraireConfig {
  heureDebut: string
  dureePeriode: number
  periodesAvantP1: number
  dureePetitePause: number
  periodesAvantP2: number
  dureeGrandePause: number
  periodesApresP2: number
  joursActifs: JourSemaine[]
}

export type GrilleHoraireErreur = 'heure' | 'dureePeriode' | 'periodes' | 'petitePause' | 'grandePause' | 'jours' | 'journee'

export const JOURS_GRILLE: JourSemaine[] = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']

export const GRILLE_HORAIRE_PAR_DEFAUT: GrilleHoraireConfig = {
  heureDebut: '07:30',
  dureePeriode: 55,
  periodesAvantP1: 2,
  dureePetitePause: 15,
  periodesAvantP2: 3,
  dureeGrandePause: 30,
  periodesApresP2: 2,
  joursActifs: ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'],
}

function estEntierEntre(valeur: number, minimum: number, maximum: number): boolean {
  return Number.isInteger(valeur) && valeur >= minimum && valeur <= maximum
}

export function nombrePeriodes(config: GrilleHoraireConfig): number {
  return config.periodesAvantP1 + config.periodesAvantP2 + config.periodesApresP2
}

export function dureeJournee(config: GrilleHoraireConfig): number {
  return nombrePeriodes(config) * config.dureePeriode + config.dureePetitePause + config.dureeGrandePause
}

export function heureFin(config: GrilleHoraireConfig): string {
  const [heures, minutes] = config.heureDebut.split(':').map(Number)
  if (!Number.isInteger(heures) || !Number.isInteger(minutes)) return '—'
  const total = heures * 60 + minutes + dureeJournee(config)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function validateGrilleHoraire(config: GrilleHoraireConfig): GrilleHoraireErreur | null {
  const [heures, minutes] = config.heureDebut.split(':').map(Number)
  if (!/^\d{2}:\d{2}$/.test(config.heureDebut) || !estEntierEntre(heures, 0, 23) || !estEntierEntre(minutes, 0, 59)) return 'heure'
  if (!estEntierEntre(config.dureePeriode, 30, 120)) return 'dureePeriode'
  if (![config.periodesAvantP1, config.periodesAvantP2, config.periodesApresP2].every(n => estEntierEntre(n, 0, 6))) return 'periodes'
  if (nombrePeriodes(config) < 1 || nombrePeriodes(config) > 12) return 'periodes'
  if (!estEntierEntre(config.dureePetitePause, 0, 60)) return 'petitePause'
  if (!estEntierEntre(config.dureeGrandePause, 0, 90)) return 'grandePause'
  if (config.joursActifs.length < 1 || config.joursActifs.some(jour => !JOURS_GRILLE.includes(jour))) return 'jours'
  if (heures * 60 + minutes + dureeJournee(config) > 24 * 60) return 'journee'
  return null
}
