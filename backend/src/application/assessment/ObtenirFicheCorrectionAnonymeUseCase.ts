import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
import {
  ForbiddenAnonymatError,
  NotAssignedCorrectorError,
  SessionNotFoundError,
} from '@domain/errors/AnonymatErrors';

export type FicheCorrectionLigne = {
  code: string;
  classId: string;
  score: number | null;
  isAbsent: boolean;
  isIllegible: boolean;
  status: 'DRAFT' | 'SUBMITTED';
};

export interface ObtenirFicheCorrectionAnonymeCommande {
  schoolId: string;
  sessionId: string;
  actorUserId: string;
  actorRole: string;
  actorStaffPermissions?: readonly string[];
}

export class ObtenirFicheCorrectionAnonymeUseCase {
  constructor(
    private readonly sessionRepo: HarmonizedAssessmentSessionRepository,
    private readonly anonymatRepo: AnonymatRepository,
  ) {}

  async execute(cmd: ObtenirFicheCorrectionAnonymeCommande): Promise<{
    sessionId: string;
    subjectId: string;
    submitted: boolean;
    lines: FicheCorrectionLigne[];
  }> {
    const session = await this.sessionRepo.findById(cmd.sessionId, cmd.schoolId);
    if (!session) throw new SessionNotFoundError();
    if (!session.isAnonymized) throw new ForbiddenAnonymatError();

    const isAdmin = cmd.actorRole === 'ADMIN';
    const assignments = await this.anonymatRepo.findAssignmentForCorrecteur(
      cmd.sessionId,
      cmd.actorUserId,
    );
    if (assignments.length === 0 && !isAdmin) {
      throw new NotAssignedCorrectorError();
    }

    const classIds = new Set(assignments.map((a) => a.classId));
    const allCodes = await this.anonymatRepo.findCodesBySession(cmd.sessionId);
    const codes = isAdmin
      ? allCodes
      : allCodes.filter((c) => classIds.has(c.classId));

    const notes = await this.anonymatRepo.findNotesAnonymesByCorrecteur(
      cmd.sessionId,
      cmd.actorUserId,
    );
    const codeToNote = new Map(notes.map((n) => [n.code, n]));
    const submitted =
      codes.length > 0 &&
      codes.every((c) => codeToNote.get(c.code)?.status === 'SUBMITTED');

    const lines: FicheCorrectionLigne[] = codes.map((c) => {
      const note = codeToNote.get(c.code);
      return {
        code: c.code,
        classId: c.classId,
        score: note?.score ?? null,
        isAbsent: note?.isAbsent ?? false,
        isIllegible: note?.isIllegible ?? false,
        status: (note?.status ?? 'DRAFT') as 'DRAFT' | 'SUBMITTED',
      };
    });

    return {
      sessionId: cmd.sessionId,
      subjectId: session.subjectId,
      submitted,
      lines,
    };
  }
}