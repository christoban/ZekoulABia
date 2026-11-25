/**
 * DOMAIN LAYER — Port Repository Suivi d'action élève signalé
 * (PLAN_VERIFICATION_ET_ACTIONS_SUIVI.md, Partie B)
 */

export type FollowUpActionType = 'ENTRETIEN_PARENT' | 'SIGNALEMENT_CONSEILLER' | 'OBSERVATION' | 'CONVOCATION_ELEVE';
export type FollowUpStatus = 'OUVERT' | 'EN_COURS' | 'CLOS';
export type InterviewMode = 'DATE_PROPOSEE' | 'DEMANDE_DISPONIBILITE';

export interface FollowUpActionDetail {
  id: string;
  schoolId: string;
  studentProfileId: string;
  studentId: string; // userId de l'élève
  studentName: string;
  classId: string | null;
  className: string | null;
  classProfessorPrincipalId: string | null; // pour notifier le PP quand un enseignant de matière agit
  triggeringRecommendationId: string | null;
  subjectId: string | null;
  subjectName: string | null;
  type: FollowUpActionType;
  status: FollowUpStatus;
  createdById: string;
  createdByName: string;
  assignedToId: string | null;
  assignedToName: string | null;
  targetDate: Date | null;
  interviewMode: InterviewMode | null;
  note: string | null;
  createdAt: Date;
  closedAt: Date | null;
  closedById: string | null;
  closedByName: string | null;
  closingNote: string | null;
}

export interface CreerFollowUpData {
  schoolId: string;
  studentProfileId: string;
  triggeringRecommendationId?: string;
  subjectId?: string;
  type: FollowUpActionType;
  createdById: string;
  assignedToId?: string;
  targetDate?: Date;
  interviewMode?: InterviewMode;
  note?: string;
}

export interface ConseillerDisponible {
  id: string;
  name: string;
}

export interface CreerConvocationData {
  schoolId: string;
  studentId: string;
  content: string;
}

export interface StudentFollowUpRepository {
  create(data: CreerFollowUpData): Promise<FollowUpActionDetail>;
  findById(id: string, schoolId: string): Promise<FollowUpActionDetail | null>;
  close(id: string, closedById: string, closingNote: string): Promise<FollowUpActionDetail>;
  reassign(id: string, assignedToId: string): Promise<FollowUpActionDetail>;
  /** "Mes actions de suivi" — assignées à cet utilisateur, ou à tout l'établissement si portée large. */
  listOpen(schoolId: string, options: { assignedToId?: string }): Promise<FollowUpActionDetail[]>;
  /** Historique complet (closes incluses) pour la fiche d'un élève. */
  listForStudent(studentProfileId: string, schoolId: string): Promise<FollowUpActionDetail[]>;
  /** Conseillers pédagogiques/orientation d'un établissement, pour "Signaler au conseiller". */
  listConseillersDisponibles(schoolId: string): Promise<ConseillerDisponible[]>;
  /** Persiste un message destiné à l'élève dans son espace (ex. convocation), contexte CONVOCATION/STUDENT. */
  createConvocation(data: CreerConvocationData): Promise<void>;
}
