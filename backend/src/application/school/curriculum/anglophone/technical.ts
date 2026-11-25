// ─── Curriculum technique anglophone ──────────────────────────────────────────
// Source : MINESEC (site officiel version anglaise), étude universitaire sur la
//          division de Fako (10 GTC publics recensés, >6000 élèves), Wikipedia,
//          guide international Alberta.ca — confirmé le 13/07/2026.
//
// Templates couverts :
//   GTC_GTHS_EN — Form1→Form4 (CAP) + LowerSixth/UpperSixth (Bac Technique),
//                 filières STT (Tertiary Sciences & Technology) & IND (Industrial
//                 Sciences & Technology)
//   GTC_EN      — Form1→Form4 seulement, mêmes filières STT & IND
//                 (GGTC = GTC pour filles — même programme, voir School.admissionType)
//
// ─── ⚠️ AVERTISSEMENT — DÉTAIL DES MATIÈRES NON CONFIRMÉ AVEC CERTITUDE ─────
// Contrairement à francophone/technique.ts (dont les intitulés F1/G2 proviennent
// directement des manuels MINESEC 2022-2023), le détail précis matière-par-matière
// des filières STT/IND n'a pas pu être confirmé avec certitude à ce stade — seules
// l'EXISTENCE de ces deux filières et leur nom officiel sont confirmées (source
// MINESEC anglais). La structure ci-dessous est une adaptation RAISONNABLE du
// contenu F1/G2 francophone déjà confirmé (même logique pédagogique nationale,
// mêmes examens CAP/BT), PAS une transcription d'un document officiel anglophone
// équivalent. À REVOIR dès qu'une source anglophone officielle équivalente au
// "Manuel Enseignement Secondaire Technique" francophone est identifiée — ne
// jamais présenter cette liste comme un fait établi entre-temps.
//
// ─── Diplômes ─────────────────────────────────────────────────────────────────
//   CAP (TVE Examination — Intermediate Level) : fin Form4, 4 ans (miroir CAP FR)
//   Probatoire Technique (mi-parcours 2nd cycle) puis Bac Technique
//   (TVE Examination — Advanced Level) : fin UpperSixth, miroir BT francophone
//
// ─── Filières (codes utilisés dans AnglophoneSubjectLoad.filiere) ────────────
//   STT = Tertiary Sciences and Technology (≈ G2 francophone, tertiaire)
//   IND = Industrial Sciences and Technology (≈ F1 francophone, industriel)

import type { CycleCurriculum } from '../types';

export const TECHNICAL_EN_TEMPLATES = ['GTC_GTHS_EN', 'GTC_EN'] as const;

// ─── Filière IND — Industrial Sciences and Technology ────────────────────────
// Adaptation raisonnable de F1_ALL (francophone/technique.ts) — voir avertissement ci-dessus.

const IND_GENERALES = [
  { name: 'English Language / Communication', coefficient: 3, hoursPerWeek: 3 },
  { name: 'Mathematics',                      coefficient: 3, hoursPerWeek: 3 },
  { name: 'French',                           coefficient: 2, hoursPerWeek: 2 },
  { name: 'Applied Physical Sciences',        coefficient: 2, hoursPerWeek: 2 },
  { name: 'Citizenship Education',            coefficient: 1, hoursPerWeek: 1 },
  { name: 'Physical & Health Education',      coefficient: 1, hoursPerWeek: 2 },
  { name: 'Computer Science',                 coefficient: 1, hoursPerWeek: 1 },
];

const IND_TECHNIQUES = [
  { name: 'Technology (Specialty Theory)',    coefficient: 5, hoursPerWeek: 5 },
  { name: 'Practical Work (Workshop)',        coefficient: 7, hoursPerWeek: 8 },
  { name: 'Technical Drawing',                coefficient: 2, hoursPerWeek: 2 },
  { name: 'Professional Attitude',            coefficient: 2, hoursPerWeek: 0 }, // évaluation continue
];

const IND_ALL = [...IND_GENERALES, ...IND_TECHNIQUES];

// ─── Filière STT — Tertiary Sciences and Technology ──────────────────────────
// Adaptation raisonnable de G2_ALL (francophone/technique.ts) — voir avertissement ci-dessus.

const STT_GENERALES = [
  { name: 'English Language / Communication', coefficient: 3, hoursPerWeek: 3 },
  { name: 'Mathematics / Statistics',         coefficient: 3, hoursPerWeek: 3 },
  { name: 'Professional French',              coefficient: 2, hoursPerWeek: 2 },
  { name: 'Commercial & Business Law',        coefficient: 2, hoursPerWeek: 2 },
  { name: 'Citizenship Education',            coefficient: 1, hoursPerWeek: 1 },
  { name: 'Physical & Health Education',      coefficient: 1, hoursPerWeek: 2 },
  { name: 'Office/Business Computing',        coefficient: 2, hoursPerWeek: 2 },
];

const STT_TECHNIQUES = [
  { name: 'Accounting & Commercial Documents', coefficient: 5, hoursPerWeek: 5 },
  { name: 'Secretarial Duties / Office Practice', coefficient: 4, hoursPerWeek: 4 },
  { name: 'Business Economics & Organisation', coefficient: 2, hoursPerWeek: 2 },
  { name: 'Professional Attitude',            coefficient: 2, hoursPerWeek: 0 }, // évaluation continue
];

const STT_ALL = [...STT_GENERALES, ...STT_TECHNIQUES];

// ─── Export : GTC_GTHS_EN + GTC_EN ────────────────────────────────────────────

export const techniqueAN: CycleCurriculum = {
  templateCodes: [...TECHNICAL_EN_TEMPLATES],
  label: 'Technique anglophone (CAP/Bac Technique — IND Industrial & STT Tertiary) — détail matières APPROXIMATIF, voir avertissement en tête de fichier',
  levels: [
    // CAP (4 ans) — IND Industrial
    { level: 'Form1', filiere: 'IND', subjects: IND_ALL },
    { level: 'Form2', filiere: 'IND', subjects: IND_ALL },
    { level: 'Form3', filiere: 'IND', subjects: IND_ALL },
    { level: 'Form4', filiere: 'IND', subjects: IND_ALL },
    // Bac Technique (2 ans) — IND Industrial (GTC_GTHS_EN seulement)
    { level: 'LowerSixth', filiere: 'IND', subjects: IND_ALL },
    { level: 'UpperSixth', filiere: 'IND', subjects: IND_ALL },
    // CAP (4 ans) — STT Tertiary
    { level: 'Form1', filiere: 'STT', subjects: STT_ALL },
    { level: 'Form2', filiere: 'STT', subjects: STT_ALL },
    { level: 'Form3', filiere: 'STT', subjects: STT_ALL },
    { level: 'Form4', filiere: 'STT', subjects: STT_ALL },
    // Bac Technique (2 ans) — STT Tertiary (GTC_GTHS_EN seulement)
    { level: 'LowerSixth', filiere: 'STT', subjects: STT_ALL },
    { level: 'UpperSixth', filiere: 'STT', subjects: STT_ALL },
  ],
};

/** Données brutes pour seed.ts (format BDD, table AnglophoneSubjectLoad) */
export function getTechniqueAnEntries(templateCodes: readonly string[] = TECHNICAL_EN_TEMPLATES) {
  const entries: { templateCode: string; classLevel: string; subjectName: string; coefficient: number; weeklyPeriods: number; filiere: string }[] = [];
  for (const tc of templateCodes) {
    for (const lvl of techniqueAN.levels) {
      // GTC_EN n'a pas de 2nd cycle (LowerSixth/UpperSixth) — filtrer, miroir GSS_EN
      if (tc === 'GTC_EN' && (lvl.level === 'LowerSixth' || lvl.level === 'UpperSixth')) continue;
      for (const s of lvl.subjects) {
        entries.push({ templateCode: tc, classLevel: lvl.level, subjectName: s.name, coefficient: s.coefficient, weeklyPeriods: s.hoursPerWeek, filiere: lvl.filiere });
      }
    }
  }
  return entries;
}
