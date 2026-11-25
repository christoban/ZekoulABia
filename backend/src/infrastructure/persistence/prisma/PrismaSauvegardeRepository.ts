import type { PrismaClient } from '@prisma/client';
import type { SauvegardeRepository } from '@domain/ports/repositories/SauvegardeRepository';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import { createSchoolBackup } from '../../backup/SchoolBackupService';

export class PrismaSauvegardeRepository implements SauvegardeRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly fileStorage: FileStoragePort,
  ) {}

  async listerEcoles(params: { schoolId?: string }): Promise<Array<{ id: string; name: string }>> {
    if (params.schoolId) {
      return this.prisma.school.findMany({ where: { id: params.schoolId }, select: { id: true, name: true } });
    }
    return this.prisma.school.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true } });
  }

  async sauvegarderEcole(params: {
    schoolId: string;
    requestedByMasterId?: string | null;
    source?: 'cron' | 'manual';
  }): Promise<{ schoolId: string; fileName: string; filePath: string; createdAt: string }> {
    return createSchoolBackup(
      this.prisma,
      {
        schoolId: params.schoolId,
        requestedByMasterId: params.requestedByMasterId ?? null,
        source: params.source ?? 'manual',
      },
      this.fileStorage,
    );
  }
}
