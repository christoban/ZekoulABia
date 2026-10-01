/**
 * Détecteur officiel des cycles scolaires et des classes d'examens d'État au Cameroun.
 * Applicable au sous-système francophone et anglophone, enseignement général et technique.
 */

// Niveaux d'examens d'État officiels (CEP, BEPC, CAP, Probatoire, Baccalauréat, GCE O/A Level)
const EXAM_KEYWORDS = [
  'cm2',
  'class 6',
  'class6',
  '3e',
  '3eme',
  '3ème',
  'form 5',
  'form5',
  'cap 4',
  'cap4',
  '1ere',
  '1ère',
  'lower sixth',
  'lowersixth',
  'bt 2',
  'bt2',
  'tle',
  'terminale',
  'upper sixth',
  'uppersixth',
  'bt 3',
  'bt3',
]

// Niveaux primaire et maternelle
const PRIMARY_OR_PRESCHOOL_KEYWORDS = [
  'sil',
  'cp',
  'ce1',
  'ce2',
  'cm1',
  'cm2',
  'class 1',
  'class1',
  'class 2',
  'class2',
  'class 3',
  'class3',
  'class 4',
  'class4',
  'class 5',
  'class5',
  'class 6',
  'class6',
  'ps',
  'ms',
  'gs',
  'nursery',
  'maternelle',
  'petite section',
  'moyenne section',
  'grande section',
]

// Niveaux du premier cycle du secondaire
const FIRST_CYCLE_SECONDARY_KEYWORDS = [
  '6e',
  '6eme',
  '6ème',
  '5e',
  '5eme',
  '5ème',
  '4e',
  '4eme',
  '4ème',
  '3e',
  '3eme',
  '3ème',
  'form 1',
  'form1',
  'form 2',
  'form2',
  'form 3',
  'form3',
  'cap 1',
  'cap 2',
  'cap 3',
  'cap 4',
]

// Niveaux du second cycle (lycée / autonomie élève)
const SECOND_CYCLE_KEYWORDS = [
  '2nde',
  'seconde',
  '1ere',
  '1ère',
  'premiere',
  'première',
  'tle',
  'terminale',
  'form 4',
  'form4',
  'form 5',
  'form5',
  'lower sixth',
  'lowersixth',
  'upper sixth',
  'uppersixth',
  'bt 1',
  'bt 2',
  'bt 3',
]

function normalize(str?: string | null): string {
  if (!str) return ''
  return str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Détermine si une classe est une classe d'examen officiel d'État.
 */
export function isExamClass(classeNom?: string | null, level?: string | null): boolean {
  const normClass = normalize(classeNom)
  const normLevel = normalize(level)

  return EXAM_KEYWORDS.some((kw) => {
    // Vérification par niveau
    if (normLevel === kw) return true
    // Vérification par nom de classe (ex: "3e A", "Tle D", "1ère C", "CM2 B", "UpperSixth Science")
    return (
      normClass.startsWith(kw + ' ') ||
      normClass.startsWith(kw + '-') ||
      normClass === kw ||
      normClass.includes(` ${kw} `) ||
      normClass.endsWith(` ${kw}`)
    )
  })
}

/**
 * Détermine le nom de l'examen officiel associé à la classe.
 */
export function getExamLabel(classeNom?: string | null, level?: string | null): string {
  const normClass = normalize(classeNom)
  const normLevel = normalize(level)
  const txt = `${normLevel} ${normClass}`

  if (txt.includes('cm2') || txt.includes('class 6') || txt.includes('class6')) return 'CEP / FSLC'
  if (txt.includes('3e') || txt.includes('3ème')) return 'BEPC'
  if (txt.includes('form 5') || txt.includes('form5')) return 'GCE Ordinary Level'
  if (txt.includes('cap')) return 'CAP'
  if (txt.includes('1ere') || txt.includes('1ère') || txt.includes('premiere')) return 'Probatoire'
  if (txt.includes('lower sixth') || txt.includes('lowersixth')) return 'GCE Advanced Level (Part 1)'
  if (txt.includes('tle') || txt.includes('terminale')) return 'Baccalauréat'
  if (txt.includes('upper sixth') || txt.includes('uppersixth')) return 'GCE Advanced Level'
  if (txt.includes('bt')) return 'Brevet de Technicien'
  return 'Examen officiel'
}

/**
 * Indique si l'élève est en maternelle, primaire ou 1er cycle du secondaire
 * (tutelle légale parentale directe).
 */
export function isFirstCycleOrPrimary(classeNom?: string | null, level?: string | null): boolean {
  const normClass = normalize(classeNom)
  const normLevel = normalize(level)

  // 1. Primaire ou maternelle
  if (PRIMARY_OR_PRESCHOOL_KEYWORDS.some((kw) => normLevel.includes(kw) || normClass.includes(kw))) {
    return true
  }

  // 2. Premier cycle
  if (
    FIRST_CYCLE_SECONDARY_KEYWORDS.some(
      (kw) =>
        normLevel === kw ||
        normClass.startsWith(kw + ' ') ||
        normClass.startsWith(kw + '-') ||
        normClass === kw
    )
  ) {
    return true
  }

  // Si explicitement second cycle, renvoyer false
  if (
    SECOND_CYCLE_KEYWORDS.some(
      (kw) =>
        normLevel === kw ||
        normClass.startsWith(kw + ' ') ||
        normClass.startsWith(kw + '-') ||
        normClass === kw
    )
  ) {
    return false
  }

  // Par défaut, si non reconnu mais ressemble à 6e/5e/4e/3e
  return true
}

/**
 * Indique si l'élève est en second cycle (autonome).
 */
export function isSecondCycle(classeNom?: string | null, level?: string | null): boolean {
  return !isFirstCycleOrPrimary(classeNom, level)
}

/**
 * Vérifie si l'établissement est privé (laïque ou confessionnel).
 */
export function isSchoolPrivate(ownership?: string | null): boolean {
  if (!ownership) return true // Par précaution, par défaut
  return ownership !== 'PUBLIC'
}
