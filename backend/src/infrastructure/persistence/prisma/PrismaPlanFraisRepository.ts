import type { PrismaClient } from '@prisma/client';
import { PlanFrais } from '@domain/entities/PlanFrais';
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';
import type { FeeType, FeePlanStatus } from '@domain/types/enums';

export class PrismaPlanFraisRepository implements PlanFraisRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<PlanFrais | null> {
    const data = await this.prisma.feePlan.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findBySchool(schoolId: string): Promise<PlanFrais[]> {
    const data = await this.prisma.feePlan.findMany({ where: { schoolId } });
    return data.map(d => this.toDomain(d));
  }

  async findByType(schoolId: string, feeType: FeeType): Promise<PlanFrais[]> {
    const data = await this.prisma.feePlan.findMany({
      where: { schoolId, feeType },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByLevel(schoolId: string, level: string): Promise<PlanFrais[]> {
    const data = await this.prisma.feePlan.findMany({
      where: { schoolId, level },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByAcademicYear(schoolId: string, academicYearId: string): Promise<PlanFrais[]> {
    const data = await this.prisma.feePlan.findMany({
      where: { schoolId, academicYearId },
    });
    return data.map(d => this.toDomain(d));
  }

  async getSeuilLegalTuition(
    schoolId: string,
    cycle: 'FIRST' | 'SECOND'
  ): Promise<number> {
    const config = await this.prisma.schoolConfig.findUnique({
      where: { schoolId },
      select: {
        legalMaxContributionFirstCycle: true,
        legalMaxContributionSecondCycle: true,
      },
    });
    if (!config) return cycle === 'FIRST' ? 7500 : 10000;
    return cycle === 'FIRST'
      ? config.legalMaxContributionFirstCycle
      : config.legalMaxContributionSecondCycle;
  }

  async save(plan: PlanFrais): Promise<void> {
    const data = plan.toObject();
    await this.prisma.feePlan.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        sectionId: data.sectionId,
        name: data.name,
        amount: data.amount,
        currency: data.currency,
        feeType: data.feeType,
        level: data.level,
        isRefundable: data.isRefundable,
        dueDate: data.dueDate,
        description: data.description,
        createdAt: data.createdAt,
        academicYearId: data.academicYearId,
        status: data.status,
      },
    });
  }

  async updateStatus(id: string, status: FeePlanStatus): Promise<void> {
    await this.prisma.feePlan.update({
      where: { id },
      data: { status },
    });
  }

  async update(plan: PlanFrais): Promise<void> {
    const data = plan.toObject();
    await this.prisma.feePlan.update({
      where: { id: data.id },
      data: {
        name: data.name,
        amount: data.amount,
        description: data.description,
        dueDate: data.dueDate ?? null,
        level: data.level ?? null,
        status: data.status,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.feePlan.delete({ where: { id } });
  }

  private toDomain(data: any): PlanFrais {
    return PlanFrais.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      sectionId: data.sectionId ?? undefined,
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      feeType: data.feeType as FeeType,
      level: data.level ?? undefined,
      isRefundable: data.isRefundable,
      dueDate: data.dueDate ?? undefined,
      description: data.description ?? undefined,
      createdAt: data.createdAt,
      academicYearId: data.academicYearId ?? undefined,
      status: data.status,
    });
  }
}
