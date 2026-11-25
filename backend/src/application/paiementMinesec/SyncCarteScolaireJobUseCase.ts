import type { StepRunner } from '@application/shared/StepRunner';
import type { MinesecJobsRepository } from '@domain/ports/repositories/MinesecJobsRepository';
import type { MatriculeImportRepository } from '@domain/ports/repositories/MatriculeImportRepository';
import type { PaiementMinesecRepository } from '@domain/ports/repositories/PaiementMinesecRepository';
import type { CarteScolaireService } from '@domain/ports/services/CarteScolaireService';
import { messageErreur } from '@application/shared/messageErreur';
import { SyncFromCarteScolaireUseCase } from '../matricule/SyncFromCarteScolaireUseCase';

function yearLabelFor(year: { startDate: Date; endDate: Date | null }): string {
  return `${year.startDate.getFullYear()}-${year.endDate?.getFullYear() ?? year.startDate.getFullYear() + 1}`;
}

export class SyncCarteScolaireJobUseCase {
  private readonly syncUseCase: SyncFromCarteScolaireUseCase;

  constructor(
    private readonly minesecJobsRepository: MinesecJobsRepository,
    matriculeRepository: MatriculeImportRepository,
    paiementRepository: PaiementMinesecRepository,
    carteScolaireService: CarteScolaireService,
  ) {
    this.syncUseCase = new SyncFromCarteScolaireUseCase(matriculeRepository, paiementRepository, carteScolaireService);
  }

  async execute(step?: StepRunner): Promise<{ results: { schoolId: string; schoolName: string; report: unknown }[]; syncedAt: string }> {
    const schools = await this.minesecJobsRepository.listerEcolesActives();
    const results: { schoolId: string; schoolName: string; report: unknown }[] = [];

    for (const school of schools) {
      const year = await this.minesecJobsRepository.trouverAnneeCourante(school.id);
      if (!year) continue;

      try {
        const report = await this.syncUseCase.execute(school.id, yearLabelFor(year));
        results.push({ schoolId: school.id, schoolName: school.name, report });
      } catch (err) {
        results.push({ schoolId: school.id, schoolName: school.name, report: { error: messageErreur(err) } });
      }
      if (step) await step.sleep('pause-ecole', '1s');
    }

    return { results, syncedAt: new Date().toISOString() };
  }
}
