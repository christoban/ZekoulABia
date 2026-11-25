import type { JournalMaintenanceRepository } from '@domain/ports/repositories/JournalMaintenanceRepository';

export class PurgerLogsEcoleUseCase {
  constructor(private readonly journalRepository: JournalMaintenanceRepository) {}

  async execute(): Promise<{
    schoolsProcessed: number;
    results: Array<{
      schoolId: string;
      logRetentionDays: number;
      cutoff: string;
      emailDeleted: number;
      smsDeleted: number;
    }>;
  }> {
    const results = await this.journalRepository.purgerTousLesJournaux();
    return { schoolsProcessed: results.length, results };
  }

  async executeForSchool(schoolId: string) {
    return this.journalRepository.purgerJournauxEcole(schoolId);
  }
}
