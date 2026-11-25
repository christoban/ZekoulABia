import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
import {
  ForbiddenAnonymatError,
  NotAssignedCorrectorError,
  SessionNotFoundError,
} from '@domain/errors/AnonymatErrors';

export interface SoumettreCorrectionAnonymeCommande {
  schoolId: string;
  sessionId: string;
  correcteurId: string;
  actorRole: string;
  actorStaffPermissions?: readonly string[];
}

export class SoumettreCorrectionAnonymeUseCase {
  constructor(
    private readonly sessionRepo: HarmonizedAssessmentSessionRepository,
    private readonly anonymatRepo: AnonymatRepository,
  ) {}

  async execute(cmd: SoumettreCorrectionAnonymeCommande): Promise<{ submitted: number; sessionStatus: string }> {

    const session = await this.sessionRepo.findById(cmd.sessionId, cmd.schoolId);
    if (!session) throw new SessionNotFoundError();
    if (!session.isAnonymized) throw new ForbiddenAnonymatError();

    const isAdmin = cmd.actorRole === 'ADMIN';
    const assignments = await this.anonymatRepo.findAssignmentForCorrecteur(
      cmd.sessionId,
      cmd.correcteurId,
    );
    if (assignments.length === 0 && !isAdmin) {
      throw new NotAssignedCorrectorError();
    }

    const submitted = await this.anonymatRepo.submitNotesAnonymes(
      cmd.sessionId,
      cmd.correcteurId,
    );

    const allAssignments = await this.anonymatRepo.findCorrectionAssignments(cmd.sessionId);
    let allSubmitted = true;
    for (const a of allAssignments) {
      const notes = await this.anonymatRepo.findNotesAnonymesByCorrecteur(cmd.sessionId, a.correcteurUserId);
      if (notes.length === 0 || !notes.every((n) => n.status === 'SUBMITTED')) {
        allSubmitted = false;
        break;
      }
    }

    let sessionStatus = session.anonymatStatus;
    if (allAssignments.length > 0 && allSubmitted) {
      session.marquerCorrectionTerminee();
      await this.sessionRepo.update(session);
      sessionStatus = session.anonymatStatus;
    }

    return { submitted, sessionStatus };
  }
}
