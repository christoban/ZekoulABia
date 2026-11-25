/**
 * DOMAIN LAYER — Constantes du système éducatif camerounais (MINESEC)
 * Source : Décret 2001/041 + terrain
 * Migré depuis src/utils/coreDomainDefaults.ts
 */

export const MINESEC_DEFAULTS = {
  SEQUENCES_PAR_TRIMESTRE: 2,          // Standard MINESEC — 2 séquences × 3 trimestres = 6/an
  TRIMESTRES_PAR_AN: 3,
  NOTE_SUR: 20,
  SEUIL_PASSAGE_FR: 10,                // 10/20
  SEUIL_PASSAGE_EN_POURCENTAGE: 40,    // 40%
  TIMEZONE: 'Africa/Douala',
  CURRENCY: 'XAF',
  LOCALE_FR: 'fr-CM',
  LOCALE_EN: 'en-CM',
  SEUIL_LEGAL_PREMIER_CYCLE: 7500,     // XAF — Art. 48 MINESEC
  SEUIL_LEGAL_SECOND_CYCLE: 10000,     // XAF — Art. 48 MINESEC
} as const;

export const CALENDRIER_OFFICIEL_NATIONAL_DEFAULTS = {
  ANNEE: '2026-2027',
  ARRETE: 'Arrêté conjoint MINESEC/MINEDUB du 14 août 2026',
  RENTREE: '2026-09-07T00:00:00.000Z',
  CLOTURE: '2027-07-30T23:59:59.000Z',
  TRIMESTRES: [
    { orderIndex: 1, name: 'Trimestre 1', startDate: '2026-09-07T00:00:00.000Z', endDate: '2026-12-04T23:59:59.000Z' },
    { orderIndex: 2, name: 'Trimestre 2', startDate: '2027-01-04T00:00:00.000Z', endDate: '2027-04-02T23:59:59.000Z' },
    { orderIndex: 3, name: 'Trimestre 3', startDate: '2027-04-19T00:00:00.000Z', endDate: '2027-07-30T23:59:59.000Z' },
  ],
} as const;

export type SchoolLanguageMode = 'francophone' | 'anglophone' | 'bilingual';
export type AcademicCalendarType = 'trimester' | 'semester';
export type SchoolCycle =
  | 'maternelle'
  | 'primaire'
  | 'secondaire_1'
  | 'secondaire_2'
  | 'technique';

export const SOUS_SYSTEMES_MINESEC = [
  {
    code: 'FR_GENERAL_SEC',
    nom: 'Secondaire Général Francophone',
    gradeSystem: 'OUT_OF_20',
    periodes: 6, // 3 trimestres × 2 séquences
    coefficients: true,
    seuilPassage: 10,
  },
  {
    code: 'FR_PRIMAIRE',
    nom: 'Primaire Francophone (APC)',
    gradeSystem: 'COMPETENCES',
    periodes: 3,
    coefficients: false,
    seuilPassage: 10,
  },
  {
    code: 'FR_TECHNIQUE_SEC',
    nom: 'Technique Francophone',
    gradeSystem: 'OUT_OF_20',
    periodes: 6,
    coefficients: true,
    seuilPassage: 10,
  },
  {
    code: 'EN_GENERAL_SEC',
    nom: 'General Secondary Anglophone',
    gradeSystem: 'OUT_OF_100',
    periodes: 3,
    coefficients: false,
    seuilPassage: 40,
  },
  {
    code: 'EN_PRIMAIRE',
    nom: 'Primary Anglophone',
    gradeSystem: 'OUT_OF_100',
    periodes: 3,
    coefficients: false,
    seuilPassage: 40,
  },
  {
    code: 'EN_TECHNIQUE_SEC',
    nom: 'Technical Anglophone',
    gradeSystem: 'OUT_OF_100',
    periodes: 3,
    coefficients: false,
    seuilPassage: 40,
  },
  {
    code: 'MATERNELLE',
    nom: 'Maternelle',
    gradeSystem: 'COMPETENCES',
    periodes: 3,
    coefficients: false,
    seuilPassage: 10,
  },
] as const;

/**
 * Déduit le code sous-système selon le cycle et la langue.
 * Migré depuis resolveDefaultSubsystemCodeForSection dans coreDomainDefaults.ts
 */
export function resolverCodeSousSysteme(params: {
  cycle: string;
  langue: 'fr' | 'en';
}): string {
  const { cycle, langue } = params;
  if (cycle === 'maternelle') return 'MATERNELLE';
  if (cycle === 'primaire') return langue === 'en' ? 'EN_PRIMAIRE' : 'FR_PRIMAIRE';
  if (cycle === 'technique') return langue === 'en' ? 'EN_TECHNIQUE_SEC' : 'FR_TECHNIQUE_SEC';
  return langue === 'en' ? 'EN_GENERAL_SEC' : 'FR_GENERAL_SEC';
}

/**
 * Déduit les langues officielles depuis le mode linguistique.
 */
export function getLangagesOfficiels(mode: SchoolLanguageMode): string[] {
  if (mode === 'anglophone') return ['en'];
  if (mode === 'bilingual') return ['fr', 'en'];
  return ['fr'];
}

/**
 * Déduit le mode système depuis le mode linguistique.
 */
export function resolverMode(mode: SchoolLanguageMode): string {
  if (mode === 'anglophone') return 'simple_en';
  if (mode === 'bilingual') return 'bilingual';
  return 'simple_fr';
}
