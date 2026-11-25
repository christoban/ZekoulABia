// ─── Structure APC Primaire Francophone ─────────────────────────────────────
// Source : Bulletin officiel CM2 collecté sur le terrain (Garoua, année 2021-2022)
//          Ministère de l'Éducation de Base (MINEDUB) — Curriculum APC 2019
//
// ─── Fonctionnement général ───────────────────────────────────────────────────
//   L'année est découpée en 8 Unités d'Apprentissage (UA) :
//     Trimestre 1 → UA1, UA2, UA3
//     Trimestre 2 → UA4, UA5, UA6
//     Trimestre 3 → UA7, UA8
//
//   Chaque UA est évaluée sur chaque Sous-Compétence par :
//     1. Oral       (points variables)
//     2. Écrit      (points variables)
//     3. Pratique   (points variables — absent pour certaines sous-compétences)
//     4. Savoir-être (points variables — comportement / attitude)
//
//   La Cote par sous-compétence par UA est calculée sur /20 :
//     A+ Expert        : 18 – 20
//     A  Acquis        : 15 – 17
//     ECA (En cours)   : 11 – 14
//     NA Non acquis    : 0  – 10
//
//   La moyenne trimestrielle est le total des points obtenu dans le trimestre
//   converti sur /20.
//
// ─── 6 Compétences — 11 Sous-Compétences — Total 260 pts/UA ─────────────────

export type EvalComposante = {
  label: 'Oral' | 'Écrit' | 'Pratique' | 'Savoir-être';
  points: number;
};

export type SousCompetence = {
  code: string;           // ex : "1A", "1B", "6A1"
  label: string;          // libellé court affiché sur le bulletin
  totalPoints: number;    // total de la sous-compétence
  composantes: EvalComposante[];
  /**
   * Code de la sous-compétence mutuellement exclusive avec celle-ci.
   * Exemple : 6A1 (aptes) et 6A2 (inaptes) sont exclusifs — l'enseignant
   * n'évalue qu'une seule des deux par apprenant. Le bulletin n'affiche
   * que la rangée pertinente pour chaque élève.
   */
  mutuallyExclusiveWith?: string;
};

export type Competence = {
  numero: number;         // 1 à 6
  label: string;          // libellé complet (ligne d'en-tête bulletin)
  totalPoints: number;    // somme des sous-compétences
  sousCompetences: SousCompetence[];
};

export type APCCalendar = {
  trimestre: 1 | 2 | 3;
  unites: string[];       // codes UA dans ce trimestre
};

// ─── Distribution des UA par trimestre ───────────────────────────────────────

export const APC_UNITES: APCCalendar[] = [
  { trimestre: 1, unites: ['UA1', 'UA2', 'UA3'] },
  { trimestre: 2, unites: ['UA4', 'UA5', 'UA6'] },
  { trimestre: 3, unites: ['UA7', 'UA8']         },
];

export const APC_UNITE_CODES = ['UA1', 'UA2', 'UA3', 'UA4', 'UA5', 'UA6', 'UA7', 'UA8'] as const;
export type APCUniteCode = typeof APC_UNITE_CODES[number];

// ─── Les 6 Compétences ───────────────────────────────────────────────────────

export const APC_COMPETENCES: Competence[] = [

  // ── Compétence 1 : Langages (80 pts) ──────────────────────────────────────
  {
    numero: 1,
    label: 'Communiquer en Français et en Anglais et pratiquer au moins une Langue Nationale',
    totalPoints: 80,
    sousCompetences: [
      {
        code: '1A',
        label: 'Communiquer en Français',
        totalPoints: 30,
        composantes: [
          { label: 'Oral',        points: 12 },
          { label: 'Écrit',       points: 15 },
          { label: 'Savoir-être', points: 3  },
        ],
      },
      {
        code: '1B',
        label: 'Communicate in English',
        totalPoints: 30,
        composantes: [
          { label: 'Oral',        points: 12 },
          { label: 'Écrit',       points: 15 },
          { label: 'Savoir-être', points: 3  },
        ],
      },
      {
        code: '1C',
        label: 'Pratiquer une Langue Nationale',
        totalPoints: 20,
        composantes: [
          { label: 'Oral',        points: 10 },
          { label: 'Écrit',       points: 6  },
          { label: 'Pratique',    points: 2  },
          { label: 'Savoir-être', points: 2  },
        ],
      },
    ],
  },

  // ── Compétence 2 : Mathématiques, Sciences et Technologie (40 pts) ─────────
  {
    numero: 2,
    label: 'Utiliser les notions de base en Mathématique, Sciences et Technologie',
    totalPoints: 40,
    sousCompetences: [
      {
        code: '2A',
        label: 'Utiliser les notions de base en Mathématique',
        totalPoints: 40,
        composantes: [
          { label: 'Oral',        points: 8  },
          { label: 'Écrit',       points: 28 },
          { label: 'Savoir-être', points: 4  },
        ],
      },
    ],
  },

  // ── Compétence 3 : Valeurs sociales et citoyennes (40 pts) ─────────────────
  {
    numero: 3,
    label: 'Pratiquer les valeurs sociales et citoyennes',
    totalPoints: 40,
    sousCompetences: [
      {
        code: '3A',
        label: 'Pratiquer les valeurs sociales',
        totalPoints: 20,
        composantes: [
          { label: 'Oral',        points: 3 },
          { label: 'Écrit',       points: 8 },
          { label: 'Pratique',    points: 5 },
          { label: 'Savoir-être', points: 4 },
        ],
      },
      {
        code: '3B',
        label: 'Pratiquer les valeurs citoyennes',
        totalPoints: 20,
        composantes: [
          { label: 'Oral',        points: 3 },
          { label: 'Écrit',       points: 9 },
          { label: 'Pratique',    points: 5 },
          { label: 'Savoir-être', points: 3 },
        ],
      },
    ],
  },

  // ── Compétence 4 : Autonomie, créativité, entrepreneuriat (20 pts) ──────────
  {
    numero: 4,
    label: "Démontrer l'autonomie, l'esprit d'initiative, de créativité et d'entrepreneuriat",
    totalPoints: 20,
    sousCompetences: [
      {
        code: '4A',
        label: "Démontrer l'autonomie et l'esprit d'initiative",
        totalPoints: 20,
        composantes: [
          { label: 'Oral',        points: 5  },
          { label: 'Écrit',       points: 2  },
          { label: 'Pratique',    points: 11 },
          { label: 'Savoir-être', points: 2  },
        ],
      },
    ],
  },

  // ── Compétence 5 : TIC (40 pts) ─────────────────────────────────────────────
  {
    numero: 5,
    label: 'Utiliser les concepts de base et les outils des Technologies de l\'Information et de la Communication',
    totalPoints: 40,
    sousCompetences: [
      {
        code: '5A',
        label: 'Utiliser les outils des TIC',
        totalPoints: 40,
        composantes: [
          { label: 'Oral',        points: 4  },
          { label: 'Écrit',       points: 10 },
          { label: 'Pratique',    points: 20 },
          { label: 'Savoir-être', points: 6  },
        ],
      },
    ],
  },

  // ── Compétence 6 : Activités physiques, sportives et artistiques (40 pts) ───
  {
    numero: 6,
    label: 'Pratiquer les activités physiques, sportives et artistiques',
    totalPoints: 40,
    sousCompetences: [
      {
        code: '6A1',
        label: 'Pratiquer les activités physiques (apprenants aptes)',
        totalPoints: 20,
        mutuallyExclusiveWith: '6A2',
        composantes: [
          { label: 'Oral',        points: 2  },
          { label: 'Écrit',       points: 2  },
          { label: 'Pratique',    points: 12 },
          { label: 'Savoir-être', points: 4  },
        ],
      },
      {
        code: '6A2',
        label: 'Pratiquer les activités physiques (apprenants inaptes)',
        totalPoints: 20,
        mutuallyExclusiveWith: '6A1',
        composantes: [
          { label: 'Oral',        points: 3  },
          { label: 'Écrit',       points: 15 },
          { label: 'Savoir-être', points: 2  },
        ],
      },
      {
        code: '6B',
        label: 'Pratiquer les activités artistiques',
        totalPoints: 20,
        composantes: [
          { label: 'Oral',        points: 2  },
          { label: 'Écrit',       points: 4  },
          { label: 'Pratique',    points: 12 },
          { label: 'Savoir-être', points: 2  },
        ],
      },
    ],
  },
];

// ─── Total général des points par UA ─────────────────────────────────────────
// Comp1(80) + Comp2(40) + Comp3(40) + Comp4(20) + Comp5(40) + Comp6(40) = 260 pts
// Converti sur /20 : (total_obtenu / 260) × 20
export const APC_TOTAL_POINTS = APC_COMPETENCES.reduce((sum, c) => sum + c.totalPoints, 0); // 260

/** Retourne la cote APC (A+/A/ECA/NA) à partir d'une note sur 20 */
export function getAPCCote(noteSur20: number): 'A+' | 'A' | 'ECA' | 'NA' {
  if (noteSur20 >= 18) return 'A+';
  if (noteSur20 >= 15) return 'A';
  if (noteSur20 >= 11) return 'ECA';
  return 'NA';
}

/** Retourne le label complet de la cote */
export function getAPCCoteLabel(cote: 'A+' | 'A' | 'ECA' | 'NA'): string {
  const map = { 'A+': 'Expert', A: 'Acquis', ECA: 'En cours d\'acquisition', NA: 'Non Acquis' };
  return map[cote];
}

/** Retourne l'unité d'apprentissage selon le trimestre et la position dans le trimestre */
export function getUniteForTrimestre(trimestre: 1 | 2 | 3, position: 1 | 2 | 3): string | null {
  const cal = APC_UNITES.find(c => c.trimestre === trimestre);
  if (!cal) return null;
  return cal.unites[position - 1] ?? null;
}

/** Retourne le trimestre contenant une UA donnée */
export function getTrimestreForUnite(uaCode: string): 1 | 2 | 3 | null {
  const cal = APC_UNITES.find(c => c.unites.includes(uaCode));
  return cal?.trimestre ?? null;
}
