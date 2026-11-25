import { STUDENT_TRANSFER_CONFIG } from './config';
import { validateNationalId } from '@application/matricule/normalizeNationalId';
import type {
  TransferRequestRecord,
  TransferRequestRepositoryPort,
} from '@domain/ports/repositories/TransferRequestRepository';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';

export interface CreerDemandeTransfertCommand {
  nationalId: string;
  targetSchoolId: string;
  requestedByUserId: string;
  academicYearTarget: string;
  now?: Date;
}

export class CreerDemandeTransfertUseCase {
  constructor(
    private readonly repository: TransferRequestRepositoryPort,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(command: CreerDemandeTransfertCommand): Promise<TransferRequestRecord> {
    const nationalId = validateNationalId(command.nationalId);

    const active = await this.repository.findActiveByIdentityByNationalId(nationalId);
    if (active) {
      throw new Error('Une demande active existe déjà pour cette identité.');
    }

    const requestedAt = command.now ?? new Date();
    const parentExpiresAt = new Date(requestedAt);
    parentExpiresAt.setUTCDate(
      parentExpiresAt.getUTCDate() + STUDENT_TRANSFER_CONFIG.parentExpirationDelayDays,
    );

    const request = await this.repository.createPendingGuardian({
      nationalId,
      targetSchoolId: command.targetSchoolId,
      requestedByUserId: command.requestedByUserId,
      academicYearTarget: command.academicYearTarget,
      requestedAt,
      parentExpiresAt,
      sourceAutoApprovalAt: null,
    });

    await this.audit.append({
      transferRequestId: request.id,
      eventType: 'REQUEST_CREATED',
      actorUserId: command.requestedByUserId,
      actorSchoolId: request.targetSchoolId,
      sourceSchoolId: request.sourceSchoolId,
      targetSchoolId: request.targetSchoolId,
      stateBefore: 'NONE',
      stateAfter: request.status,
      metadata: { academicYearTarget: request.academicYearTarget },
    });

    return request;
  }
}
