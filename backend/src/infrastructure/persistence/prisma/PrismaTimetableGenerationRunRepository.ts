import type { Prisma, PrismaClient } from '@prisma/client';
import type { TimetableGenerationRunData, TimetableGenerationRunRepository, TimetableGenerationRunStatus } from '@domain/ports/repositories/TimetableGenerationRunRepository';

export class PrismaTimetableGenerationRunRepository implements TimetableGenerationRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toData(run: { id: string; schoolId: string; academicYearId: string; status: string; requestedById: string; preflightReport: unknown; results: unknown; progress: unknown; errorMessage: string | null; budgetSeconds: number; heartbeatAt: Date; createdAt: Date; startedAt: Date | null; finishedAt: Date | null }): TimetableGenerationRunData {
    return {
      ...run,
      status: run.status as TimetableGenerationRunStatus,
      preflightReport: run.preflightReport,
      results: (run.results as unknown[] | null) ?? [],
      progress: run.progress,
    };
  }

  async create(params: { schoolId: string; academicYearId: string; requestedById: string; budgetSeconds?: number; progress?: unknown; preflightReport?: unknown }): Promise<TimetableGenerationRunData> {
    const run = await this.prisma.timetableGenerationRun.create({ data: { schoolId: params.schoolId, academicYearId: params.academicYearId, requestedById: params.requestedById, budgetSeconds: params.budgetSeconds ?? 600, progress: params.progress as Prisma.InputJsonValue | undefined, preflightReport: params.preflightReport as Prisma.InputJsonValue | undefined } });
    return this.toData(run);
  }

  async findById(id: string, schoolId: string): Promise<TimetableGenerationRunData | null> {
    const run = await this.prisma.timetableGenerationRun.findFirst({ where: { id, schoolId } });
    return run ? this.toData(run) : null;
  }

  async findActive(schoolId: string, academicYearId: string): Promise<TimetableGenerationRunData | null> {
    const run = await this.prisma.timetableGenerationRun.findFirst({ where: { schoolId, academicYearId, status: { in: ['PENDING', 'RUNNING'] } }, orderBy: { createdAt: 'desc' } });
    return run ? this.toData(run) : null;
  }

  async appendResult(id: string, schoolId: string, result: unknown, status: TimetableGenerationRunStatus, progress: unknown): Promise<void> {
    await this.prisma.$transaction(async tx => {
      const run = await tx.timetableGenerationRun.findFirst({ where: { id, schoolId } });
      if (!run) throw new Error('Run introuvable');
      const results = [...((run.results as unknown[] | null) ?? []), result];
      await tx.timetableGenerationRun.update({ where: { id }, data: { results: results as Prisma.InputJsonValue, progress: progress as Prisma.InputJsonValue, status, heartbeatAt: new Date(), updatedAt: new Date() } });
    });
  }

  async markRunning(id: string, schoolId: string): Promise<void> {
    await this.prisma.timetableGenerationRun.updateMany({ where: { id, schoolId }, data: { status: 'RUNNING', startedAt: new Date(), heartbeatAt: new Date(), updatedAt: new Date() } });
  }

  async markFinished(id: string, schoolId: string, status: TimetableGenerationRunStatus, errorMessage?: string): Promise<void> {
    await this.prisma.timetableGenerationRun.updateMany({ where: { id, schoolId }, data: { status, errorMessage, finishedAt: new Date(), heartbeatAt: new Date(), updatedAt: new Date() } });
  }

  async markCancelled(id: string, schoolId: string): Promise<void> {
    await this.prisma.timetableGenerationRun.updateMany({ where: { id, schoolId, status: { in: ['PENDING', 'RUNNING'] } }, data: { status: 'CANCELLED', cancelledAt: new Date(), finishedAt: new Date(), updatedAt: new Date() } });
  }

  async failStale(schoolId: string, olderThan: Date): Promise<number> {
    const result = await this.prisma.timetableGenerationRun.updateMany({ where: { schoolId, status: { in: ['PENDING', 'RUNNING'] }, heartbeatAt: { lt: olderThan } }, data: { status: 'FAILED', errorMessage: 'Run périmé : aucun heartbeat reçu.', finishedAt: new Date(), updatedAt: new Date() } });
    return result.count;
  }
}
