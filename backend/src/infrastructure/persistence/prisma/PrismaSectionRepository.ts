import type { PrismaClient } from '@prisma/client';
import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';

export class PrismaSectionRepository implements SectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.section.findUnique({
      where: { id },
      select: {
        id: true,
        schoolId: true,
        code: true,
      },
    });
  }
}