// ─── 1er cycle francophone : 6e → 3e ────────────────────────────────────────
// Source : Programme officiel MINESEC Cameroun
// Templates : LYCEE_FR, CES_FR, PRIVE_FR, LYCEE_BILINGUE
import type { CycleCurriculum } from '../types';

export const CYCLE1_FR_TEMPLATES = ['LYCEE_FR', 'CES_FR', 'PRIVE_FR', 'LYCEE_BILINGUE', 'COMPLEXE_SCOLAIRE'] as const;

// ── Filière FR_GENERAL ────────────────────────────────────────────────────────

/** Matières 6e et 5e — programme général */
const GEN_65 = [
  { name: 'Anglais',                                      coefficient: 3, hoursPerWeek: 3 },
  { name: 'Français',                                     coefficient: 6, hoursPerWeek: 6 },
  { name: 'Lettres classiques (Latin/Grec)',              coefficient: 2, hoursPerWeek: 2 },
  { name: 'Éducation à la Citoyenneté et à la Morale',   coefficient: 2, hoursPerWeek: 2 },
  { name: 'Histoire',                                     coefficient: 2, hoursPerWeek: 2 },
  { name: 'Géographie',                                   coefficient: 2, hoursPerWeek: 2 },
  { name: 'Informatique',                                 coefficient: 2, hoursPerWeek: 2 },
  { name: 'Mathématiques',                                coefficient: 4, hoursPerWeek: 4 },
  { name: 'Sciences',                                     coefficient: 2, hoursPerWeek: 2 },
  { name: 'Éducation Artistique et Culturelle',           coefficient: 1, hoursPerWeek: 1 },
  { name: 'Cultures Nationales',                          coefficient: 1, hoursPerWeek: 1 },
  { name: 'Langues Nationales',                           coefficient: 1, hoursPerWeek: 1 },
  { name: 'EPS',                                          coefficient: 2, hoursPerWeek: 2 },
  { name: 'Travail Manuel',                               coefficient: 1, hoursPerWeek: 2 },
];

/** Matières 4e et 3e — programme général */
const GEN_43 = [
  { name: 'Anglais',                                      coefficient: 3, hoursPerWeek: 3 },
  { name: 'Français',                                     coefficient: 4, hoursPerWeek: 4 },
  { name: 'LV2',                                          coefficient: 2, hoursPerWeek: 2 },
  { name: 'Lettres classiques (Latin/Grec)',              coefficient: 1, hoursPerWeek: 1 },
  { name: 'Éducation à la Citoyenneté et à la Morale',   coefficient: 2, hoursPerWeek: 2 },
  { name: 'Histoire',                                     coefficient: 2, hoursPerWeek: 2 },
  { name: 'Géographie',                                   coefficient: 2, hoursPerWeek: 2 },
  { name: 'Informatique',                                 coefficient: 2, hoursPerWeek: 2 },
  { name: 'Mathématiques',                                coefficient: 4, hoursPerWeek: 4 },
  { name: 'Physique-Chimie-Technologie',                  coefficient: 2, hoursPerWeek: 2 },
  { name: 'SVTEEHB',                                      coefficient: 2, hoursPerWeek: 2 },
  { name: 'Éducation Artistique et Culturelle',           coefficient: 1, hoursPerWeek: 1 },
  { name: 'Cultures Nationales',                          coefficient: 1, hoursPerWeek: 1 },
  { name: 'Langues Nationales',                           coefficient: 1, hoursPerWeek: 1 },
  { name: 'EPS',                                          coefficient: 2, hoursPerWeek: 2 },
  { name: 'Travail Manuel',                               coefficient: 1, hoursPerWeek: 2 },
];

// ── Filière FR_PEBS (Programme d'Éducation Bilingue Spécial) ─────────────────

/** Matières 6e et 5e — PEBS */
const PEBS_65 = [
  { name: 'Intensive English',                            coefficient: 5, hoursPerWeek: 5 },
  { name: 'Français',                                     coefficient: 4, hoursPerWeek: 4 },
  { name: 'Lettres classiques (Latin/Grec)',              coefficient: 2, hoursPerWeek: 2 },
  { name: 'Citizenship Education',                        coefficient: 2, hoursPerWeek: 2 },
  { name: 'Géographie',                                   coefficient: 2, hoursPerWeek: 2 },
  { name: 'Histoire',                                     coefficient: 2, hoursPerWeek: 2 },
  { name: 'Informatique',                                 coefficient: 2, hoursPerWeek: 2 },
  { name: 'Mathématiques',                                coefficient: 4, hoursPerWeek: 4 },
  { name: 'Sciences',                                     coefficient: 2, hoursPerWeek: 2 },
  { name: 'Éducation Artistique et Culturelle',           coefficient: 1, hoursPerWeek: 1 },
  { name: 'Cultures Nationales',                          coefficient: 1, hoursPerWeek: 1 },
  { name: 'Langues Nationales',                           coefficient: 1, hoursPerWeek: 1 },
  { name: 'Sport and Physical Education',                 coefficient: 2, hoursPerWeek: 2 },
  { name: 'Manual Labour',                               coefficient: 1, hoursPerWeek: 2 },
];

/** Matières 4e et 3e — PEBS */
const PEBS_43 = [
  { name: 'Intensive English',                            coefficient: 5, hoursPerWeek: 5 },
  { name: 'Français',                                     coefficient: 4, hoursPerWeek: 4 },
  { name: 'LV2',                                          coefficient: 2, hoursPerWeek: 2 },
  { name: 'Lettres classiques (Latin/Grec)',              coefficient: 1, hoursPerWeek: 1 },
  { name: 'Citizenship Education',                        coefficient: 2, hoursPerWeek: 2 },
  { name: 'Géographie',                                   coefficient: 1, hoursPerWeek: 1 },
  { name: 'Histoire',                                     coefficient: 1, hoursPerWeek: 1 },
  { name: 'Informatique',                                 coefficient: 2, hoursPerWeek: 2 },
  { name: 'Mathématiques',                                coefficient: 4, hoursPerWeek: 4 },
  { name: 'Physique-Chimie-Technologie',                  coefficient: 2, hoursPerWeek: 2 },
  { name: 'SVTEEHB',                                      coefficient: 2, hoursPerWeek: 2 },
  { name: 'Éducation Artistique et Culturelle',           coefficient: 1, hoursPerWeek: 1 },
  { name: 'Cultures Nationales',                          coefficient: 1, hoursPerWeek: 1 },
  { name: 'Langues Nationales',                           coefficient: 1, hoursPerWeek: 1 },
  { name: 'Sport and Physical Education',                 coefficient: 2, hoursPerWeek: 2 },
  { name: 'Manual Labour',                               coefficient: 1, hoursPerWeek: 2 },
];

// ─── Export principal ─────────────────────────────────────────────────────────

export const premierCycleFR: CycleCurriculum = {
  templateCodes: [...CYCLE1_FR_TEMPLATES],
  label: 'Premier cycle francophone (6e → 3e)',
  levels: [
    { level: '6e', filiere: 'FR_GENERAL', subjects: GEN_65 },
    { level: '5e', filiere: 'FR_GENERAL', subjects: GEN_65 },
    { level: '4e', filiere: 'FR_GENERAL', subjects: GEN_43 },
    { level: '3e', filiere: 'FR_GENERAL', subjects: GEN_43 },
    { level: '6e', filiere: 'FR_PEBS',    subjects: PEBS_65 },
    { level: '5e', filiere: 'FR_PEBS',    subjects: PEBS_65 },
    { level: '4e', filiere: 'FR_PEBS',    subjects: PEBS_43 },
    { level: '3e', filiere: 'FR_PEBS',    subjects: PEBS_43 },
  ],
};

/** Lookup rapide : getSubjectsFR('6e', 'FR_GENERAL') → SubjectEntry[] */
export function getSubjectsFR(level: string, filiere: string) {
  return premierCycleFR.levels.find(l => l.level === level && l.filiere === filiere)?.subjects ?? [];
}
