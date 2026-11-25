import type { AssessmentParticipationRepository } from '@domain/ports/repositories/AssessmentParticipationRepository';
import type { AttendanceStatus } from '@domain/types/enums';

export interface ParticipationLigne {
  studentId: string;
  status: AttendanceStatus;
}

export interface EnregistrerParticipationEnLotCommande {
  schoolId: string;
  sessionId: string;
  participations: ParticipationLigne[];
  recordedById: string;
}

export class EnregistrerParticipationEnLotUseCase {
  constructor(private readonly participationRepository: AssessmentParticipationRepository) {}

  async execute(commande: EnregistrerParticipationEnLotCommande): Promise<{ enregistrees: number }> {
    let count = 0;

    for (const participation of commande.participations) {
      await this.participationRepository.updateStatus(
        commande.schoolId,
        commande.sessionId,
        participation.studentId,
        participation.status,
        commande.recordedById,
      );
      count++;
    }

    return { enregistrees: count };
  }
}
