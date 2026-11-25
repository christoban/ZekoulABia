/**
 * DOMAIN LAYER — Schémas de regroupement des matières sur les bulletins
 *
 * Résolution exclusivement par CODE de matière normalisé (jamais par libellé).
 * Les valeurs par défaut du second cycle francophone (GROUP_1_2_3) sont indicatives,
 * modifiables par établissement et marquées « À CONFIRMER SUR LE TERRAIN ».
 */

export type BulletinGroupingScheme =
  | 'FLAT'
  | 'GROUP_1_2_3'
  | 'SCI_LIT_OTHER'
  | 'TECH_GEN_PRO_DIV'
  | 'CUSTOM';

export interface GroupDefinition {
  groupKey: string;
  groupLabel: string;
  groupOrder: number;
}

interface SchemeEntry {
  group: GroupDefinition;
  codes: readonly string[];
}

// À CONFIRMER SUR LE TERRAIN : répartition par défaut du second cycle francophone (1er/2e/3e groupe),
// fournie à titre indicatif et surchargeable sur Subject, SubjectCoefficient ou ClassSubjectOverride.
const GROUP_1_2_3_ENTRIES: readonly SchemeEntry[] = [
  {
    group: { groupKey: 'GROUPE_1', groupLabel: '1er Groupe', groupOrder: 1 },
    codes: [
      'FR', 'FRA', 'FRAN', 'FRANAIS', 'FRANAISC', 'LANGUEFR',
      'ANG', 'ENG', 'ANGLAIS', 'INTENSIV',
      'LIT', 'LITT', 'LITTRATU', 'LETTRESC', 'LATIN', 'GREC',
      'PHI', 'PHILO', 'PHILOSOP',
      'LV2', 'LV3', 'ESP', 'ESPAGNOL', 'ALL', 'ALLEMAND', 'CHI', 'CHINOIS', 'ARA', 'ARABE', 'ITA', 'ITALIEN',
      'ANALYSEF', 'CONOMIED', 'GENRESCI', 'LMENTSLA', 'OUTILSET', 'PROCESSU', 'PROJETFI', 'SOCIOLOG',
    ],
  },
  {
    group: { groupKey: 'GROUPE_2', groupLabel: '2e Groupe', groupOrder: 2 },
    codes: [
      'HG', 'HIST', 'GEO', 'HISTGEO', 'HISTOIRE', 'GOGRAPHI',
      'MATH', 'MATHS', 'MATHMATI',
      'SVT', 'SVTEEHB', 'SCI', 'SCIENCES',
      'PC', 'PCT', 'PHY', 'CHIM', 'PHYSIQUE', 'CHIMIE',
      'INFO', 'INF', 'TIC', 'CSC', 'INFORMAT', 'ALGORITH', 'PROGRAMM', 'SYSTMESD', 'RSEAUINT', 'MAINTENA',
      'DESSINET', 'FABRICAT',
      'EC', 'ECM', 'CITIZENS',
    ],
  },
  {
    group: { groupKey: 'GROUPE_3', groupLabel: '3e Groupe', groupOrder: 3 },
    codes: [
      'EPS', 'SPORT', 'SPORTAND',
      'TM', 'TRAVAILM', 'MANUALLA',
      'ESF', 'CN', 'CULTURES', 'LN', 'LANGUESN', 'ART', 'EAC', 'MUS',
    ],
  },
];

// Regroupement type Collège Le Québécois : Matières Scientifiques / Littéraires / Autres
const SCI_LIT_OTHER_ENTRIES: readonly SchemeEntry[] = [
  {
    group: { groupKey: 'SCIENTIFIQUE', groupLabel: 'Matières Scientifiques', groupOrder: 1 },
    codes: [
      'MATH', 'MATHS', 'MATHMATI',
      'PC', 'PCT', 'PHY', 'CHIM', 'PHYSIQUE', 'CHIMIE',
      'SVT', 'SVTEEHB', 'SCI', 'SCIENCES',
      'INFO', 'INF', 'TIC', 'CSC', 'INFORMAT', 'ALGORITH', 'PROGRAMM', 'SYSTMESD', 'RSEAUINT', 'MAINTENA',
      'DESSINET', 'FABRICAT',
    ],
  },
  {
    group: { groupKey: 'LITTERAIRE', groupLabel: 'Matières Littéraires', groupOrder: 2 },
    codes: [
      'FR', 'FRA', 'FRAN', 'FRANAIS', 'FRANAISC', 'LANGUEFR',
      'ANG', 'ENG', 'ANGLAIS', 'INTENSIV',
      'LIT', 'LITT', 'LITTRATU', 'LETTRESC', 'LATIN', 'GREC',
      'PHI', 'PHILO', 'PHILOSOP',
      'HG', 'HIST', 'GEO', 'HISTGEO', 'HISTOIRE', 'GOGRAPHI',
      'EC', 'ECM', 'CITIZENS',
      'LV2', 'LV3', 'ESP', 'ESPAGNOL', 'ALL', 'ALLEMAND', 'CHI', 'CHINOIS', 'ARA', 'ARABE', 'ITA', 'ITALIEN',
      'ANALYSEF', 'CONOMIED', 'GENRESCI', 'LMENTSLA', 'OUTILSET', 'PROCESSU', 'PROJETFI', 'SOCIOLOG',
    ],
  },
  {
    group: { groupKey: 'AUTRE', groupLabel: 'Autres Matières', groupOrder: 3 },
    codes: [
      'EPS', 'SPORT', 'SPORTAND',
      'TM', 'TRAVAILM', 'MANUALLA',
      'ESF', 'CN', 'CULTURES', 'LN', 'LANGUESN', 'ART', 'EAC', 'MUS',
    ],
  },
];

// Regroupement Enseignement Technique / Professionnel : Général / Professionnel / Divers
const TECH_GEN_PRO_DIV_ENTRIES: readonly SchemeEntry[] = [
  {
    group: { groupKey: 'GENERAL', groupLabel: 'Enseignement Général', groupOrder: 1 },
    codes: [
      'FR', 'FRA', 'FRAN', 'FRANAIS', 'FRANAISC', 'LANGUEFR',
      'ANG', 'ENG', 'ANGLAIS', 'ANGLAISP',
      'MATH', 'MATHS', 'MATHMATI',
      'HG', 'HIST', 'GEO', 'HISTGEO', 'HISTOIRE', 'GOGRAPHI',
      'EC', 'ECM', 'CITIZENS',
      'PC', 'PCT', 'PHY', 'CHIM', 'PHYSIQUE', 'CHIMIE', 'SCIENCES',
      'INFO', 'INF', 'TIC', 'INFORMAT',
    ],
  },
  {
    group: { groupKey: 'PROFESSIONNEL', groupLabel: 'Enseignement Professionnel', groupOrder: 2 },
    codes: [
      'DESSINTE', 'DESSINET', 'FABRICAT', 'TECHNOLO', 'PRATIQUE', 'TRAVAUXP',
      'PROJETFI', 'CALCULPR', 'CALCULMN', 'COMPTABI', 'DROITCOM', 'CONOMIEE',
      'SECRTARI', 'COUPEETC', 'MAINTENA', 'ATTITUDE', 'ATELIER', 'TECH', 'PRO',
    ],
  },
  {
    group: { groupKey: 'DIVERS', groupLabel: 'Divers', groupOrder: 3 },
    codes: [
      'EPS', 'SPORT', 'SPORTAND',
      'TM', 'TRAVAILM', 'MANUALLA',
      'ESF', 'CN', 'CULTURES', 'LN', 'LANGUESN', 'EAC', 'HYGIENE',
    ],
  },
];

function buildCodeIndex(entries: readonly SchemeEntry[]): ReadonlyMap<string, GroupDefinition> {
  const map = new Map<string, GroupDefinition>();
  for (const entry of entries) {
    for (const code of entry.codes) {
      map.set(code, entry.group);
    }
  }
  return map;
}

const SCHEME_INDEXES: Readonly<Record<'GROUP_1_2_3' | 'SCI_LIT_OTHER' | 'TECH_GEN_PRO_DIV', ReadonlyMap<string, GroupDefinition>>> = {
  GROUP_1_2_3: buildCodeIndex(GROUP_1_2_3_ENTRIES),
  SCI_LIT_OTHER: buildCodeIndex(SCI_LIT_OTHER_ENTRIES),
  TECH_GEN_PRO_DIV: buildCodeIndex(TECH_GEN_PRO_DIV_ENTRIES),
};

/**
 * Dérive le code matière canonique depuis son intitulé curriculum.
 * Évite la collision sur "DUCATION" des matières accentuées commençant par "Éducation..."
 * tout en préservant les codes historiques des autres disciplines.
 */
export function deriveSubjectCodeFromName(name: string): string {
  const folded = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  if (folded.startsWith('EDUCATION A LA CITOYENNETE')) return 'ECM';
  if (folded.startsWith('EDUCATION ARTISTIQUE')) return 'EAC';
  if (folded.startsWith('EDUCATION PHYSIQUE')) return 'EPS';
  return name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
}

export function normalizeSubjectCodeForGrouping(rawCode: string | null | undefined): string | null {
  if (!rawCode) return null;
  const normalized = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (!normalized) return null;
  return normalized.endsWith('_EN') ? normalized.slice(0, -3) : normalized;
}

export function resolveGroupBySubjectCode(
  scheme: BulletinGroupingScheme,
  rawSubjectCode: string | null | undefined,
): GroupDefinition | null {
  if (scheme === 'FLAT' || scheme === 'CUSTOM') return null;
  const code = normalizeSubjectCodeForGrouping(rawSubjectCode);
  if (!code) return null;
  return SCHEME_INDEXES[scheme].get(code) ?? null;
}
