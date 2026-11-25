/**
 * DOMAIN LAYER — Port Repository Plan de Frais (FeePlan)
 */
import type { PlanFrais } from '@domain/entities/PlanFrais';
import type { FeeType, FeePlanStatus } from '@domain/types/enums';

export interface PlanFraisRepository {
  findById(id: string): Promise<PlanFrais | null>;
  findBySchool(schoolId: string): Promise<PlanFrais[]>;
  findByType(schoolId: string, feeType: FeeType): Promise<PlanFrais[]>;
  findByLevel(schoolId: string, level: string): Promise<PlanFrais[]>;
  findByAcademicYear(schoolId: string, academicYearId: string): Promise<PlanFrais[]>;

  /**
   * Retourne le seuil légal MINESEC depuis SchoolConfig.
   * Premier cycle : legalMaxContributionFirstCycle (défaut 7500 XAF)
   * Second cycle  : legalMaxContributionSecondCycle (défaut 10000 XAF)
   */
  getSeuilLegalTuition(schoolId: string, cycle: 'FIRST' | 'SECOND'): Promise<number>;

  save(planFrais: PlanFrais): Promise<void>;
  update(planFrais: PlanFrais): Promise<void>;
  updateStatus(id: string, status: FeePlanStatus): Promise<void>;
  delete(id: string): Promise<void>;
}
