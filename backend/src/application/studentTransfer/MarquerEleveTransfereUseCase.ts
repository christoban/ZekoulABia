import type { StudentTransferLifecycleRepository } from '@domain/ports/repositories/StudentTransferLifecycleRepository';

export interface MarquerEleveTransfereCommand {
  transferRequestId: string;
  sourceStudentProfileId: string;
  sourceSchoolId: string;
  targetSchoolId: string;
  status: 'PENDING_GUARDIAN' | 'PENDING_SOURCE' | 'APPROVED' | 'COMPLETED';
}

export class MarquerEleveTransfereUseCase {
  constructor(private readonly lifecycleRepository: StudentTransferLifecycleRepository) {}

  async execute(command: MarquerEleveTransfereCommand): Promise<void> {
    if (command.sourceSchoolId === command.targetSchoolId) {
      throw new Error('Un transfert inter-écoles nécessite deux écoles distinctes.');
    }
    if (command.status !== 'COMPLETED') {
      throw new Error('Un élève ne peut être marqué TRANSFERRED qu’après COMPLETED.');
    }

    await this.lifecycleRepository.markSourceTransferred({
      ...command,
      completedAt: new Date(),
    });
  }
}
