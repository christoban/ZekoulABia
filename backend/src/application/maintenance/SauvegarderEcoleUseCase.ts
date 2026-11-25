import type { SauvegardeRepository } from '@domain/ports/repositories/SauvegardeRepository';

export interface SauvegarderEcoleInput {
  schoolId?: string;
  requestedByMasterId?: string | null;
  source?: 'cron' | 'manual';
}

export class SauvegarderEcoleUseCase {
  constructor(private readonly sauvegardeRepository: SauvegardeRepository) {}

  async execute(input: SauvegarderEcoleInput = {}): Promise<{
    requestedSchoolId: string | null;
    schoolsProcessed: number;
    backups: Array<{ schoolId: string; fileName: string; filePath: string; createdAt: string }>;
  }> {
    const schools = await this.sauvegardeRepository.listerEcoles({ schoolId: input.schoolId });
    const backups: Array<{ schoolId: string; fileName: string; filePath: string; createdAt: string }> = [];
    for (const school of schools) {
      backups.push(
        await this.sauvegardeRepository.sauvegarderEcole({
          schoolId: school.id,
          requestedByMasterId: input.requestedByMasterId ?? null,
          source: input.source ?? (input.schoolId ? 'manual' : 'cron'),
        }),
      );
    }
    return { requestedSchoolId: input.schoolId ?? null, schoolsProcessed: schools.length, backups };
  }
}
