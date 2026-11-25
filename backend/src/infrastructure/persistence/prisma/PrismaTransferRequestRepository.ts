import { Prisma, type PrismaClient, type TransferRequestStatus as PrismaTransferRequestStatus } from '@prisma/client';
import type {
  CompletedTransferBrief,
  CreateTransferRequestCommand,
  SourceReceivedBrief,
  TargetSentBrief,
  TransferRequestRecord,
  TransferRequestRepositoryPort,
} from '@domain/ports/repositories/TransferRequestRepository';
import { TRANSFER_REQUEST_FINAL_STATUSES } from '@domain/ports/services/CrossSchoolTransferGatewayPort';
import type { TransferSnapshotBuildResult } from '@domain/ports/services/TransferSnapshotBuilderPort';

function mapRequest(request: Prisma.TransferRequestGetPayload<object>): TransferRequestRecord {
  return {
    id: request.id,
    identityId: request.identityId,
    sourceSchoolId: request.sourceSchoolId,
    targetSchoolId: request.targetSchoolId,
    sourceStudentProfileId: request.sourceStudentProfileId,
    targetStudentProfileId: request.targetStudentProfileId,
    requestedByUserId: request.requestedByUserId,
    academicYearTarget: request.academicYearTarget,
    status: request.status,
    requestedAt: request.requestedAt,
    guardianDecisionAt: request.guardianDecisionAt,
    sourceDecisionAt: request.sourceDecisionAt,
    completedAt: request.completedAt,
    parentExpiresAt: request.parentExpiresAt,
    sourceAutoApprovalAt: request.sourceAutoApprovalAt,
    rejectionReason: request.rejectionReason,
    rejectedBy: request.rejectedBy,
  };
}

const COLLISION_CODE = 'P2002';

export class PrismaTransferRequestRepository implements TransferRequestRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<TransferRequestRecord | null> {
    const request = await this.prisma.transferRequest.findUnique({ where: { id } });
    return request ? mapRequest(request) : null;
  }

  async findActiveByIdentityByNationalId(nationalId: string): Promise<TransferRequestRecord | null> {
    const request = await this.prisma.transferRequest.findFirst({
      where: {
        status: { notIn: TRANSFER_REQUEST_FINAL_STATUSES as unknown as PrismaTransferRequestStatus[] },
        identity: { nationalId },
      },
      orderBy: { requestedAt: 'desc' },
    });
    return request ? mapRequest(request) : null;
  }

  async listSentByTarget(targetSchoolId: string): Promise<TargetSentBrief[]> {
    const requests = await this.prisma.transferRequest.findMany({
      where: { targetSchoolId },
      orderBy: { requestedAt: 'desc' },
      take: 100,
      include: { sourceSchool: { select: { name: true } } },
    });
    return requests.map(request => ({ ...mapRequest(request), sourceSchoolName: request.sourceSchool.name }));
  }

  async listReceivedBySource(sourceSchoolId: string): Promise<SourceReceivedBrief[]> {
    const requests = await this.prisma.transferRequest.findMany({
      where: { sourceSchoolId },
      orderBy: { requestedAt: 'desc' },
      take: 100,
      include: {
        targetSchool: { select: { name: true } },
        consents: { select: { decision: true, tokenExpiresAt: true }, orderBy: { tokenExpiresAt: 'desc' }, take: 1 },
      },
    });
    return requests.map(request => ({
      ...mapRequest(request),
      targetSchoolName: request.targetSchool.name,
      consenterDecision: (request.consents[0]?.decision ?? null) as SourceReceivedBrief['consenterDecision'],
      consenterExpiresAt: request.consents[0]?.tokenExpiresAt ?? null,
    }));
  }

  async listCompletedForTargetSchool(targetSchoolId: string): Promise<CompletedTransferBrief[]> {
    const requests = await this.prisma.transferRequest.findMany({
      where: { targetSchoolId, status: 'COMPLETED', targetStudentProfileId: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        completedAt: true,
        targetStudentProfileId: true,
        sourceSchool: { select: { name: true } },
        snapshot: { select: { id: true } },
      },
    });
    return requests.map(request => ({
      id: request.id,
      completedAt: request.completedAt,
      sourceSchoolName: request.sourceSchool.name,
      snapshotId: request.snapshot?.id ?? null,
      targetStudentProfileId: request.targetStudentProfileId,
    }));
  }

  async createPendingGuardian(command: CreateTransferRequestCommand): Promise<TransferRequestRecord> {
    const identity = await this.prisma.studentIdentity.findUnique({
      where: { nationalId: command.nationalId },
      select: { id: true },
    });
    if (!identity) throw new Error('Aucune identité enregistrée pour ce matricule national.');

    const sourceProfile = await this.prisma.studentProfile.findFirst({
      where: { identityId: identity.id, schoolId: { not: command.targetSchoolId }, studentStatus: 'ACTIVE' },
      select: { id: true, schoolId: true },
      orderBy: { id: 'asc' },
    });
    if (!sourceProfile) throw new Error('Aucun profil source trouvé pour cette identité.');

    try {
      const request = await this.prisma.transferRequest.create({
        data: {
          identityId: identity.id,
          sourceSchoolId: sourceProfile.schoolId,
          targetSchoolId: command.targetSchoolId,
          sourceStudentProfileId: sourceProfile.id,
          requestedByUserId: command.requestedByUserId,
          academicYearTarget: command.academicYearTarget,
          requestedAt: command.requestedAt,
          parentExpiresAt: command.parentExpiresAt,
          sourceAutoApprovalAt: command.sourceAutoApprovalAt,
        },
      });
      return mapRequest(request);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === COLLISION_CODE) {
        throw new Error('Une demande active existe déjà pour cette identité.');
      }
      throw error;
    }
  }

  async transitionIfCurrent(command: {
    id: string;
    expectedStatus: TransferRequestRecord['status'];
    nextStatus: TransferRequestRecord['status'];
    patch?: Partial<TransferRequestRecord>;
  }): Promise<TransferRequestRecord | null> {
    const result = await this.prisma.transferRequest.updateMany({
      where: { id: command.id, status: command.expectedStatus },
      data: {
        status: command.nextStatus as PrismaTransferRequestStatus,
        ...(command.patch?.guardianDecisionAt ? { guardianDecisionAt: command.patch.guardianDecisionAt } : {}),
        ...(command.patch?.sourceDecisionAt ? { sourceDecisionAt: command.patch.sourceDecisionAt } : {}),
        ...(command.patch?.completedAt ? { completedAt: command.patch.completedAt } : {}),
        ...(command.patch?.sourceAutoApprovalAt ? { sourceAutoApprovalAt: command.patch.sourceAutoApprovalAt } : {}),
        ...(command.patch?.rejectionReason ? { rejectionReason: command.patch.rejectionReason } : {}),
        ...(command.patch?.rejectedBy ? { rejectedBy: command.patch.rejectedBy } : {}),
      },
    });
    if (result.count !== 1) return null;
    return this.findById(command.id);
  }

  async completeWithSnapshot(command: { id: string; snapshot: TransferSnapshotBuildResult }): Promise<TransferRequestRecord | null> {
    return this.prisma.$transaction(async tx => {
      const updated = await tx.transferRequest.updateMany({
        where: { id: command.id, status: 'APPROVED' },
        data: { status: 'COMPLETED', completedAt: command.snapshot.generatedAt },
      });
      if (updated.count !== 1) return null;
      await tx.transferDossierSnapshot.create({
        data: {
          id: command.snapshot.snapshotId,
          transferRequestId: command.id,
          payloadEncrypted: command.snapshot.payloadEncrypted,
          schemaVersion: command.snapshot.schemaVersion,
          categories: [...command.snapshot.categories],
          checksum: command.snapshot.checksum,
          generatedAt: command.snapshot.generatedAt,
          deleteAfter: command.snapshot.deleteAfter,
        },
      });
      const request = await tx.transferRequest.findUnique({ where: { id: command.id } });
      return request ? mapRequest(request) : null;
    });
  }
}
