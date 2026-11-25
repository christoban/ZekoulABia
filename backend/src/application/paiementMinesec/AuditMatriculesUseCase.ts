import type { MinesecJobsRepository } from '@domain/ports/repositories/MinesecJobsRepository';

export class AuditMatriculesUseCase {
  constructor(private readonly repository: MinesecJobsRepository) {}

  async execute(): Promise<{ results: { schoolId: string; schoolName: string; totalActive: number; withoutMatricule: number }[]; auditedAt: string }> {
    const schools = await this.repository.listerEcolesActives();
    const results: { schoolId: string; schoolName: string; totalActive: number; withoutMatricule: number }[] = [];

    for (const school of schools) {
      const totalActive = await this.repository.compterElevesActifs(school.id);
      const withoutMatricule = await this.repository.compterSansMatricule(school.id);
      results.push({ schoolId: school.id, schoolName: school.name, totalActive, withoutMatricule });
    }

    return { results, auditedAt: new Date().toISOString() };
  }
}
