import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import type { HarmonizedAssessmentSession } from '@domain/entities/HarmonizedAssessmentSession';

export interface ListerSessionsCorrectionAnonymeCommande {
  schoolId: string;
  correcteurUserId: string;
}

export interface SessionCorrectionSummary {
  sessionId: string;
  subjectId: string;
  subjectName: string;
  classIds: string[];
  classNames: string[];
  anonymatStatus: string;
  scheduledDate: Date;
  submitted: boolean;
}

export class ListerSessionsCorrectionAnonymeUseCase {
  constructor(
    private readonly anonymatRepo: AnonymatRepository,
    private readonly sessionRepo: HarmonizedAssessmentSessionRepository,
  ) {}

  async execute(cmd: ListerSessionsCorrectionAnonymeCommande): Promise<SessionCorrectionSummary[]> {
    // 1. Toutes les CorrectionAssignment du correcteur
    const assignments = await this.anonymatRepo.findCorrectionAssignmentsByCorrecteur(
      cmd.schoolId,
      cmd.correcteurUserId,
    );
    const sessionIds = [...new Set(assignments.map((a) => a.assessmentSessionId))];

    const result: SessionCorrectionSummary[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.sessionRepo.findById(sessionId, cmd.schoolId);
      if (!session || !session.isAnonymized) continue;

      // Only include sessions that are in correction or ready for correction
      if (
        session.anonymatStatus !== 'EN_CORRECTION' &&
        session.anonymatStatus !== 'CORRECTION_TERMINEE' &&
        session.anonymatStatus !== 'ANONYMISATION_TERMINEE'
      ) {
        continue;
      }

      const sessionAssignments = assignments.filter((a) => a.assessmentSessionId === sessionId);
      const notes = await this.anonymatRepo.findNotesAnonymesByCorrecteur(sessionId, cmd.correcteurUserId);
      const submitted = notes.length > 0 && notes.every((n) => n.status === 'SUBMITTED');

      result.push({
        sessionId: session.id,
        subjectId: session.subjectId,
        subjectName: '', // Will be enriched by the route
        classIds: sessionAssignments.map((a) => a.classId),
        classNames: [], // Will be enriched by the route
        anonymatStatus: session.anonymatStatus,
        scheduledDate: session.scheduledDate,
        submitted,
      });
    }
    return result;
  }
}