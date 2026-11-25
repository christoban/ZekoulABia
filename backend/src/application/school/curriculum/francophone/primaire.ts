// ─── Curriculum primaire francophone : SIL → CM2 ────────────────────────────
// Source : MINEDUB — Curriculum officiel réformé 2019 (sous-système francophone)
//          Épreuves officielles CEP (MINEDUB 2024-2026)
// Templates : PRIMAIRE_FR, MATERNELLE_FR, COMPLEXE_SCOLAIRE (section primaire)
//
// ─── Système APC (Approche Par Compétences) ───────────────────────────────────
//   - Horaire total : 34h30/semaine (école à plein temps)
//   - Évaluation mensuelle ou trimestrielle, notes sur 10 ou 20 par discipline
//   - Pas de coefficient BAC — chaque matière a un poids dans le total APC
//
// ─── Épreuves CEP (Certificat d'Études Primaires) ────────────────────────────
//   Français      : Dictée + Questions (60 min) + Expression Écrite (60 min)
//   Anglais       : Dictée (20 min) + Reading Comprehension (40 min) + Grammar (45 min)
//   Mathématiques : Calcul Rapide (20 min) + Résolution de problèmes (90 min)
//   Sciences / EST (Éducation Scientifique et Technologique) (60 min)
//   Connaissances Générales (Histoire-Géo + Éducation Sociale) (60 min)
//   EPS (Éducation Physique et Sportive) — partie pratique (30 min)
//
// ─── Niveaux ─────────────────────────────────────────────────────────────────
//   Maternelle : Petite section / Moyenne section / Grande section
//   Primaire   : SIL (Section d'Initiation au Langage), CP, CE1, CE2, CM1, CM2

import type { CycleCurriculum } from '../types';

export const PRIMAIRE_FR_TEMPLATES = ['PRIMAIRE_FR', 'MATERNELLE_FR', 'COMPLEXE_SCOLAIRE'] as const;

// ─── Maternelle ───────────────────────────────────────────────────────────────
// Évaluation par compétences — pas de notes chiffrées classiques
// Indicateurs : Acquis (A) / En cours d'acquisition (EA) / Non acquis (NA)

const MATERNELLE_SUBJECTS = [
  { name: 'Développement du langage oral',     coefficient: 1, hoursPerWeek: 3 },
  { name: 'Pré-lecture / Initiation à la lecture', coefficient: 1, hoursPerWeek: 2 },
  { name: 'Pré-écriture / Graphisme',          coefficient: 1, hoursPerWeek: 2 },
  { name: 'Mathématiques (Logique et nombre)', coefficient: 1, hoursPerWeek: 2 },
  { name: 'Éveil scientifique et technologique', coefficient: 1, hoursPerWeek: 1 },
  { name: 'Expression corporelle / EPS',       coefficient: 1, hoursPerWeek: 2 },
  { name: 'Éducation Artistique (Dessin, Chant)', coefficient: 1, hoursPerWeek: 2 },
  { name: 'Vie sociale et Morale',             coefficient: 1, hoursPerWeek: 1 },
];

// ─── SIL (Section d'Initiation à la Lecture) ──────────────────────────────────
// Équivalent CP préparatoire — entrée dans la lecture / écriture / calcul

const SIL_SUBJECTS = [
  { name: 'Lecture / Communication orale',     coefficient: 3, hoursPerWeek: 6 },
  { name: 'Écriture',                          coefficient: 2, hoursPerWeek: 4 },
  { name: 'Calcul',                            coefficient: 3, hoursPerWeek: 5 },
  { name: "Activités d'éveil (Sciences)",      coefficient: 1, hoursPerWeek: 2 },
  { name: 'Éducation Physique et Sportive',   coefficient: 1, hoursPerWeek: 2 },
  { name: 'Dessin / Travaux manuels',          coefficient: 1, hoursPerWeek: 2 },
  { name: 'Chant / Expression Artistique',     coefficient: 1, hoursPerWeek: 1 },
];

// ─── CP et CE1 ────────────────────────────────────────────────────────────────

const CP_CE1_SUBJECTS = [
  { name: 'Français (Lecture, Grammaire, Orthographe)', coefficient: 4, hoursPerWeek: 7 },
  { name: 'Mathématiques',                   coefficient: 3, hoursPerWeek: 6 },
  { name: 'Anglais',                         coefficient: 2, hoursPerWeek: 3 },
  { name: "Éveil à l'Environnement (Sciences)", coefficient: 1, hoursPerWeek: 2 },
  { name: 'Histoire / Géographie / Éducation Civique', coefficient: 1, hoursPerWeek: 2 },
  { name: 'Éducation Physique et Sportive',  coefficient: 1, hoursPerWeek: 2 },
  { name: 'Éducation Artistique',            coefficient: 1, hoursPerWeek: 1 },
  { name: 'Travaux Manuels / Technologie',   coefficient: 1, hoursPerWeek: 1 },
];

// ─── CE2 ──────────────────────────────────────────────────────────────────────

const CE2_SUBJECTS = [
  { name: 'Français (Lecture, Grammaire, Orthographe, Rédaction)', coefficient: 4, hoursPerWeek: 7 },
  { name: 'Mathématiques',                   coefficient: 3, hoursPerWeek: 6 },
  { name: 'Anglais',                         coefficient: 2, hoursPerWeek: 3 },
  { name: 'Sciences et Technologie',         coefficient: 2, hoursPerWeek: 2 },
  { name: 'Histoire / Géographie / Éducation Civique', coefficient: 1, hoursPerWeek: 2 },
  { name: 'Éducation Physique et Sportive',  coefficient: 1, hoursPerWeek: 2 },
  { name: 'Éducation Artistique',            coefficient: 1, hoursPerWeek: 1 },
  { name: 'Travaux Manuels / Technologie',   coefficient: 1, hoursPerWeek: 1 },
];

// ─── CM1 et CM2 ───────────────────────────────────────────────────────────────
// CM2 : Examen → Certificat d'Études Primaires (CEP)

const CM1_CM2_SUBJECTS = [
  { name: 'Français (Lecture, Grammaire, Orthographe, Rédaction)', coefficient: 5, hoursPerWeek: 7 },
  { name: 'Mathématiques',                   coefficient: 4, hoursPerWeek: 6 },
  { name: 'Anglais',                         coefficient: 3, hoursPerWeek: 4 },
  { name: 'Sciences et Technologie',         coefficient: 2, hoursPerWeek: 3 },
  { name: 'Histoire / Géographie / Éducation Civique', coefficient: 2, hoursPerWeek: 3 },
  { name: 'Éducation Physique et Sportive',  coefficient: 1, hoursPerWeek: 2 },
  { name: 'Éducation Artistique',            coefficient: 1, hoursPerWeek: 1 },
  { name: 'Travaux Manuels / Technologie',   coefficient: 1, hoursPerWeek: 1 },
];

// ─── Export principal ─────────────────────────────────────────────────────────

export const primaireFR: CycleCurriculum = {
  templateCodes: [...PRIMAIRE_FR_TEMPLATES],
  label: 'Primaire francophone (Maternelle + SIL → CM2)',
  levels: [
    // Maternelle (filière MATERNELLE — évaluation compétences)
    { level: 'Petite section',  filiere: 'MATERNELLE', subjects: MATERNELLE_SUBJECTS },
    { level: 'Moyenne section', filiere: 'MATERNELLE', subjects: MATERNELLE_SUBJECTS },
    { level: 'Grande section',  filiere: 'MATERNELLE', subjects: MATERNELLE_SUBJECTS },

    // Primaire (filière FR_PRIMARY)
    { level: 'SIL', filiere: 'FR_PRIMARY', subjects: SIL_SUBJECTS   },
    { level: 'CP',  filiere: 'FR_PRIMARY', subjects: CP_CE1_SUBJECTS },
    { level: 'CE1', filiere: 'FR_PRIMARY', subjects: CP_CE1_SUBJECTS },
    { level: 'CE2', filiere: 'FR_PRIMARY', subjects: CE2_SUBJECTS    },
    { level: 'CM1', filiere: 'FR_PRIMARY', subjects: CM1_CM2_SUBJECTS },
    { level: 'CM2', filiere: 'FR_PRIMARY', subjects: CM1_CM2_SUBJECTS },
  ],
};

/** Lookup rapide : getSubjectsPrimaireFR('CM1') → SubjectEntry[] */
export function getSubjectsPrimaireFR(level: string) {
  return primaireFR.levels.find(l => l.level === level)?.subjects ?? [];
}
