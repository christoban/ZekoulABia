import type { PrismaClient } from '@prisma/client';
import type { OnboardingTimetableRepository } from '@domain/ports/repositories/OnboardingTimetableRepository';

export class PrismaOnboardingTimetableRepository implements OnboardingTimetableRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hasTimetableGridConfig(schoolId: string): Promise<boolean> {
    const grid = await this.prisma.timetableGridConfig.findUnique({
      where: { schoolId },
      select: { schoolId: true },
    });
    return !!grid;
  }
}
