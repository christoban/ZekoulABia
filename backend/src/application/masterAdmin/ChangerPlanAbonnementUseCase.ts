/**
 * APPLICATION LAYER — Use Case : Changer le plan d'abonnement d'une école
 */
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { PlanType } from '@domain/types/enums';

export class ChangerPlanAbonnementUseCase {
  constructor(private readonly schoolRepository: SchoolRepository) {}

  async execute(params: { schoolId: string; nouveauPlan: PlanType }): Promise<void> {
    const school = await this.schoolRepository.findById(params.schoolId);
    if (!school) throw new Error(`École introuvable : ${params.schoolId}`);

    school.changerPlan(params.nouveauPlan);
    await this.schoolRepository.update(school);
  }
}
