import type { TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';
import type { StudentTransferLifecycleRepository } from '@domain/ports/repositories/StudentTransferLifecycleRepository';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';

export interface AssocierProfilCibleTransfertCommand {
  requestId: string;
  targetStudentProfileId: string;
  actingSchoolId: string;
  actorUserId: string;
}

export class AssocierProfilCibleTransfertUseCase {
  constructor(
    private readonly repository: TransferRequestRepositoryPort,
    private readonly lifecycleRepository: StudentTransferLifecycleRepository,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(command: AssocierProfilCibleTransfertCommand): Promise<void> {
    const request = await this.repository.findById(command.requestId);
    if (!request) throw new Error('Demande de transfert introuvable.');
    if (request.targetSchoolId !== command.actingSchoolId) {
      throw new Error('La demande n’appartient pas à cette école cible.');
    }
    if (request.status !== 'COMPLETED') {
      throw new Error('Le profil cible ne peut être associé qu’après COMPLETED.');
    }

    const result = await this.lifecycleRepository.markTargetReceived({
      transferRequestId: request.id,
      targetStudentProfileId: command.targetStudentProfileId,
      targetSchoolId: request.targetSchoolId,
      academicYearTarget: request.academicYearTarget,
      completedAt: request.completedAt ?? new Date(),
    });
    if (!result) throw new Error('Le profil cible est déjà associé à cette demande.');

    await this.audit.append({
      transferRequestId: request.id,
      eventType: 'TARGET_PROFILE_LINKED',
      actorUserId: command.actorUserId,
      actorSchoolId: command.actingSchoolId,
      sourceSchoolId: request.sourceSchoolId,
      targetSchoolId: request.targetSchoolId,
      stateBefore: 'COMPLETED',
      stateAfter: 'COMPLETED',
      metadata: { targetStudentProfileId: command.targetStudentProfileId },
    });
  }
}
