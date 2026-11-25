/**
 * DOMAIN LAYER — Port de lecture dédié au journal d'activités (ActivitiesLogController).
 *
 * Regroupe toutes les lectures Prisma du controller (timeline + liste paginée).
 * Lecture seule — jamais d'écriture. Existe séparément pour ne pas injecter
 * PrismaClient dans le controller (cohérence hexagonale).
 */

export interface ActivityLogRow {
  id: string;
  schoolId: string | null;
  userId: string | null;
  action: string;
  description: string | null;
  createdAt: Date;
}

export interface AiActionLogRow {
  id: string;
  timestamp: Date;
  actionName: string;
  refusalReason: string | null;
  outcome: string;
}

export interface EmailLogRow {
  id: string;
  to: string;
  subject: string;
  status: string;
  createdAt: Date;
}

export interface ActivitiesLogQueryRepository {
  findTimeline(schoolId: string | null, limit: number): Promise<{
    activities: ActivityLogRow[];
    aiActions: AiActionLogRow[];
    emails: EmailLogRow[];
  }>;
  findAll(input: {
    schoolId: string | null;
    userId?: string | null;
    search: string;
    skip: number;
    limit: number;
  }): Promise<ActivityLogRow[]>;
  countAll(input: {
    schoolId: string | null;
    userId?: string | null;
    search: string;
  }): Promise<number>;
}
