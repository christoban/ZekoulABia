// ─── Curriculum primaire anglophone : Nursery → Class 6 ─────────────────────
// Source : MINEDUB — Curriculum officiel réformé 2019 (sous-système anglophone)
//          Teacher's Handbook for Cameroon Nursery and Primary School (GES/QESB)
//
// Templates : PRIMARY_EN, NURSERY_EN, PRIMARY_BILINGUAL (section EN)
//
// ─── Structure ──────────────────────────────────────────────────────────────
//   Nursery   : Nursery 1 & 2 (âges 4-6, non obligatoire, compétences APC)
//   Level I   : Class 1 & Class 2
//   Level II  : Class 3 & Class 4
//   Level III : Class 5 & Class 6  ← FSLC (First School Leaving Certificate)
//
// ─── Grille horaire (double-shift, total 33h30/semaine) ─────────────────────
//   Level I & II (Class 1-4) : English 7h30 · Français 4h30 · Maths 3h
//                               Science 3h · Social Studies 1h30 · Vocational 3h
//                               Arts 1h30 · EPS 1h30 · Nat. Languages 1h30 · ICT 3h
//   Level III (Class 5-6)   : English 6h · Français 3h · Maths 4h30 · Science 4h30
//                               Social Studies 1h30 · Vocational 3h · Arts 1h30
//                               EPS 1h30 · Nat. Languages 1h30 · ICT 3h
//
// ─── Examen FSLC (épreuves officielles) ─────────────────────────────────────
//   English Language (60 min) · French Language (60 min)
//   Problem Solving / Mathematics (60 min) · Science (60 min)
//   General Knowledge (Social Studies + Citizenship) (60 min)
//
// ─── Coefficients ────────────────────────────────────────────────────────────
//   Alignés sur les épreuves FSLC (sujets d'examen = coeff supérieur)

import type { CycleCurriculum } from '../types';

export const PRIMARY_EN_TEMPLATES = ['PRIMARY_EN', 'NURSERY_EN', 'PRIMARY_BILINGUAL'] as const;

// ─── Nursery (pré-scolaire anglophone) ────────────────────────────────────────
// Évaluation par niveaux de compétences : Outstanding / Good / Satisfactory / Needs Improvement
// Domaines identiques aux 2 sous-systèmes (Curriculum Framework 2019)

const NURSERY_SUBJECTS = [
  { name: 'Oral Language Development',         coefficient: 1, hoursPerWeek: 4 },
  { name: 'Pre-Reading and Emergent Literacy',  coefficient: 1, hoursPerWeek: 3 },
  { name: 'Pre-Writing and Graphism',           coefficient: 1, hoursPerWeek: 2 },
  { name: 'Numeracy and Logic',                 coefficient: 1, hoursPerWeek: 3 },
  { name: 'French Language Introduction',       coefficient: 1, hoursPerWeek: 2 },
  { name: 'Science and Environmental Discovery',coefficient: 1, hoursPerWeek: 2 },
  { name: 'Physical Development and Games',     coefficient: 1, hoursPerWeek: 2 },
  { name: 'Creative Arts and Music',            coefficient: 1, hoursPerWeek: 2 },
  { name: 'Social and Moral Development',       coefficient: 1, hoursPerWeek: 2 },
];

// ─── Class 1 & Class 2 — Level I (Lower Primary) ─────────────────────────────
// Horaire officiel 2019 : English 7h30 · Français 4h30 · Maths 3h · Science 3h
//   Social Studies 1h30 · Vocational Studies 3h · Arts 1h30
//   EPS 1h30 · National Languages 1h30 · ICT 3h

const CLASS1_2_SUBJECTS = [
  { name: 'English Language and Literature',    coefficient: 5, hoursPerWeek: 8 },
  { name: 'Français (French Language)',         coefficient: 3, hoursPerWeek: 5 },
  { name: 'Mathematics',                        coefficient: 4, hoursPerWeek: 3 },
  { name: 'Science and Technology',             coefficient: 2, hoursPerWeek: 3 },
  { name: 'Social Studies',                     coefficient: 2, hoursPerWeek: 2 },
  { name: 'Vocational Studies',                 coefficient: 1, hoursPerWeek: 3 },
  { name: 'Creative Arts',                      coefficient: 1, hoursPerWeek: 2 },
  { name: 'Physical Education and Sports',      coefficient: 1, hoursPerWeek: 2 },
  { name: 'National Languages and Cultures',    coefficient: 1, hoursPerWeek: 2 },
  { name: 'Information and Communication Technologies', coefficient: 1, hoursPerWeek: 3 },
];

// ─── Class 3 & Class 4 — Level II (Middle Primary) ───────────────────────────
// Même grille horaire que Level I (programme s'approfondissant)

const CLASS3_4_SUBJECTS = [
  { name: 'English Language and Literature',    coefficient: 5, hoursPerWeek: 8 },
  { name: 'Français (French Language)',         coefficient: 3, hoursPerWeek: 5 },
  { name: 'Mathematics',                        coefficient: 4, hoursPerWeek: 3 },
  { name: 'Science and Technology',             coefficient: 3, hoursPerWeek: 3 },
  { name: 'Social Studies',                     coefficient: 2, hoursPerWeek: 2 },
  { name: 'Vocational Studies',                 coefficient: 1, hoursPerWeek: 3 },
  { name: 'Creative Arts',                      coefficient: 1, hoursPerWeek: 2 },
  { name: 'Physical Education and Sports',      coefficient: 1, hoursPerWeek: 2 },
  { name: 'National Languages and Cultures',    coefficient: 1, hoursPerWeek: 2 },
  { name: 'Information and Communication Technologies', coefficient: 1, hoursPerWeek: 3 },
];

// ─── Class 5 & Class 6 — Level III (Upper Primary — FSLC) ────────────────────
// Horaire officiel 2019 : English 6h · Français 3h · Maths 4h30 · Science 4h30
//   Social Studies 1h30 · Vocational Studies 3h · Arts 1h30
//   EPS 1h30 · National Languages 1h30 · ICT 3h

const CLASS5_6_SUBJECTS = [
  { name: 'English Language and Literature',    coefficient: 5, hoursPerWeek: 6 },
  { name: 'Français (French Language)',         coefficient: 3, hoursPerWeek: 3 },
  { name: 'Mathematics',                        coefficient: 5, hoursPerWeek: 5 },
  { name: 'Science and Technology',             coefficient: 4, hoursPerWeek: 5 },
  { name: 'Social Studies',                     coefficient: 3, hoursPerWeek: 2 },
  { name: 'Vocational Studies',                 coefficient: 2, hoursPerWeek: 3 },
  { name: 'Creative Arts',                      coefficient: 1, hoursPerWeek: 2 },
  { name: 'Physical Education and Sports',      coefficient: 1, hoursPerWeek: 2 },
  { name: 'National Languages and Cultures',    coefficient: 1, hoursPerWeek: 2 },
  { name: 'Information and Communication Technologies', coefficient: 2, hoursPerWeek: 3 },
];

// ─── Export principal ─────────────────────────────────────────────────────────

export const primaryEN: CycleCurriculum = {
  templateCodes: [...PRIMARY_EN_TEMPLATES],
  label: 'Primary anglophone (Nursery → Class 6)',
  levels: [
    // Nursery (pré-scolaire, évaluation compétences)
    { level: 'Nursery 1', filiere: 'EN_NURSERY', subjects: NURSERY_SUBJECTS },
    { level: 'Nursery 2', filiere: 'EN_NURSERY', subjects: NURSERY_SUBJECTS },
    // Level I — Lower Primary
    { level: 'Class 1', filiere: 'EN_PRIMARY', subjects: CLASS1_2_SUBJECTS },
    { level: 'Class 2', filiere: 'EN_PRIMARY', subjects: CLASS1_2_SUBJECTS },
    // Level II — Middle Primary
    { level: 'Class 3', filiere: 'EN_PRIMARY', subjects: CLASS3_4_SUBJECTS },
    { level: 'Class 4', filiere: 'EN_PRIMARY', subjects: CLASS3_4_SUBJECTS },
    // Level III — Upper Primary (FSLC)
    { level: 'Class 5', filiere: 'EN_PRIMARY', subjects: CLASS5_6_SUBJECTS },
    { level: 'Class 6', filiere: 'EN_PRIMARY', subjects: CLASS5_6_SUBJECTS },
  ],
};

/** Lookup rapide : getSubjectsPrimaryEN('Class 5') → SubjectEntry[] */
export function getSubjectsPrimaryEN(level: string) {
  return primaryEN.levels.find(l => l.level === level)?.subjects ?? [];
}
