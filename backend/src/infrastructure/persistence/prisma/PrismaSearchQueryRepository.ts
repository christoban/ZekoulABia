import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type {
  SearchQueryRepository,
  SearchUserRow,
  SearchClassRow,
  SearchSubjectRow,
  SearchActivityRow,
} from '@domain/ports/repositories/SearchQueryRepository';

export class PrismaSearchQueryRepository implements SearchQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async searchUsers(schoolId: string | null, q: string, take: number): Promise<SearchUserRow[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        OR: [
          { firstName: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { lastName: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
      take,
    });
    return rows as SearchUserRow[];
  }

  async searchClasses(schoolId: string | null, q: string, take: number): Promise<SearchClassRow[]> {
    const rows = await this.prisma.class.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        name: { contains: q, mode: Prisma.QueryMode.insensitive },
      },
      select: { id: true, name: true, createdAt: true },
      take,
    });
    return rows as SearchClassRow[];
  }

  async searchSubjects(schoolId: string | null, q: string, take: number): Promise<SearchSubjectRow[]> {
    const rows = await this.prisma.subject.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        OR: [
          { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { code: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      select: { id: true, name: true, code: true, createdAt: true },
      take,
    });
    return rows as SearchSubjectRow[];
  }

  async searchActivities(schoolId: string | null, q: string, take: number): Promise<SearchActivityRow[]> {
    const rows = await this.prisma.activitiesLog.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        OR: [
          { action: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      select: { id: true, action: true, description: true, createdAt: true },
      take,
    });
    return rows as SearchActivityRow[];
  }
}
