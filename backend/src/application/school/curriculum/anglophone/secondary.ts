// ─── Curriculum secondaire anglophone : Form 1 → Upper Sixth ────────────────
// Source : GCE Board Cameroun + directives MINESEC sous-système anglophone
// Templates : GHS_EN, GSS_EN, PRIVE_EN, LYCEE_BILINGUE (section EN)
//
// GSS_EN n'a pas de 6th Form (LowerSixth / UpperSixth) — filtrer lors du seed.
// Coefficients : sur 20, note de passage = 10
// Périodes hebdomadaires (w) = heures de cours par semaine

import type { CycleCurriculum } from '../types';

export const ASL_TEMPLATES = ['GHS_EN', 'GSS_EN', 'PRIVE_EN', 'LYCEE_BILINGUE'] as const;

// ── Filière EN_GENERAL ────────────────────────────────────────────────────────
// Tableau : subjectName → { F1, F2, F3, F4, F5, L6, U6 } = { coefficient, hoursPerWeek }
// Les niveaux absents d'un sujet = matière non dispensée à ce niveau

type LevelLoad = { c: number; w: number };

const GEN: Record<string, Partial<Record<'F1'|'F2'|'F3'|'F4'|'F5'|'L6'|'U6', LevelLoad>>> = {
  'English Language':       { F1:{c:3,w:5}, F2:{c:3,w:5}, F3:{c:3,w:5}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Literature in English':  { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'French':                 { F1:{c:3,w:5}, F2:{c:3,w:5}, F3:{c:3,w:5}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Geography':              { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Economics':              {                                     F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'History':                { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Citizenship Education':  { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:5,w:5}, F5:{c:5,w:5} },
  'Commerce':               {                                                       F4:{c:5,w:5}, F5:{c:5,w:5} },
  'Biology':                { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Chemistry':              { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Mathematics':            { F1:{c:3,w:5}, F2:{c:3,w:5}, F3:{c:3,w:5}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Physics':                { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:4}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Computer Science':       { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Geology':                {                                                                  F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Food and Nutrition':     { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
  'Human Biology':          {                                                                  F4:{c:5,w:5}, F5:{c:5,w:5} },
  'Additional Mathematics': {                                                                  F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6} },
  'Logic':                  {                                               F3:{c:2,w:2}, F4:{c:5,w:5}, F5:{c:5,w:5} },
  'Philosophy':             {                                                                                             L6:{c:5,w:6}, U6:{c:5,w:6} },
};

// ── Filière EN_PEBS (Programme d'Éducation Bilingue Spécial, Form1→Form5) ─────

const PEBS: Record<string, Partial<Record<'F1'|'F2'|'F3'|'F4'|'F5', LevelLoad>>> = {
  'Français intensif (Langue)':      { F1:{c:3,w:3}, F2:{c:3,w:3}, F3:{c:3,w:3}, F4:{c:3,w:3}, F5:{c:3,w:3} },
  'Français intensif (Littérature)': { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:2,w:2}, F5:{c:2,w:2} },
  'English Language':                { F1:{c:4,w:4}, F2:{c:4,w:4}, F3:{c:4,w:4}, F4:{c:4,w:4}, F5:{c:4,w:4} },
  'Economics':                       {                                     F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
  'Éducation à la Citoyenneté et à la Morale': { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:2,w:2}, F5:{c:2,w:2} },
  'Geography':                       { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
  'History':                         { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
  'Computer Sciences':               { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:3,w:3}, F4:{c:3,w:3}, F5:{c:3,w:3} },
  'Biology':                         { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
  'Chemistry':                       { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
  'Food and Nutrition':              {                                     F3:{c:2,w:2}, F4:{c:2,w:2}, F5:{c:2,w:2} },
  'Home Economics':                  { F1:{c:2,w:2}, F2:{c:2,w:2} },
  'Mathematics':                     { F1:{c:4,w:4}, F2:{c:4,w:4}, F3:{c:4,w:4}, F4:{c:4,w:4}, F5:{c:4,w:4} },
  'Physics':                         { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
  'Geology':                         {                                                                  F4:{c:3,w:3}, F5:{c:3,w:3} },
  'Logic':                           {                                               F3:{c:2,w:2}, F4:{c:2,w:2}, F5:{c:2,w:2} },
  'Sport and Physical Education':    { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:2,w:2}, F5:{c:2,w:2} },
  'Manual Labour':                   { F1:{c:1,w:1}, F2:{c:1,w:1}, F3:{c:1,w:1}, F4:{c:1,w:1}, F5:{c:1,w:1} },
};

// ── Conversion table : short key → full level name ───────────────────────────

const SHORT_TO_FULL: Record<string, string> = {
  F1: 'Form1', F2: 'Form2', F3: 'Form3', F4: 'Form4', F5: 'Form5',
  L6: 'LowerSixth', U6: 'UpperSixth',
};

// ── Flatten to CycleLevel array ───────────────────────────────────────────────

function flattenAsl(
  data: Record<string, Partial<Record<string, LevelLoad>>>,
  filiere: string,
): { level: string; filiere: string; subjects: { name: string; coefficient: number; hoursPerWeek: number }[] }[] {
  const byLevel: Record<string, { name: string; coefficient: number; hoursPerWeek: number }[]> = {};
  for (const [subjectName, levels] of Object.entries(data)) {
    for (const [shortKey, load] of Object.entries(levels)) {
      const fullLevel = SHORT_TO_FULL[shortKey];
      if (!fullLevel || !load) continue;
      if (!byLevel[fullLevel]) byLevel[fullLevel] = [];
      byLevel[fullLevel]!.push({ name: subjectName, coefficient: load.c, hoursPerWeek: load.w });
    }
  }
  return Object.entries(byLevel).map(([level, subjects]) => ({ level, filiere, subjects }));
}

export const secondaireAN: CycleCurriculum = {
  templateCodes: [...ASL_TEMPLATES],
  label: 'Secondaire anglophone (Form 1 → Upper Sixth)',
  levels: [
    ...flattenAsl(GEN,  'EN_GENERAL'),
    ...flattenAsl(PEBS, 'EN_PEBS'),
  ],
};

/** Données brutes pour seed.ts (format BDD) */
export function getAslEntries(templateCodes: readonly string[] = ASL_TEMPLATES) {
  const entries: { templateCode: string; classLevel: string; subjectName: string; coefficient: number; weeklyPeriods: number; filiere: string }[] = [];
  for (const tc of templateCodes) {
    // EN_GENERAL
    for (const [subjectName, levels] of Object.entries(GEN)) {
      for (const [shortKey, load] of Object.entries(levels)) {
        const classLevel = SHORT_TO_FULL[shortKey];
        if (!classLevel || !load) continue;
        if (tc === 'GSS_EN' && (classLevel === 'LowerSixth' || classLevel === 'UpperSixth')) continue;
        entries.push({ templateCode: tc, classLevel, subjectName, coefficient: load.c, weeklyPeriods: load.w, filiere: 'EN_GENERAL' });
      }
    }
    // EN_PEBS
    for (const [subjectName, levels] of Object.entries(PEBS)) {
      for (const [shortKey, load] of Object.entries(levels)) {
        const classLevel = SHORT_TO_FULL[shortKey];
        if (!classLevel || !load) continue;
        if (tc === 'GSS_EN' && (classLevel === 'LowerSixth' || classLevel === 'UpperSixth')) continue;
        entries.push({ templateCode: tc, classLevel, subjectName, coefficient: load.c, weeklyPeriods: load.w, filiere: 'EN_PEBS' });
      }
    }
  }
  return entries;
}
