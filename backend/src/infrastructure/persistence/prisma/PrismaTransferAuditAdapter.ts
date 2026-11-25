import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransferAuditEventInput, TransferAuditPort } from '@domain/ports/services/TransferAuditPort';

export class PrismaTransferAuditAdapter implements TransferAuditPort {
  constructor(private readonly prisma: PrismaClient) {}

  async append(event: TransferAuditEventInput): Promise<void> {
    await this.prisma.transferAuditEvent.create({
      data: {
        transferRequestId: event.transferRequestId,
        eventType: event.eventType,
        actorUserId: event.actorUserId,
        actorSchoolId: event.actorSchoolId,
        sourceSchoolId: event.sourceSchoolId,
        targetSchoolId: event.targetSchoolId,
        stateBefore: event.stateBefore,
        stateAfter: event.stateAfter,
        metadata: event.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async logDossierAccess(input: {
    snapshotId: string;
    transferRequestId: string;
    userId: string;
    schoolId: string;
  }): Promise<void> {
    const snapshot = await this.prisma.transferDossierSnapshot.findFirst({
      where: {
        id: input.snapshotId,
        transferRequestId: input.transferRequestId,
        transferRequest: { targetSchoolId: input.schoolId, status: 'COMPLETED' },
      },
      select: { id: true },
    });
    if (!snapshot) throw new Error('Dossier inaccessible pour cet établissement.');

    await this.prisma.transferDossierAccessLog.create({
      data: {
        snapshotId: snapshot.id,
        userId: input.userId,
        schoolId: input.schoolId,
      },
    });
  }
}
