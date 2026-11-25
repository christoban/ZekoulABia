// ─── Point d'entrée du module Curriculum ZEKOULABIA ────────────────────────────
//
// Organisation :
//   francophone/
//     premier-cycle.ts       — 6e → 3e (FR_GENERAL + FR_PEBS)
//     deuxieme-cycle-bac.ts  — 2nde → Tle × toutes séries (A1-A5, ABI, C, D, E, TI, SH, AC)
//     primaire.ts            — Maternelle + SIL → CM2
//     primaire-apc.ts        — Structure APC MINEDUB 2019 : 6 Compétences / 11 Sous-compétences / UA1-UA8
//   anglophone/
//     secondary.ts           — Form 1 → Upper Sixth (EN_GENERAL + EN_PEBS)
//     primary.ts             — Nursery → Class 6
//
// Usage typique :
//   import { getCurriculumCycleLevels } from '@application/school/curriculum';
//   const levels = getCurriculumCycleLevels('LYCEE_FR');  // → CycleLevel[]

export type { SubjectEntry, CycleLevel, BacLevel, CycleCurriculum, BacCurriculum } from './types';

// ── Francophone ───────────────────────────────────────────────────────────────
export { premierCycleFR, getSubjectsFR, CYCLE1_FR_TEMPLATES }                    from './francophone/premier-cycle';
export { bacCoefficients }                                                        from './francophone/deuxieme-cycle-bac';
export type { BacEntry }                                                          from './francophone/deuxieme-cycle-bac';
export { primaireFR, getSubjectsPrimaireFR, PRIMAIRE_FR_TEMPLATES }              from './francophone/primaire';
export {
  APC_COMPETENCES, APC_UNITES, APC_UNITE_CODES, APC_TOTAL_POINTS,
  getAPCCote, getAPCCoteLabel, getUniteForTrimestre, getTrimestreForUnite,
} from './primaire-apc';
export type { Competence, SousCompetence, EvalComposante, APCCalendar, APCUniteCode } from './primaire-apc';
export { techniqueFR, TECHNIQUE_FR_TEMPLATES, professionnelFR, PROFESSIONNEL_FR_TEMPLATES } from './francophone/technique';

// ── Anglophone ────────────────────────────────────────────────────────────────
export { secondaireAN, getAslEntries, ASL_TEMPLATES }                            from './anglophone/secondary';
export { primaryEN, getSubjectsPrimaryEN, PRIMARY_EN_TEMPLATES }                 from './anglophone/primary';

// ── Lookup par templateCode ───────────────────────────────────────────────────
import { premierCycleFR, CYCLE1_FR_TEMPLATES }                          from './francophone/premier-cycle';
import { primaireFR, PRIMAIRE_FR_TEMPLATES }                            from './francophone/primaire';
import { techniqueFR, TECHNIQUE_FR_TEMPLATES,
         professionnelFR, PROFESSIONNEL_FR_TEMPLATES }                  from './francophone/technique';
import { secondaireAN, ASL_TEMPLATES }                                  from './anglophone/secondary';
import { primaryEN, PRIMARY_EN_TEMPLATES }                              from './anglophone/primary';
import type { CycleCurriculum }                                         from './types';

/**
 * Retourne le curriculum de 1er cycle / primaire / secondaire-AN pour un template donné.
 * Les données 2e cycle BAC sont communes (templateCode '__ALL__') → importer bacCoefficients directement.
 */
export function getCurriculumForTemplate(templateCode: string): CycleCurriculum | null {
  if ((CYCLE1_FR_TEMPLATES as readonly string[]).includes(templateCode))        return premierCycleFR;
  if ((PRIMAIRE_FR_TEMPLATES as readonly string[]).includes(templateCode))      return primaireFR;
  if ((TECHNIQUE_FR_TEMPLATES as readonly string[]).includes(templateCode))     return techniqueFR;
  if ((PROFESSIONNEL_FR_TEMPLATES as readonly string[]).includes(templateCode)) return professionnelFR;
  if ((ASL_TEMPLATES as readonly string[]).includes(templateCode))              return secondaireAN;
  if ((PRIMARY_EN_TEMPLATES as readonly string[]).includes(templateCode))       return primaryEN;
  return null;
}

/**
 * Retourne les matières pour un niveau+filière dans le curriculum du template donné.
 * Utile pour les lookups rapides sans passer par la BDD.
 */
export function getCurriculumSubjects(
  templateCode: string,
  level: string,
  filiere: string,
): { name: string; coefficient: number; hoursPerWeek: number }[] {
  const curriculum = getCurriculumForTemplate(templateCode);
  if (!curriculum) return [];
  return curriculum.levels.find(l => l.level === level && l.filiere === filiere)?.subjects ?? [];
}
