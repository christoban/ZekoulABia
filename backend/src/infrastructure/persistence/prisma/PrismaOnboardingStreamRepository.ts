import type { PrismaClient } from '@prisma/client';
import type {
  AnglophoneStreamCombinationRecord,
  OnboardingStreamRepository,
} from '@domain/ports/repositories/OnboardingStreamRepository';

export class PrismaOnboardingStreamRepository implements OnboardingStreamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listAnglophoneStreamCombinations(): Promise<AnglophoneStreamCombinationRecord[]> {
    return this.prisma.anglophoneStreamCombination.findMany({
      orderBy: { filiere: 'asc' },
    });
  }
}
