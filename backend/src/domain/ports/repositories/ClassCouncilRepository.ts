/**
 * DOMAIN LAYER — Port Repository ClassCouncil
 * Utilisé par GenererBulletinUseCase pour enforcer Loi 5b :
 * le conseil doit être LOCKED avant toute génération de bulletins.
 */
import type { CouncilDecision, CouncilStatus } from '../../types/enums';

export interface ClassCouncilSessionData {
  id: string;
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  presidedById: string;
  status: CouncilStatus;
  createdAt: Date;
  validatedAt: Date | null;
  class?: { id: string; name: string; level?: string | null };
  academicPeriod?: { id: string; name: string; academicYear?: { name: string } };
  presidedBy?: { id: string; firstName: string; lastName: string } | null;
  school?: { name: string; city?: string | null; phone?: string | null };
  decisions?: ClassCouncilDecisionData[];
  _count?: { decisions: number };
}

export interface ClassCouncilDecisionData {
  id: string;
  sessionId: string;
  studentId: string;
  decision: CouncilDecision;
  observations: string | null;
  createdAt: Date;
  student?: { id: string; firstName: string; lastName: string; studentProfile?: { healthScore?: number | null } | null };
}

export interface ClassCouncilRepository {
  sessionVerrouilleeExiste(classId: string, academicPeriodId: string): Promise<boolean>;

  listerSessions(schoolId: string, filters?: { classId?: string; academicPeriodId?: string }): Promise<ClassCouncilSessionData[]>;

  obtenirSession(sessionId: string, schoolId: string): Promise<ClassCouncilSessionData | null>;

  obtenirConfigAlertes(schoolId: string): Promise<{ aiRiskThreshold: number; aiRiskThresholdCritical: number } | null>;

  obtenirEnfantsParent(userId: string): Promise<string[]>;

  creerSession(data: {
    schoolId: string;
    classId: string;
    academicPeriodId: string;
    presidedById: string;
  }): Promise<ClassCouncilSessionData>;

  preRemplirDecisions(sessionId: string, studentIds: string[]): Promise<void>;

  upsertDecision(sessionId: string, studentId: string, decision: CouncilDecision, observations?: string | null): Promise<ClassCouncilDecisionData>;

  upsertDecisionsEnBloc(sessionId: string, decisions: { studentId: string; decision: CouncilDecision; observations?: string | null }[]): Promise<number>;

  verrouillerSession(sessionId: string): Promise<ClassCouncilSessionData>;

  compterNotesNonValidees(schoolId: string, classId: string, academicPeriodId: string): Promise<number>;

  classeExiste(classId: string, schoolId: string): Promise<{ id: string; name: string } | null>;

  sessionExistente(classId: string, academicPeriodId: string): Promise<ClassCouncilSessionData | null>;

  compterDecisions(sessionId: string): Promise<number>;

  eleveDansClasse(studentId: string, classId: string): Promise<boolean>;

  obtenirMoyennesElevesParClasse(classId: string, academicPeriodId: string): Promise<Map<string, number>>;

  elevesDansClasse(classId: string): Promise<string[]>;

  /** Ids de classes ayant un conseil LOCKED pour une période — anomalies établissement. */
  findClassIdsAvecConseilVerrouille(schoolId: string, academicPeriodId: string): Promise<string[]>;

  /** Périodes verrouillées pour une classe — tableau d'honneur annuel (allLocked). */
  listLockedPeriodIdsForClasse(classId: string, schoolId: string): Promise<string[]>;
}
