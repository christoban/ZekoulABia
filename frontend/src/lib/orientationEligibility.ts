/**
 * Détecteur d'éligibilité aux Paliers d'Orientation Scolaire (Système Éducatif Camerounais).
 *
 * Règles certifiées :
 * 1. Choix LV2 : Uniquement si l'école propose des LV2, pour les élèves en classe de 5ème (ou 4ème selon l'école).
 * 2. Fin de 3ème : Uniquement pour les élèves en classe de 3ème (Orientation vers le second cycle : Seconde A/C/TI).
 * 3. Fin de 2nde C : Uniquement pour les élèves en classe de Seconde C (Spécialisation vers 1ère C/D/TI).
 * 4. Autres classes (6ème, 2nde A, 1ère, Terminale...) : AUCUN palier d'orientation -> Masquage total de l'orientation.
 */

export type OrientationCheckpointKey = 'LV2' | 'FIN_TROISIEME' | 'FIN_SECONDE_C'

export interface OrientationEligibilityResult {
  isEligible: boolean
  checkpointKey: OrientationCheckpointKey | null
  titleFr: string
  subtitleFr: string
  reasonFr?: string
}

export function resolveOrientationEligibility(
  classeNom?: string | null,
  classeLevel?: string | null,
  serie?: string | null,
  hasSchoolLv2 = true
): OrientationEligibilityResult {
  const levelNorm = (classeLevel || '').trim().toLowerCase()
  const nameNorm = (classeNom || '').trim().toLowerCase()
  const serieNorm = (serie || '').trim().toUpperCase()

  // 1. Détection classe de 3ème (Fin de 3ème -> Vers Seconde A / C / TI)
  const isTroisieme =
    levelNorm === '3e' ||
    levelNorm === '3eme' ||
    nameNorm.startsWith('3e') ||
    nameNorm.startsWith('3ème') ||
    nameNorm.includes(' 3e') ||
    nameNorm.includes(' 3ème') ||
    nameNorm.includes('troisieme') ||
    nameNorm.includes('troisième')

  if (isTroisieme) {
    return {
      isEligible: true,
      checkpointKey: 'FIN_TROISIEME',
      titleFr: 'Orientation Fin de 3ème · Vers le Second Cycle',
      subtitleFr: 'Choix de votre filière pour la classe de Seconde (Seconde A, Seconde C ou Technique)',
    }
  }

  // 2. Détection classe de Seconde C (Fin de 2nde C -> Vers 1ère C / D / TI)
  const isSeconde =
    levelNorm === '2nde' ||
    levelNorm === '2nd' ||
    levelNorm === 'seconde' ||
    nameNorm.startsWith('2nde') ||
    nameNorm.startsWith('2nd') ||
    nameNorm.startsWith('seconde') ||
    nameNorm.includes(' 2nde') ||
    nameNorm.includes(' seconde')

  const isSerieC =
    serieNorm === 'C' ||
    nameNorm.includes(' 2nde c') ||
    nameNorm.includes(' 2nd c') ||
    nameNorm.includes(' 2ndec') ||
    nameNorm.endsWith(' c') ||
    nameNorm.includes('seconde c')

  if (isSeconde && isSerieC) {
    return {
      isEligible: true,
      checkpointKey: 'FIN_SECONDE_C',
      titleFr: 'Orientation Fin de Seconde C · Spécialisation Scientifique',
      subtitleFr: 'Choix de votre filière de Première (Première C Mathématiques, Première D Biologie, ou Première TI Informatique)',
    }
  }

  // 3. Détection classe préparant le choix de LV2 (5ème ou 4ème selon l'école)
  // Concerne la 5ème par défaut au Cameroun (pour débuter en 4ème) ou 4ème si LV2 débute en 3ème
  const isCinquieme =
    levelNorm === '5e' ||
    levelNorm === '5eme' ||
    nameNorm.startsWith('5e') ||
    nameNorm.startsWith('5ème') ||
    nameNorm.includes(' 5e') ||
    nameNorm.includes(' 5ème') ||
    nameNorm.includes('cinquieme') ||
    nameNorm.includes('cinquième')

  const isQuatrieme =
    levelNorm === '4e' ||
    levelNorm === '4eme' ||
    nameNorm.startsWith('4e') ||
    nameNorm.startsWith('4ème') ||
    nameNorm.includes(' 4e') ||
    nameNorm.includes(' 4ème') ||
    nameNorm.includes('quatrieme') ||
    nameNorm.includes('quatrième')

  if (hasSchoolLv2 && (isCinquieme || isQuatrieme)) {
    return {
      isEligible: true,
      checkpointKey: 'LV2',
      titleFr: 'Orientation Linguistique · Choix de la Langue Vivante 2 (LV2)',
      subtitleFr: isCinquieme
        ? 'Sélectionnez votre LV2 (Allemand, Espagnol, Chinois, Italien...) pour la classe de 4ème'
        : 'Sélectionnez votre LV2 pour la classe de 3ème',
    }
  }

  // 4. Aucune orientation applicable pour cette classe (ex: 6ème, 2nde A, 1ère, Terminale, primaire...)
  return {
    isEligible: false,
    checkpointKey: null,
    titleFr: 'Aucune orientation en cours',
    subtitleFr: 'Votre niveau actuel ne comporte aucun palier d’orientation pour cette année scolaire.',
    reasonFr: isSeconde && !isSerieC
      ? 'Les élèves de Seconde Littéraire (2nde A) poursuivent leur parcours en Première Littéraire (1ère A).'
      : 'Aucun changement de cycle ou spécialisation requis pour cette classe.',
  }
}
