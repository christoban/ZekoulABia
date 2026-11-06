import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  EmailLogQueryRepository,
  EmailLogListInput,
  EmailLogRow,
} from '@domain/ports/repositories/EmailLogQueryRepository';

export class PrismaEmailLogQueryRepository implements EmailLogQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listBySchool(input: EmailLogListInput): Promise<{ logs: EmailLogRow[]; total: number }> {
    const where = this.buildWhere(input);
    const [total, logs] = await Promise.all([
      this.prisma.emailLog.count({ where }),
      this.prisma.emailLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: input.skip, take: input.limit }),
    ]);
    return { logs: logs as EmailLogRow[], total };
  }

  private buildWhere(input: EmailLogListInput): Prisma.EmailLogWhereInput {
    return {
      ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search ? {
        OR: [
          { to: { contains: input.search, mode: 'insensitive' } },
          { subject: { contains: input.search, mode: 'insensitive' } },
        ],
      } : {}),
    };
  }
}
