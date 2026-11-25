/**
 * DOMAIN LAYER — Port de lecture dédié aux journaux d'e-mails (EmailLogController).
 *
 * Lecture seule — jamais d'écriture. Existe pour ne pas injecter PrismaClient
 * dans le controller (cohérence hexagonale).
 */

export interface EmailLogRow {
  id: string;
  schoolId: string;
  to: string;
  subject: string;
  status: string;
  createdAt: Date;
}

export interface EmailLogListInput {
  schoolId: string | null;
  status?: string;
  search?: string;
  skip: number;
  limit: number;
}

export interface EmailLogQueryRepository {
  listBySchool(input: EmailLogListInput): Promise<{ logs: EmailLogRow[]; total: number }>;
}
