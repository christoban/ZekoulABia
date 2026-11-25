import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
import { generateAnonymatCode } from '@domain/services/AnonymatCodeGenerator';
import { canManageAnonymat } from '@domain/rules/AnonymatRules';
import {
  ForbiddenAnonymatError,
  SessionNotFoundError,
  SessionNotAnonymizedError,
  NoStudentsInSessionError,
} from '@domain/errors/AnonymatErrors';

export interface GenererCodesAnonymatCommande {
  schoolId: string;
  sessionId: string;
  actorUserId: string;
  actorRole: string;
  actorStaffPermissions?: readonly string[];
  classIds: string[];
}

export class GenererCodesAnonymatUseCase {
  constructor(
    private readonly sessionRepo: HarmonizedAssessmentSessionRepository,
    private readonly anonymatRepo: AnonymatRepository,
  ) {}

  async execute(cmd: GenererCodesAnonymatCommande): Promise<{ codesCount: number }> {
    if (!canManageAnonymat({
      role: cmd.actorRole,
      staffPermissions: cmd.actorStaffPermissions,
    })) {
      throw new ForbiddenAnonymatError();
    }

    const session = await this.sessionRepo.findById(cmd.sessionId, cmd.schoolId);
    if (!session) throw new SessionNotFoundError();
    if (!session.isAnonymized) throw new SessionNotAnonymizedError();

    // Transition métier sur l'entité (valide le statut)
    session.marquerCodesGeneres(cmd.actorUserId);

    const groups = await this.anonymatRepo.findStudentsForSessionGroupedByClass({
      schoolId: cmd.schoolId,
      classIds: cmd.classIds,
    });

    const existing = new Set<string>();
    const toCreate: Array<{
      schoolId: string;
      assessmentSessionId: string;
      studentProfileId: string;
      classId: string;
      code: string;
      generatedByUserId: string;
    }> = [];

    for (const group of groups) {
      for (const student of group.students) {
        const code = generateAnonymatCode(existing);
        toCreate.push({
          schoolId: cmd.schoolId,
          assessmentSessionId: cmd.sessionId,
          studentProfileId: student.studentProfileId,
          classId: group.classId,
          code,
          generatedByUserId: cmd.actorUserId,
        });
      }
    }

    if (toCreate.length === 0) {
      throw new NoStudentsInSessionError();
    }

    await this.anonymatRepo.replaceCodesForSession(cmd.sessionId, toCreate);
    await this.sessionRepo.update(session);

    return { codesCount: toCreate.length };
  }
}