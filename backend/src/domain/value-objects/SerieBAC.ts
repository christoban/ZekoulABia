/**
 * DOMAIN LAYER — Logique métier pure
 * Aucune dépendance externe autorisée dans ce fichier.
 */

// Règles officielles MINESEC sur les séries par niveau
// Ces règles sont appliquées à chaque création/modification de classe

export const SERIES_BY_LEVEL: Record<string, string[]> = {
  // 1er cycle — pas de série
  "6e": [],
  "5e": [],
  "4e": [],
  "3e": [],

  // Seconde — pas de D ni TI (E démarre en 2nde)
  "2nde": ["A4", "ABI", "C", "A1", "A2", "A3", "A5", "E", "SH", "AC"],

  // Première et Terminale — toutes les séries disponibles
  "1ere": ["A4", "ABI", "C", "D", "TI", "E", "A1", "A2", "A3", "A5", "SH", "AC"],
  Tle: ["A4", "ABI", "C", "D", "TI", "E", "A1", "A2", "A3", "A5", "SH", "AC"],
}

export const FIRST_CYCLE_LEVELS = ["6e", "5e", "4e", "3e"]
export const SECOND_CYCLE_LEVELS = ["2nde", "1ere", "Tle"]

export const PRIMARY_LEVELS = [
  "SIL",
  "CP",
  "CE1",
  "CE2",
  "CM1",
  "CM2",
  "Class1",
  "Class2",
  "Class3",
  "Class4",
  "Class5",
  "Class6",
]
export const PRESCHOOL_LEVELS = [
  "PS",
  "MS",
  "GS",
  "PreNursery",
  "Nursery1",
  "Nursery2",
  "Petite section",
  "Moyenne section",
  "Grande section",
]
export const TECHNICAL_LEVELS = ["CAP1", "CAP2", "CAP3", "CAP4", "BT1", "BT2", "BT3"]
export const ANGLOPHONE_SECONDARY_LEVELS = ["Form1", "Form2", "Form3", "Form4", "Form5", "LowerSixth", "UpperSixth"]

// Niveaux anglophones SANS filière (lower cycle)
export const ANGLOPHONE_LOWER_LEVELS = ["Form1", "Form2", "Form3"]

// Niveaux anglophones AVEC filière possible (upper cycle)
// Arts : A1, A2, A3, A4  |  Sciences : S1, S2, S3, S4
export const ANGLOPHONE_UPPER_LEVELS = ["Form4", "Form5", "LowerSixth", "UpperSixth"]

// Filières anglophones officielles GCE Board
export const ANGLOPHONE_SERIES = ["A1", "A2", "A3", "A4", "S1", "S2", "S3", "S4"]

export const NO_SERIE_LEVELS = [
  ...PRIMARY_LEVELS,
  ...PRESCHOOL_LEVELS,
  ...TECHNICAL_LEVELS,
  ...ANGLOPHONE_LOWER_LEVELS,
  // ANGLOPHONE_UPPER_LEVELS retiré — Form4+ peuvent avoir une filière
]

// Séries interdites en Seconde
export const SERIES_FORBIDDEN_IN_SECONDE = ["TI", "D"]

// Niveaux où les coefficients BAC s'appliquent
export const BAC_LEVELS = ["Tle"]
export const PROBATOIRE_LEVELS = ["1ere"]

export function validateClassSerie(level: string, serie: string | null | undefined): {
  valid: boolean
  error?: string
} {
  const serieNormalized = serie ?? null

  // Niveaux sans série (primaire, maternelle, technique, anglophone lower cycle)
  if (NO_SERIE_LEVELS.includes(level)) {
    if (serieNormalized !== null) {
      return {
        valid: false,
        error: `Le niveau ${level} n'accepte pas de série.`,
      }
    }
    return { valid: true }
  }

  // Niveaux anglophones upper cycle (Form4+) — filière optionnelle
  if (ANGLOPHONE_UPPER_LEVELS.includes(level)) {
    if (serieNormalized && !ANGLOPHONE_SERIES.includes(serieNormalized)) {
      return {
        valid: false,
        error: `La filière "${serieNormalized}" n'est pas valide pour le niveau anglophone ${level}. Filières valides : ${ANGLOPHONE_SERIES.join(", ")} (Arts A1-A4 ou Sciences S1-S4).`,
      }
    }
    // Pas de filière = accepté (Form4 peut être sans filière en début d'année)
    return { valid: true }
  }

  // 1er cycle francophone → pas de série
  if (FIRST_CYCLE_LEVELS.includes(level)) {
    if (serieNormalized !== null) {
      return {
        valid: false,
        error: `Le niveau ${level} appartient au 1er cycle francophone. Aucune série ne doit être assignée.`,
      }
    }
    return { valid: true }
  }

  // 2nd cycle → série obligatoire
  if (SECOND_CYCLE_LEVELS.includes(level)) {
    if (!serieNormalized) {
      return {
        valid: false,
        error: `Le niveau ${level} requiert une série.`,
      }
    }
    if (level === "2nde" && SERIES_FORBIDDEN_IN_SECONDE.includes(serieNormalized)) {
      return {
        valid: false,
        error: `La série ${serieNormalized} n'existe pas en Seconde. Elle démarre en Première.`,
      }
    }
    const allowed = SERIES_BY_LEVEL[level]
    if (allowed && allowed.length > 0 && !allowed.includes(serieNormalized)) {
      return {
        valid: false,
        error: `La série ${serieNormalized} n'est pas valide pour le niveau ${level}.`,
      }
    }
    return { valid: true }
  }

  // Niveau non reconnu → valid par défaut (soumis à review terrain)
  return { valid: true }
}

// Codes filières officiels MINESEC (enseignement technique)
export const TECHNICAL_FILIERES_OFFICIAL = [
  "F1",
  "F2",
  "F3", // Électricité, Électronique, Mécanique
  "G1",
  "G2",
  "G3", // Secrétariat, Comptabilité, Commerce
  "INFOR", // Informatique
  "HOTEL", // Hôtellerie/Restauration
  "COUTURE", // Couture/Mode
  "AGRIC", // Agriculture
  "SAR",
  "SM", // Section Artisanale / Ménagère
]

// Codes filières internes connus — non officiel MINESEC mais valides terrain
// Source : enquêtes terrain Garoua 2026
export const TECHNICAL_FILIERES_INTERNAL = [
  "MAEL", // Mécanique Automobile Electrique (Lycée Technique Djamboutou)
  "TMI", // filière technique — code interne
  "ECS", // Économie/Cuisine/Service — code interne
  "IH", // Hôtellerie — code interne alternatif
  "ESF", // Économie et Sciences Familiales (confirmé bulletin Lycée Technique Garoua)
]

// Liste combinée pour la validation
export const TECHNICAL_FILIERES = [...TECHNICAL_FILIERES_OFFICIAL, ...TECHNICAL_FILIERES_INTERNAL]

// ── PEBS (Programme d'Éducation Bilingue Spécial) ─────────────────────────
export const PEBS_FILIERES = {
  FR_GENERAL: 'FR_GENERAL',
  FR_PEBS:    'FR_PEBS',
  EN_GENERAL: 'EN_GENERAL',
  EN_PEBS:    'EN_PEBS',
} as const

export type PebsFiliere = (typeof PEBS_FILIERES)[keyof typeof PEBS_FILIERES]

export const PEBS_VALUES = Object.values(PEBS_FILIERES)

export function isPEBSFiliere(value: string): boolean {
  return PEBS_VALUES.includes(value as PebsFiliere)
}

export function getDefaultFiliere(isAnglophone: boolean): string {
  return isAnglophone ? PEBS_FILIERES.EN_GENERAL : PEBS_FILIERES.FR_GENERAL
}

export function validateClassFiliere(level: string, filiere: string | null | undefined): {
  valid: boolean
  warning?: string
  error?: string
} {
  const filiereNormalized = filiere ?? null

  // 1er cycle francophone — PEBS filieres autorisées
  if (FIRST_CYCLE_LEVELS.includes(level)) {
    if (filiereNormalized && filiereNormalized !== PEBS_FILIERES.FR_GENERAL && filiereNormalized !== PEBS_FILIERES.FR_PEBS) {
      return {
        valid: false,
        error: `Pour le niveau ${level}, les seules valeurs de filière autorisées sont "${PEBS_FILIERES.FR_GENERAL}" ou "${PEBS_FILIERES.FR_PEBS}".`,
      }
    }
    return { valid: true }
  }

  // Anglophone lower cycle (Form1-Form5) — PEBS filieres autorisées
  if (ANGLOPHONE_LOWER_LEVELS.includes(level)) {
    if (filiereNormalized && filiereNormalized !== PEBS_FILIERES.EN_GENERAL && filiereNormalized !== PEBS_FILIERES.EN_PEBS) {
      return {
        valid: false,
        error: `Pour le niveau ${level}, les seules valeurs de filière autorisées sont "${PEBS_FILIERES.EN_GENERAL}" ou "${PEBS_FILIERES.EN_PEBS}".`,
      }
    }
    return { valid: true }
  }

  // Niveau technique — validation existante
  if (TECHNICAL_LEVELS.includes(level)) {
    if (!filiereNormalized) {
      return {
        valid: false,
        error: `Le niveau technique ${level} requiert une filière.`,
      }
    }
    if (TECHNICAL_FILIERES_OFFICIAL.includes(filiereNormalized)) {
      return { valid: true }
    }
    if (TECHNICAL_FILIERES_INTERNAL.includes(filiereNormalized)) {
      return {
        valid: true,
        warning: `La filière "${filiereNormalized}" est un code interne d'établissement (non officiel MINESEC). Elle est acceptée mais non standardisée.`,
      }
    }
    return {
      valid: true,
      warning: `La filière "${filiereNormalized}" n'est pas reconnue dans la liste standard. Elle sera acceptée. Filières officielles MINESEC : ${TECHNICAL_FILIERES_OFFICIAL.join(", ")}`,
    }
  }

  // Autres niveaux (primaire, maternelle, 2nd cycle, etc.) — pas de filière
  return { valid: true }
}
