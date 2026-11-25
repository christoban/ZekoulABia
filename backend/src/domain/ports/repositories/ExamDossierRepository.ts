/**
 * DOMAIN LAYER — Port Repository Dossier Examen
 * Opérations de persistance pour la préparation des dossiers d'inscription aux examens.
 */
import type { TypeExamen, TypeFraisMinesec } from '@domain/types/enums';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface StudentProfileExamInfo {
  id: string;
  matricule: string | null;
  matriculeVerifieAt: Date | null;
  user: { firstName: string; lastName: string };
  classeActuelle: { name: string; level: string } | null;
}

export interface ExamRegistrationInfo {
  id: string;
}

export interface PaiementMinesecInfo {
  id: string;
  status: string;
}

export interface InscriptionMinesecInfo {
  id: string;
}

export interface ExamRegistrationListItem {
  id: string;
  anneeScolaire: string;
  typeExamen: TypeExamen;
  status: string;
  session: number;
  matriculeNational: string;
  numeroCandidatExamen: string | null;
  resultatStatus: string | null;
  resultatMention: string | null;
  resultatScore: number | null;
  resultatSource: string | null;
  resultatVerifiedAt: Date | null;
  createdAt: Date;
}

export interface ExamResultUpdateData {
  resultatStatus: string;
  resultatMention: string | null;
  resultatScore: number | null;
  resultatSource: string;
}

// ── Interface ─────────────────────────────────────────────────────────────────

export interface ExamDossierRepository {
  findStudentProfileForExam(schoolId: string, studentUserId: string): Promise<StudentProfileExamInfo | null>;
  findExamRegistration(studentId: string, anneeScolaire: string, typeExamen: TypeExamen): Promise<ExamRegistrationInfo | null>;
  findPaiementMinesec(studentId: string, typeFrais: TypeFraisMinesec, anneeScolaire: string): Promise<PaiementMinesecInfo | null>;
  findOrCreateInscriptionMinesec(studentId: string, schoolId: string, anneeScolaire: string, classe: string): Promise<InscriptionMinesecInfo>;
  createExamRegistration(data: {
    studentId: string; enrollmentId: string; schoolId: string;
    anneeScolaire: string; typeExamen: TypeExamen; session: number;
    matriculeNational: string; paiementMinesecId: string | null;
  }): Promise<ExamRegistrationInfo>;
  /** Vérifie l'appartenance d'un StudentProfile à l'école courante (isolation multi-tenant). */
  studentProfileBelongsToSchool(profileId: string, schoolId: string): Promise<boolean>;
  /** Inscriptions aux examens d'un élève, plus récentes en premier. */
  findExamRegistrationsByStudent(studentId: string): Promise<ExamRegistrationListItem[]>;
  /** Pose le numéro de candidat (count 0 = inexistant OU hors école — volontairement indiscernables). */
  setNumeroCandidat(examId: string, schoolId: string, numeroCandidatExamen: string): Promise<number>;
  /** Enregistre le résultat (count 0 = inexistant OU hors école — même logique). */
  setExamResult(examId: string, schoolId: string, data: ExamResultUpdateData): Promise<number>;
}
