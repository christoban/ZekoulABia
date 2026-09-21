/**
 * DOMAIN LAYER — Port Repository Import Utilisateurs
 * Lectures/écritures de l'import massif d'utilisateurs (5 entités : STUDENT, TEACHER, STAFF, PARENT, CLASSE).
 */

import type { PebsFiliere } from '@domain/types/enums';

export interface ImportContexte {
  schoolName: string;
  hasPEBS: boolean;
  classes: { id: string; name: string; capacity?: number; currentEnrollments?: number }[];
  lv2Subjects: { id: string; name: string }[];
}

export interface AffectationPedagogiqueData {
  classId: string;
  subjectId: string;
  teacherId: string;
  schoolId: string;
  academicYearId: string;
}

// Contexte de validation pour le dry-run d'import (types de domaine, pas d'application)
export interface ImportContexteValidation {
  classes: { id: string; name: string; level: string | null; serie: string | null; filiere: string | null; academicYearId: string }[];
  lv2Subjects: { id: string; name: string }[];
  hasPEBS: boolean;
  existingParents: Map<string, string>;
  existingStudents: { id: string; matricule?: string; email?: string }[];
  subjects: { id: string; name: string }[];
  departementsAp: { id: string; name: string }[];
}

export interface AffectationPedagogiqueData {
  classId: string;
  subjectId: string;
  teacherId: string;
  schoolId: string;
  academicYearId: string;
}

export interface ImportUtilisateursRepository {
  chargerContexte(schoolId: string): Promise<ImportContexte>;

  findParentParEmail(schoolId: string, email: string): Promise<string | null>;
  findStudentProfileId(userId: string): Promise<string | null>;
  updatePeBSFiliere(userId: string, pebsFiliere: PebsFiliere): Promise<void>;
  updateLv2Subject(userId: string, lv2SubjectId: string): Promise<void>;
  updatePeBSAndLv2(userId: string, pebsFiliere: PebsFiliere | null, lv2SubjectId: string | null): Promise<void>;

  findSubjectsParNoms(schoolId: string, noms: string[]): Promise<{ id: string; name: string }[]>;

  findClassePourPP(schoolId: string, name: string): Promise<{ id: string; professorPrincipalId: string | null } | null>;
  findNomProfesseurPrincipal(userId: string): Promise<string | null>;
  findAutreClasseDePP(teacherId: string, schoolId: string, excludeClassId: string): Promise<{ name: string } | null>;
  assignerProfesseurPrincipal(classId: string, teacherId: string): Promise<void>;

  findClasseProgramme(schoolId: string, name: string): Promise<{ id: string; level: string | null; serie: string | null; filiere: string | null; academicYearId: string } | null>;
  findSubjectsDuProgramme(schoolId: string, level: string | null, codeSerie: string | null, classId: string): Promise<string[]>;
  creerAffectations(assignments: AffectationPedagogiqueData[]): Promise<number>;

  // ── NOUVEAU (Étape 3 — support PARENT) ──────────────────────────────────
  // Résout un lot de matricules d'élèves en IDs de StudentProfile, scopé à l'école.
  findStudentsParMatricules(schoolId: string, matricules: string[]): Promise<{ matricule: string; studentProfileId: string }[]>;
  // Résout un lot d'emails d'élèves en IDs de StudentProfile, scopé à l'école.
  findStudentsParEmails(schoolId: string, emails: string[]): Promise<{ email: string; studentProfileId: string }[]>;

  // Résout un nom de section en sectionId (scopé à l'école).
  findSectionParNom(schoolId: string, nom: string): Promise<{ id: string } | null>;

  // Résout un lot de noms de départements en IDs, scopé à l'école.
  findDepartmentsParNoms(schoolId: string, noms: string[]): Promise<{ id: string; name: string }[]>;

  // Charge le contexte complet pour la validation (dry-run) — toutes les données de référence
  // nécessaires pour valider les 5 types d'entités sans écrire en base.
  chargerContexteValidation(schoolId: string): Promise<ImportContexteValidation>;
}