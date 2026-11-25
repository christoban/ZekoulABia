import type { AssessmentParticipationRepository } from '@domain/ports/repositories/AssessmentParticipationRepository';
import type { AttendanceStatus } from '@domain/types/enums';
import { AssessmentParticipation } from '@domain/entities/AssessmentParticipation';

export interface EnregistrerParticipationCommande {
  schoolId: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  recordedById: string;
}

export class EnregistrerParticipationUseCase {
  constructor(private readonly participationRepository: AssessmentParticipationRepository) {}

  async execute(commande: EnregistrerParticipationCommande): Promise<{ participationId: string }> {
    const existing = await this.participationRepository.findBySessionAndStudent(
      commande.schoolId,
      commande.sessionId,
      commande.studentId,
    );

    if (existing) {
      await this.participationRepository.updateStatus(
        commande.schoolId,
        commande.sessionId,
        commande.studentId,
        commande.status,
        commande.recordedById,
      );
      return { participationId: existing.id };
    }

    const participation = AssessmentParticipation.create({
      schoolId: commande.schoolId,
      harmonizedAssessmentSessionId: commande.sessionId,
      studentId: commande.studentId,
      status: commande.status,
      recordedById: commande.recordedById,
    });

    await this.participationRepository.save(participation);

    return { participationId: participation.id };
  }
}
