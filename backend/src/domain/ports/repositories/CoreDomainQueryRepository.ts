/**
 * DOMAIN LAYER — Port Repository CoreDomain
 * Vues de lecture et écriture du domaine « core » (année académique / période),
 * consommées par CoreDomainController.
 */
import type { PeriodType } from '@domain/types/enums';

export interface CoreDomainAcademicYear {
  id: string;
  schoolId: string;
}

export interface CoreDomainPeriod {
  id: string;
  academicYearId: string;
  name: string;
  type: PeriodType;
  orderIndex: number;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  academicYear?: CoreDomainAcademicYear;
}

export interface CoreDomainPeriodInput {
  academicYearId: string;
  name: string;
  type: PeriodType;
  orderIndex: number;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
}

export interface CoreDomainQueryRepository {
  findAcademicYear(id: string, schoolId: string): Promise<CoreDomainAcademicYear | null>;
  countPeriods(academicYearId: string): Promise<number>;
  createPeriod(input: CoreDomainPeriodInput): Promise<CoreDomainPeriod>;
  findPeriods(params: { academicYearId?: string; type?: PeriodType; schoolId: string }): Promise<CoreDomainPeriod[]>;
  findPeriodById(id: string, schoolId: string): Promise<CoreDomainPeriod | null>;
  updatePeriod(id: string, data: Record<string, unknown>): Promise<CoreDomainPeriod>;
}
