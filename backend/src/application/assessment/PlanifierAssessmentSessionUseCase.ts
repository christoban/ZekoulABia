import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import { HarmonizedAssessmentSession } from '@domain/entities/HarmonizedAssessmentSession';
import type { CorrectionMode } from '@domain/types/enums';

export interface PlanifierAssessmentSessionCommande {
  schoolId: string;
  assessmentScopeId: string;
  subjectId: string;
  classId: string;
  academicSequenceId?: string;
  scheduledDate: Date;
  durationMinutes?: number;
  // --- anonymat (Partie 1) ---
  isAnonymized?: boolean; // défaut false
  correctionMode?: CorrectionMode; // requis si isAnonymized
}

export class PlanifierAssessmentSessionUseCase {
  constructor(private readonly sessionRepository: HarmonizedAssessmentSessionRepository) {}

  async execute(commande: PlanifierAssessmentSessionCommande): Promise<{ sessionId: string }> {
    const isAnonymized = commande.isAnonymized ?? false;
    if (isAnonymized && !commande.correctionMode) {
      throw new Error('correctionMode est requis lorsque isAnonymized=true');
    }

    const session = HarmonizedAssessmentSession.create({
      schoolId: commande.schoolId,
      assessmentScopeId: commande.assessmentScopeId,
      subjectId: commande.subjectId,
      classId: commande.classId,
      academicSequenceId: commande.academicSequenceId,
      scheduledDate: commande.scheduledDate,
      durationMinutes: commande.durationMinutes,
      status: 'PLANNED',
      isAnonymized,
      anonymatStatus: 'NONE',
      correctionMode: isAnonymized ? (commande.correctionMode ?? 'OWN_CLASS') : null,
    });

    await this.sessionRepository.save(session);

    return { sessionId: session.id };
  }
}
