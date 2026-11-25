/**
 * DOMAIN LAYER — Port Repository BulletinValidationSession
 * Gère le workflow de validation des bulletins par classe/période.
 */
import type { BulletinValidationStatus } from '@domain/types/enums';

export interface BulletinValidationSessionData {
  id: string;
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  status: BulletinValidationStatus;
  submittedById: string;
  submittedAt: Date;
  validatedById: string | null;
  validatedAt: Date | null;
  publishedAt: Date | null;
  class?: { id: string; name: string; level?: string | null };
  academicPeriod?: { id: string; name: string; academicYear?: { name: string } };
  submittedBy?: { id: string; firstName: string; lastName: string } | null;
  validatedBy?: { id: string; firstName: string; lastName: string } | null;
  school?: { name: string; city?: string | null; phone?: string | null };
}

export interface BulletinValidationRepository {
  listerSessions(schoolId: string, filters?: { classId?: string; academicPeriodId?: string; status?: BulletinValidationStatus }): Promise<BulletinValidationSessionData[]>;

  sessionExistante(classId: string, academicPeriodId: string): Promise<BulletinValidationSessionData | null>;

  creerSession(data: {
    schoolId: string;
    classId: string;
    academicPeriodId: string;
    submittedById: string;
  }): Promise<BulletinValidationSessionData>;

  obtenirSession(sessionId: string, schoolId: string): Promise<BulletinValidationSessionData | null>;

  validerSession(sessionId: string, validatedById: string): Promise<BulletinValidationSessionData>;

  publierSession(sessionId: string): Promise<BulletinValidationSessionData>;
}