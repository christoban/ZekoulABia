// ─── Types partagés pour les curricula de référence ZEKOULABIA ────────────────
// Chaque établissement est initialisé à partir de ces données selon son template.

/** Une matière avec son coefficient et ses heures hebdomadaires */
export type SubjectEntry = {
  name: string;
  coefficient: number;
  hoursPerWeek: number;
  groupe?: number; // 1 = principal, 2 = transversal (used for BAC)
};

/** Matières d'un niveau du 1er cycle ou du primaire, pour une filière donnée */
export type CycleLevel = {
  level: string;    // ex: '6e', 'CP', 'Form1', 'Class1'
  filiere: string;  // ex: 'FR_GENERAL', 'FR_PEBS', 'EN_GENERAL', 'EN_PEBS'
  subjects: SubjectEntry[];
};

/** Matières d'un niveau du 2e cycle, pour une série donnée */
export type BacLevel = {
  serie: string;   // ex: 'A1', 'C', 'D'
  niveau: 'SECONDE' | 'PREMIERE' | 'TERMINALE';
  subjects: SubjectEntry[];
};

/** Données de référence pour un groupe de templates (1er cycle ou primaire) */
export type CycleCurriculum = {
  templateCodes: string[];
  label: string;
  levels: CycleLevel[];
};

/** Données de référence 2e cycle BAC (toutes séries) */
export type BacCurriculum = {
  templateCode: string; // '__ALL__' pour les données officielles MINESEC communes
  source: string;
  entries: BacLevel[];
};

/** Données de référence pour les écoles anglophones (Form1→UpperSixth) */
export type AnglophonicCurriculum = {
  templateCodes: string[];
  label: string;
  levels: CycleLevel[];
};
