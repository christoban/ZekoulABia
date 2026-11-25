// ─── Curriculum technique francophone ────────────────────────────────────────
// Source : MINESEC — sous-direction de l'Enseignement Technique et Professionnel
//          CAP depuis 2013 : 2 phases (écrits nationaux + épreuves pratiques)
//          Manuels Enseignement Secondaire Technique 2022-2023 (MINESEC)
//
// Templates couverts :
//   LYCEE_TECHNIQUE_FR — CAP1→CAP4 + BT1→BT3, filières F1 (industriel) & G2 (tertiaire)
//   CETIC              — CAP1→CAP4 seulement,  filières F1 & G2
//                        (CETIF = CETIC pour filles — même programme)
//   SAR_SM             — Année1→2, filières SAR (artisanal rural) & SM (section ménagère)
//   CFM                — Année1→2, filières SAR, SM & COUTURE
//
// ─── Diplômes ─────────────────────────────────────────────────────────────────
//   CAP TI  = Certificat d'Aptitude Professionnelle Technique Industriel (4 ans)
//             Spécialités F1 : Mécanique, Électricité, Bâtiment/Génie Civil,
//             Construction Métallique, Menuiserie-Bois, Plomberie & Sanitaire…
//   CAP STT = Certificat d'Aptitude Professionnelle Sciences et Technologies Tertiaires
//             Spécialités G2 : Comptabilité-Gestion, Secrétariat-Bureautique,
//             Action Commerciale, Services Administratifs, Hôtellerie-Restauration…
//   BT      = Brevet de Technicien (3 ans après CAP, uniquement lycées techniques)
//   Attestation SAR/SM = délivrée par MINEFOP (programmes 2 ans sous tutelle MINEFOP)
//
// ─── Filières (codes utilisés dans CycleCoefficient.filiere) ─────────────────
//   F1 = Industriel · G2 = Tertiaire · SAR = Artisanal Rural · SM = Ménager
//   COUTURE = Coupe & Couture (spécifique CFM)

import type { CycleCurriculum } from '../types';

export const TECHNIQUE_FR_TEMPLATES = ['LYCEE_TECHNIQUE_FR', 'CETIC'] as const;
export const PROFESSIONNEL_FR_TEMPLATES = ['SAR_SM', 'CFM'] as const;

// ─── Filière F1 — Industriel ─────────────────────────────────────────────────
// Matières communes à tous les niveaux CAP/BT (F1)

const F1_GENERALES = [
  { name: 'Français / Communication',                   coefficient: 3, hoursPerWeek: 3 },
  { name: 'Mathématiques',                              coefficient: 3, hoursPerWeek: 3 },
  { name: 'Anglais',                                    coefficient: 2, hoursPerWeek: 2 },
  { name: 'Sciences Physiques et Chimiques',            coefficient: 2, hoursPerWeek: 2 },
  { name: 'Éducation à la Citoyenneté et à la Morale', coefficient: 1, hoursPerWeek: 1 },
  { name: 'Éducation Physique et Sportive',             coefficient: 1, hoursPerWeek: 2 },
  { name: 'Informatique',                               coefficient: 1, hoursPerWeek: 1 },
];

const F1_TECHNIQUES = [
  { name: 'Technologie (Théorie spécialité)',           coefficient: 5, hoursPerWeek: 5 },
  { name: 'Travaux Pratiques (Atelier)',                coefficient: 7, hoursPerWeek: 8 },
  { name: 'Dessin Technique',                           coefficient: 2, hoursPerWeek: 2 },
  { name: 'Attitude Professionnelle',                   coefficient: 2, hoursPerWeek: 0 }, // évaluation continue
];

const F1_ALL = [...F1_GENERALES, ...F1_TECHNIQUES];

// ─── Filière G2 — Tertiaire ──────────────────────────────────────────────────

const G2_GENERALES = [
  { name: 'Français / Communication',                   coefficient: 3, hoursPerWeek: 3 },
  { name: 'Mathématiques / Statistiques',               coefficient: 3, hoursPerWeek: 3 },
  { name: 'Anglais Professionnel',                      coefficient: 2, hoursPerWeek: 2 },
  { name: 'Droit Commercial et Fiscal',                 coefficient: 2, hoursPerWeek: 2 },
  { name: 'Éducation à la Citoyenneté et à la Morale', coefficient: 1, hoursPerWeek: 1 },
  { name: 'Éducation Physique et Sportive',             coefficient: 1, hoursPerWeek: 2 },
  { name: 'Informatique de Gestion',                    coefficient: 2, hoursPerWeek: 2 },
];

// Spécialités G2 (CAP STT officiel) : Comptabilité-Gestion (CG), Secrétariat-Bureautique (SEBU),
// Action & Communication Administrative (ACA), Action & Communication Commerciale (ACC)…
// Les matières ci-dessous sont communes à toutes les spécialités G2.
const G2_TECHNIQUES = [
  { name: 'Comptabilité et Documents Commerciaux',      coefficient: 5, hoursPerWeek: 5 },
  { name: 'Secrétariat / Bureautique',                  coefficient: 4, hoursPerWeek: 4 },
  { name: 'Économie et Organisation des Entreprises',   coefficient: 2, hoursPerWeek: 2 },
  { name: 'Attitude Professionnelle',                   coefficient: 2, hoursPerWeek: 0 }, // évaluation continue
];

const G2_ALL = [...G2_GENERALES, ...G2_TECHNIQUES];

// ─── Filière SAR — Section Artisanale Rurale ─────────────────────────────────

const SAR_SUBJECTS = [
  { name: 'Pratique Atelier (spécialité)',              coefficient: 6, hoursPerWeek: 8 },
  { name: 'Technologie de la Spécialité',               coefficient: 3, hoursPerWeek: 3 },
  { name: 'Français / Communication',                   coefficient: 2, hoursPerWeek: 2 },
  { name: 'Calcul Professionnel',                       coefficient: 2, hoursPerWeek: 2 },
  { name: 'Éducation à la Citoyenneté et à la Morale', coefficient: 1, hoursPerWeek: 1 },
  { name: 'Éducation Physique et Sportive',             coefficient: 1, hoursPerWeek: 2 },
];

// ─── Filière SM — Section Ménagère ───────────────────────────────────────────

const SM_SUBJECTS = [
  { name: 'Travaux Pratiques Ménagers',                 coefficient: 6, hoursPerWeek: 8 },
  { name: 'Technologie Ménagère (Cuisine, Couture)',    coefficient: 3, hoursPerWeek: 3 },
  { name: 'Français / Communication',                   coefficient: 2, hoursPerWeek: 2 },
  { name: 'Calcul Ménager',                             coefficient: 2, hoursPerWeek: 2 },
  { name: 'Éducation à la Citoyenneté et à la Morale', coefficient: 1, hoursPerWeek: 1 },
  { name: 'Éducation Physique et Sportive',             coefficient: 1, hoursPerWeek: 2 },
];

// ─── Filière COUTURE — CFM ───────────────────────────────────────────────────

const COUTURE_SUBJECTS = [
  { name: 'Coupe et Couture (Pratique)',                coefficient: 6, hoursPerWeek: 8 },
  { name: 'Technologie de la Couture',                  coefficient: 3, hoursPerWeek: 3 },
  { name: 'Français / Communication',                   coefficient: 2, hoursPerWeek: 2 },
  { name: 'Calcul Professionnel',                       coefficient: 2, hoursPerWeek: 2 },
  { name: 'Éducation à la Citoyenneté et à la Morale', coefficient: 1, hoursPerWeek: 1 },
  { name: 'Éducation Physique et Sportive',             coefficient: 1, hoursPerWeek: 2 },
];

// ─── Export : LYCEE_TECHNIQUE_FR + CETIC ────────────────────────────────────

export const techniqueFR: CycleCurriculum = {
  templateCodes: [...TECHNIQUE_FR_TEMPLATES],
  label: 'Technique francophone (CAP/BT — F1 Industriel & G2 Tertiaire)',
  levels: [
    // CAP (4 ans) — F1 Industriel
    { level: 'CAP1', filiere: 'F1', subjects: F1_ALL },
    { level: 'CAP2', filiere: 'F1', subjects: F1_ALL },
    { level: 'CAP3', filiere: 'F1', subjects: F1_ALL },
    { level: 'CAP4', filiere: 'F1', subjects: F1_ALL },
    // BT (3 ans) — F1 Industriel (LYCEE_TECHNIQUE_FR seulement)
    { level: 'BT1', filiere: 'F1', subjects: F1_ALL },
    { level: 'BT2', filiere: 'F1', subjects: F1_ALL },
    { level: 'BT3', filiere: 'F1', subjects: F1_ALL },
    // CAP (4 ans) — G2 Tertiaire
    { level: 'CAP1', filiere: 'G2', subjects: G2_ALL },
    { level: 'CAP2', filiere: 'G2', subjects: G2_ALL },
    { level: 'CAP3', filiere: 'G2', subjects: G2_ALL },
    { level: 'CAP4', filiere: 'G2', subjects: G2_ALL },
    // BT (3 ans) — G2 Tertiaire (LYCEE_TECHNIQUE_FR seulement)
    { level: 'BT1', filiere: 'G2', subjects: G2_ALL },
    { level: 'BT2', filiere: 'G2', subjects: G2_ALL },
    { level: 'BT3', filiere: 'G2', subjects: G2_ALL },
  ],
};

// ─── Export : SAR_SM + CFM ────────────────────────────────────────────────────

export const professionnelFR: CycleCurriculum = {
  templateCodes: [...PROFESSIONNEL_FR_TEMPLATES],
  label: 'Professionnel francophone (SAR / SM / COUTURE)',
  levels: [
    // SAR_SM
    { level: 'Année1', filiere: 'SAR',     subjects: SAR_SUBJECTS     },
    { level: 'Année2', filiere: 'SAR',     subjects: SAR_SUBJECTS     },
    { level: 'Année1', filiere: 'SM',      subjects: SM_SUBJECTS      },
    { level: 'Année2', filiere: 'SM',      subjects: SM_SUBJECTS      },
    // CFM uniquement
    { level: 'Année1', filiere: 'COUTURE', subjects: COUTURE_SUBJECTS },
    { level: 'Année2', filiere: 'COUTURE', subjects: COUTURE_SUBJECTS },
  ],
};
