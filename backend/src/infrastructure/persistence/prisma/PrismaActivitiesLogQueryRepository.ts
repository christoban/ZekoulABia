import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  ActivitiesLogQueryRepository,
  ActivityLogRow,
  AiActionLogRow,
  EmailLogRow,
} from '@domain/ports/repositories/ActivitiesLogQueryRepository';

export class PrismaActivitiesLogQueryRepository implements ActivitiesLogQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findTimeline(schoolId: string | null, limit: number) {
    const whereActivity = schoolId ? { schoolId } : {};
    const whereAI = schoolId ? { schoolId } : {};
    const whereEmail = schoolId ? { schoolId } : {};
    const [activities, aiActions, emails] = await Promise.all([
      this.prisma.activitiesLog.findMany({ where: whereActivity, orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.aIActionAuditLog.findMany({ where: whereAI, orderBy: { timestamp: 'desc' }, take: limit }),
      this.prisma.emailLog.findMany({ where: whereEmail, orderBy: { createdAt: 'desc' }, take: limit }),
    ]);
    return {
      activities: activities as ActivityLogRow[],
      aiActions: aiActions as AiActionLogRow[],
      emails: emails as EmailLogRow[],
    };
  }

  async findAll(input: {
    schoolId: string | null;
    userId?: string | null;
    search: string;
    skip: number;
    limit: number;
  }): Promise<ActivityLogRow[]> {
    const where = this.buildWhere(input.schoolId, input.userId, input.search);
    const rows = await this.prisma.activitiesLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: input.skip,
      take: input.limit,
    });
    return rows as ActivityLogRow[];
  }

  async countAll(input: {
    schoolId: string | null;
    userId?: string | null;
    search: string;
  }): Promise<number> {
    return this.prisma.activitiesLog.count({ where: this.buildWhere(input.schoolId, input.userId, input.search) });
  }

  private buildWhere(schoolId: string | null, userId?: string | null, search?: string): Prisma.ActivitiesLogWhereInput {
    return {
      ...(schoolId ? { schoolId } : {}),
      ...(userId ? { userId } : {}),
      ...(search ? {
        OR: [
          { action: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };
  }
}
