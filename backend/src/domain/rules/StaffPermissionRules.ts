/**
 * DOMAIN LAYER — Règles de permissions STAFF
 * Mapping officiel : titre terrain → permissions système
 * Source : Spécification ZekoulABia + terrain Cameroun
 *
 * ─── Règle de nommage ────────────────────────────────────────────────────────
 *   Titres FR    → utilisés dans les templates francophones 
 *   Titres EN    → utilisés dans les templates anglophones
 *   Titres MIXTE → utilisés dans les templates bilingues (les deux sections)
 */

import type { StaffPermissionType, TemplateMeta } from '@domain/types/enums';

// ─── Mapping titre → permissions ──────────────────────────────────────────────

export const PERMISSIONS_PAR_TITRE: Record<string, StaffPermissionType[]> = {

  // ── Secondaire francophone ──────────────────────────────────────────────────
  'Censeur': [
    'MANAGE_TIMETABLE', 'VALIDATE_GRADES', 'MANAGE_EXAMS',
    'SUPERVISE_TEACHERS', 'MANAGE_ATTENDANCE', 'MANAGE_CLASS_COUNCIL',
    'MANAGE_CATCHUP_REQUESTS', 'GENERATE_REPORTS',
    'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS',
    'MANAGE_ANONYMAT',
    'MANAGE_CLASSES',
    'MANAGE_STUDENT_ASSIGNMENTS',
    'MANAGE_TEACHING_ASSIGNMENTS',
  ],
  'Surveillant Général': [
    'MANAGE_ATTENDANCE', 'MANAGE_DISCIPLINE', 'MANAGE_INCIDENTS',
  ],
  'Intendant': [
    'MANAGE_FINANCE', 'VALIDATE_PAYMENTS', 'GENERATE_REPORTS', 'MANAGE_ENROLLMENT',
  ],
  'Économe': [
    'MANAGE_FINANCE', 'VALIDATE_PAYMENTS', 'GENERATE_REPORTS', 'MANAGE_ENROLLMENT',
  ],
  'Animateur Pédagogique': [
    'VIEW_DEPARTMENT_GRADES', 'SUPERVISE_DEPARTMENT_TEACHERS',
    'VALIDATE_DEPARTMENT_TIMETABLE', 'GENERATE_DEPARTMENT_REPORTS',
    'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS',
    'GENERATE_PEDAGOGICAL_REPORTS', 'MANAGE_CE_REPORTS', 'MANAGE_PEDAGOGICAL_BRIEF',
  ],
  'Documentaliste': ['MANAGE_LIBRARY'],
  "Conseiller d'Orientation": ['MANAGE_ORIENTATION'],
  'Comptable-Matières': ['MANAGE_PATRIMOINE', 'MANAGE_DEGRADATIONS'],
  'Secrétaire': ['MANAGE_ENROLLMENT', 'GENERATE_REPORTS'],

  // ── Technique francophone (en plus du pool secondaire FR) ──────────────────
  'Chef des Travaux': [
    'MANAGE_ATELIERS', 'MANAGE_PRACTICAL_GRADES', 'MANAGE_INTERNSHIPS',
    'MANAGE_STAGE_CONVENTIONS', 'MANAGE_WORKSHOP_STOCK', 'GENERATE_REPORTS',
  ],

  // ── Primaire francophone ────────────────────────────────────────────────────
  'Directeur Adjoint': [
    'MANAGE_TIMETABLE', 'VALIDATE_GRADES', 'MANAGE_ATTENDANCE',
    'SUPERVISE_TEACHERS', 'GENERATE_REPORTS', 'SUPERVISE_LESSON_PLANS',
    'MANAGE_CLASS_COUNCIL',
    'MANAGE_CLASSES',
    'MANAGE_STUDENT_ASSIGNMENTS',
    'MANAGE_TEACHING_ASSIGNMENTS',
  ],
  'Conseiller Pédagogique': [
    'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS',
    'GENERATE_PEDAGOGICAL_REPORTS', 'MANAGE_PEDAGOGICAL_BRIEF',
  ],

  // ── Secondaire anglophone ───────────────────────────────────────────────────
  'Vice-Principal': [
    'MANAGE_TIMETABLE', 'VALIDATE_GRADES', 'MANAGE_EXAMS',
    'SUPERVISE_TEACHERS', 'MANAGE_ATTENDANCE', 'MANAGE_CLASS_COUNCIL',
    'MANAGE_CATCHUP_REQUESTS', 'GENERATE_REPORTS',
    'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS',
    'MANAGE_ANONYMAT',
    'MANAGE_CLASSES',
    'MANAGE_STUDENT_ASSIGNMENTS',
    'MANAGE_TEACHING_ASSIGNMENTS',
  ],
  'Discipline Master': [
    'MANAGE_ATTENDANCE', 'MANAGE_DISCIPLINE', 'MANAGE_INCIDENTS',
  ],
  'Bursar': [
    'MANAGE_FINANCE', 'VALIDATE_PAYMENTS', 'GENERATE_REPORTS', 'MANAGE_ENROLLMENT',
  ],
  'HOD': [
    'VIEW_DEPARTMENT_GRADES', 'SUPERVISE_DEPARTMENT_TEACHERS',
    'VALIDATE_DEPARTMENT_TIMETABLE', 'GENERATE_DEPARTMENT_REPORTS',
    'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS',
    'GENERATE_PEDAGOGICAL_REPORTS', 'MANAGE_CE_REPORTS', 'MANAGE_PEDAGOGICAL_BRIEF',
  ],
  'Librarian': ['MANAGE_LIBRARY'],
  'Guidance Counsellor': ['MANAGE_ORIENTATION'],
  'School Secretary': ['MANAGE_ENROLLMENT', 'GENERATE_REPORTS'],

  // ── Primaire anglophone ─────────────────────────────────────────────────────
  'Deputy Head Teacher': [
    'MANAGE_TIMETABLE', 'VALIDATE_GRADES', 'MANAGE_ATTENDANCE',
    'SUPERVISE_TEACHERS', 'GENERATE_REPORTS', 'SUPERVISE_LESSON_PLANS',
    'MANAGE_CLASS_COUNCIL',
    'MANAGE_CLASSES',
    'MANAGE_STUDENT_ASSIGNMENTS',
    'MANAGE_TEACHING_ASSIGNMENTS',
  ],
  // Comble le gap EN_PRIMARY (aucun titre ne portait MANAGE_PEDAGOGICAL_BRIEF ni
  // MANAGE_ORIENTATION avant ceci — "Signaler au conseiller" n'avait jamais de destinataire
  // possible pour ce template) — équivalent du "Conseiller Pédagogique" francophone primaire.
  // Nom confirmé par l'utilisateur, pas vérifié contre un référentiel MINESEC officiel.
  'Pedagogic Coordinator': [
    'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS',
    'GENERATE_PEDAGOGICAL_REPORTS', 'MANAGE_PEDAGOGICAL_BRIEF',
  ],
};

// ─── Titres par type d'établissement ─────────────────────────────────────────

export type StaffTitleDef = {
  key: string;
  label: string;
  permissions: StaffPermissionType[];
};

const FR_SECONDARY_TITLES: StaffTitleDef[] = [
  { key: 'Secrétaire',                 label: 'Secrétaire',                         permissions: PERMISSIONS_PAR_TITRE['Secrétaire'] },
  { key: 'Censeur',                 label: 'Censeur',                           permissions: PERMISSIONS_PAR_TITRE['Censeur'] },
  { key: 'Surveillant Général',     label: 'Surveillant Général',               permissions: PERMISSIONS_PAR_TITRE['Surveillant Général'] },
  { key: 'Intendant',               label: 'Intendant',                         permissions: PERMISSIONS_PAR_TITRE['Intendant'] },
  { key: 'Animateur Pédagogique',   label: 'Animateur Pédagogique',             permissions: PERMISSIONS_PAR_TITRE['Animateur Pédagogique'] },
  { key: 'Documentaliste',          label: 'Documentaliste / Bibliothécaire',   permissions: PERMISSIONS_PAR_TITRE['Documentaliste'] },
  { key: "Conseiller d'Orientation",label: "Conseiller d'Orientation",          permissions: PERMISSIONS_PAR_TITRE["Conseiller d'Orientation"] },
  { key: 'Comptable-Matières',      label: 'Comptable-Matières',                permissions: PERMISSIONS_PAR_TITRE['Comptable-Matières'] },
];

const FR_TECHNIQUE_TITLES: StaffTitleDef[] = [
  { key: 'Secrétaire',                 label: 'Secrétaire',                         permissions: PERMISSIONS_PAR_TITRE['Secrétaire'] },
  { key: 'Censeur',                 label: 'Censeur',                           permissions: PERMISSIONS_PAR_TITRE['Censeur'] },
  { key: 'Chef des Travaux',        label: 'Chef des Travaux',                  permissions: PERMISSIONS_PAR_TITRE['Chef des Travaux'] },
  { key: 'Surveillant Général',     label: 'Surveillant Général',               permissions: PERMISSIONS_PAR_TITRE['Surveillant Général'] },
  { key: 'Intendant',               label: 'Intendant',                         permissions: PERMISSIONS_PAR_TITRE['Intendant'] },
  { key: 'Animateur Pédagogique',   label: 'Animateur Pédagogique',             permissions: PERMISSIONS_PAR_TITRE['Animateur Pédagogique'] },
  { key: 'Documentaliste',          label: 'Documentaliste / Bibliothécaire',   permissions: PERMISSIONS_PAR_TITRE['Documentaliste'] },
  { key: 'Comptable-Matières',      label: 'Comptable-Matières',                permissions: PERMISSIONS_PAR_TITRE['Comptable-Matières'] },
];

const FR_PRIMAIRE_TITLES: StaffTitleDef[] = [
  { key: 'Secrétaire',                 label: 'Secrétaire',                         permissions: PERMISSIONS_PAR_TITRE['Secrétaire'] },
  { key: 'Directeur Adjoint',       label: 'Directeur(trice) Adjoint(e)',       permissions: PERMISSIONS_PAR_TITRE['Directeur Adjoint'] },
  { key: 'Économe',                 label: 'Économe / Intendant',               permissions: PERMISSIONS_PAR_TITRE['Économe'] },
  { key: 'Conseiller Pédagogique',  label: 'Conseiller(ère) Pédagogique',       permissions: PERMISSIONS_PAR_TITRE['Conseiller Pédagogique'] },
  { key: 'Documentaliste',          label: 'Documentaliste / Bibliothécaire',   permissions: PERMISSIONS_PAR_TITRE['Documentaliste'] },
];

const EN_SECONDARY_TITLES: StaffTitleDef[] = [
  { key: 'School Secretary',          label: 'School Secretary',                   permissions: PERMISSIONS_PAR_TITRE['School Secretary'] },
  { key: 'Vice-Principal',          label: 'Vice-Principal',                    permissions: PERMISSIONS_PAR_TITRE['Vice-Principal'] },
  { key: 'Discipline Master',       label: 'Discipline Master',                 permissions: PERMISSIONS_PAR_TITRE['Discipline Master'] },
  { key: 'Bursar',                  label: 'Bursar',                            permissions: PERMISSIONS_PAR_TITRE['Bursar'] },
  { key: 'HOD',                     label: 'Head of Department (HOD)',           permissions: PERMISSIONS_PAR_TITRE['HOD'] },
  { key: 'Librarian',               label: 'Librarian / Documentalist',         permissions: PERMISSIONS_PAR_TITRE['Librarian'] },
  { key: 'Guidance Counsellor',     label: 'Guidance Counsellor',               permissions: PERMISSIONS_PAR_TITRE['Guidance Counsellor'] },
];

const EN_PRIMARY_TITLES: StaffTitleDef[] = [
  { key: 'School Secretary',          label: 'School Secretary',                   permissions: PERMISSIONS_PAR_TITRE['School Secretary'] },
  { key: 'Deputy Head Teacher',     label: 'Deputy Head Teacher',               permissions: PERMISSIONS_PAR_TITRE['Deputy Head Teacher'] },
  { key: 'Bursar',                  label: 'Bursar',                            permissions: PERMISSIONS_PAR_TITRE['Bursar'] },
  { key: 'Librarian',               label: 'Librarian / Teacher-Librarian',     permissions: PERMISSIONS_PAR_TITRE['Librarian'] },
  { key: 'Pedagogic Coordinator',   label: 'Pedagogic Coordinator',             permissions: PERMISSIONS_PAR_TITRE['Pedagogic Coordinator'] },
];

// Bilingue secondaire : les deux sections cohabitent dans le même établissement
const BILINGUAL_SECONDARY_TITLES: StaffTitleDef[] = [
  { key: 'Secrétaire',                 label: 'Secrétaire / School Secretary',     permissions: PERMISSIONS_PAR_TITRE['Secrétaire'] },
  { key: 'School Secretary',          label: 'School Secretary / Secrétaire',     permissions: PERMISSIONS_PAR_TITRE['School Secretary'] },
  { key: 'Censeur',                 label: 'Censeur (section FR)',               permissions: PERMISSIONS_PAR_TITRE['Censeur'] },
  { key: 'Vice-Principal',          label: 'Vice-Principal (EN section)',        permissions: PERMISSIONS_PAR_TITRE['Vice-Principal'] },
  { key: 'Surveillant Général',     label: 'Surveillant Général',               permissions: PERMISSIONS_PAR_TITRE['Surveillant Général'] },
  { key: 'Discipline Master',       label: 'Discipline Master (EN)',             permissions: PERMISSIONS_PAR_TITRE['Discipline Master'] },
  { key: 'Intendant',               label: 'Intendant / Bursar',                permissions: PERMISSIONS_PAR_TITRE['Intendant'] },
  { key: 'Animateur Pédagogique',   label: 'Animateur Pédagogique / HOD',       permissions: PERMISSIONS_PAR_TITRE['Animateur Pédagogique'] },
  { key: 'Documentaliste',          label: 'Documentaliste / Librarian',        permissions: PERMISSIONS_PAR_TITRE['Documentaliste'] },
  { key: "Conseiller d'Orientation",label: "Conseiller d'Orientation / Guidance Counsellor", permissions: PERMISSIONS_PAR_TITRE["Conseiller d'Orientation"] },
  { key: 'Comptable-Matières',      label: 'Comptable-Matières',                permissions: PERMISSIONS_PAR_TITRE['Comptable-Matières'] },
];

const BILINGUAL_PRIMARY_TITLES: StaffTitleDef[] = [
  { key: 'Secrétaire',                 label: 'Secrétaire / School Secretary',     permissions: PERMISSIONS_PAR_TITRE['Secrétaire'] },
  { key: 'School Secretary',          label: 'School Secretary / Secrétaire',     permissions: PERMISSIONS_PAR_TITRE['School Secretary'] },
  { key: 'Directeur Adjoint',       label: 'Directeur(trice) Adjoint(e) / Deputy Head', permissions: PERMISSIONS_PAR_TITRE['Directeur Adjoint'] },
  { key: 'Économe',                 label: 'Économe / Bursar',                  permissions: PERMISSIONS_PAR_TITRE['Économe'] },
  { key: 'Documentaliste',          label: 'Documentaliste / Librarian',        permissions: PERMISSIONS_PAR_TITRE['Documentaliste'] },
];

// COMPLEXE_SCOLAIRE : école multi-niveaux francophone — staff peut être du secondaire ou du primaire
const COMPLEXE_TITLES: StaffTitleDef[] = [
  ...FR_SECONDARY_TITLES,
  { key: 'Directeur Adjoint',       label: 'Directeur(trice) Adjoint(e) (section primaire)', permissions: PERMISSIONS_PAR_TITRE['Directeur Adjoint'] },
  { key: 'Économe',                 label: 'Économe / Intendant',               permissions: PERMISSIONS_PAR_TITRE['Économe'] },
];

// ─── Fonction principale de sélection ────────────────────────────────────────

/**
 * Retourne la liste des titres de staff appropriés pour un type d'établissement.
 * @param meta  TemplateMeta issu de getTemplateMeta(school.templateCode)
 * @param templateCode  Code du template (pour cas spéciaux comme COMPLEXE_SCOLAIRE)
 */
export function getStaffTitlesForTemplate(meta: TemplateMeta, templateCode?: string): StaffTitleDef[] {
  if (templateCode === 'COMPLEXE_SCOLAIRE') return COMPLEXE_TITLES;

  const { isAnglophone, isPrimaire, isTechnique, langMode } = meta;

  if (langMode === 'bilingual') {
    return isPrimaire ? BILINGUAL_PRIMARY_TITLES : BILINGUAL_SECONDARY_TITLES;
  }
  if (isAnglophone) {
    return isPrimaire ? EN_PRIMARY_TITLES : EN_SECONDARY_TITLES;
  }
  // Francophone
  if (isPrimaire) return FR_PRIMAIRE_TITLES;
  if (isTechnique) return FR_TECHNIQUE_TITLES;
  return FR_SECONDARY_TITLES;
}

// ─── Helpers utilitaires ──────────────────────────────────────────────────────

/**
 * Retourne les permissions pour un titre donné.
 * Si le titre est inconnu, retourne un tableau vide.
 */
export function getPermissionsPourTitre(titre: string): StaffPermissionType[] {
  return PERMISSIONS_PAR_TITRE[titre] ?? [];
}

/**
 * Vérifie qu'un titre est reconnu par le système.
 */
export function titreReconnu(titre: string): boolean {
  return titre in PERMISSIONS_PAR_TITRE;
}
