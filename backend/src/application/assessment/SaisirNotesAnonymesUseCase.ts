import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
import {
  ForbiddenAnonymatError,
  InvalidCodeForAssignmentError,
  NotesAlreadySubmittedError,
  NotAssignedCorrectorError,
  SessionNotFoundError,
} from '@domain/errors/AnonymatErrors';

export interface SaisirNotesAnonymesCommande {
  schoolId: string;
  sessionId: string;
  correcteurId: string;
  actorRole: string;
  entries: Array<{
    code: string;
    score?: number | null;
    isAbsent?: boolean;
    isIllegible?: boolean;
    maxValue?: number;
  }>;
}

export class SaisirNotesAnonymesUseCase {
  constructor(
    private readonly sessionRepo: HarmonizedAssessmentSessionRepository,
    private readonly anonymatRepo: AnonymatRepository,
  ) {}

  async execute(cmd: SaisirNotesAnonymesCommande): Promise<{ saved: number }> {
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

    const assignClassIds = new Set(assignments.map((a) => a.classId));
    const submittedNotes = await this.anonymatRepo.findNotesAnonymesByCorrecteur(
      cmd.sessionId,
      cmd.correcteurId,
    );
    const submittedCodes = new Set(
      submittedNotes.filter((n) => n.status === 'SUBMITTED').map((n) => n.code),
    );

    for (const entry of cmd.entries) {
      if (submittedCodes.has(entry.code)) {
        throw new NotesAlreadySubmittedError();
      }

      const codeRecord = await this.anonymatRepo.findCodeBySessionAndCode(
        cmd.sessionId,
        entry.code,
      );
      if (!codeRecord) {
        throw new InvalidCodeForAssignmentError();
      }
      if (!isAdmin && !assignClassIds.has(codeRecord.classId)) {
        throw new InvalidCodeForAssignmentError();
      }
    }

    const notesToUpsert = cmd.entries.map((entry) => ({
      schoolId: cmd.schoolId,
      assessmentSessionId: cmd.sessionId,
      code: entry.code,
      score: entry.score ?? null,
      maxValue: entry.maxValue ?? 20,
      isAbsent: entry.isAbsent ?? false,
      isIllegible: entry.isIllegible ?? false,
      correcteurId: cmd.correcteurId,
    }));

    await this.anonymatRepo.upsertNotesAnonymes(notesToUpsert);
    return { saved: cmd.entries.length };
  }
}