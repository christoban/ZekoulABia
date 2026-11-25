import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import type { AssessmentScopeRepository } from '@domain/ports/repositories/AssessmentScopeRepository';
import { canManageAnonymat } from '@domain/rules/AnonymatRules';
import {
  ForbiddenAnonymatError,
  SessionNotFoundError,
  SessionNotAnonymizedError,
  CorrectionNotReadyError,
} from '@domain/errors/AnonymatErrors';

export interface AssignerCorrectionAnonymatCommande {
  schoolId: string;
  sessionId: string;
  actorUserId: string;
  actorRole: string;
  actorStaffPermissions?: readonly string[];
  assignments?: Array<{ classId: string; correcteurUserId: string }>;
  classIds: string[];
}

export class AssignerCorrectionAnonymatUseCase {
  constructor(
    private readonly sessionRepo: HarmonizedAssessmentSessionRepository,
    private readonly anonymatRepo: AnonymatRepository,
    private readonly rattachementRepo: RattachementEnseignantRepository,
    private readonly assessmentScopeRepo: AssessmentScopeRepository,
  ) {}

  async execute(cmd: AssignerCorrectionAnonymatCommande): Promise<{ assignmentsCount: number }> {
    if (!canManageAnonymat({
      role: cmd.actorRole,
      staffPermissions: cmd.actorStaffPermissions,
    })) {
      throw new ForbiddenAnonymatError();
    }

    const session = await this.sessionRepo.findById(cmd.sessionId, cmd.schoolId);
    if (!session) throw new SessionNotFoundError();
    if (!session.isAnonymized) throw new SessionNotAnonymizedError();

    const statusOk = (
      session.anonymatStatus === 'ANONYMISATION_TERMINEE' ||
      session.anonymatStatus === 'EN_CORRECTION' ||
      session.anonymatStatus === 'CORRECTION_TERMINEE'
    );
    if (!statusOk) throw new CorrectionNotReadyError();

    const scope = await this.assessmentScopeRepo.findById(session.assessmentScopeId, cmd.schoolId);
    if (!scope) throw new CorrectionNotReadyError();

    if (session.correctionMode === 'OWN_CLASS') {
      const classIds =
        cmd.classIds.length > 0 ? cmd.classIds : [session.classId];

      const assignments: Array<{
        schoolId: string;
        classId: string;
        correcteurUserId: string;
        assignedByUserId: string;
      }> = [];

      for (const classId of classIds) {
        const affectations = await this.rattachementRepo.listerAffectations(
          classId,
          cmd.schoolId,
        );
        const forSubject = affectations.filter(
          (a) => a.subjectId === session.subjectId,
        );
        for (const a of forSubject) {
          assignments.push({
            schoolId: cmd.schoolId,
            classId: classId, 
            correcteurUserId: a.teacherId,
            assignedByUserId: cmd.actorUserId,
          });
        }
      }

      if (assignments.length === 0) {
        throw new CorrectionNotReadyError();
      }

      await this.anonymatRepo.replaceCorrectionAssignments(
        cmd.sessionId,
        assignments,
      );
    } else {
      if (!cmd.assignments || cmd.assignments.length === 0) {
        throw new CorrectionNotReadyError();
      }

      const enseignants = await this.rattachementRepo.listerEnseignantsEligibles(
        cmd.schoolId,
        session.subjectId,
      );
      const eligibleIds = new Set(enseignants.map((e) => e.id));

      for (const assignment of cmd.assignments) {
        if (!eligibleIds.has(assignment.correcteurUserId)) {
          throw new CorrectionNotReadyError();
        }
      }

      await this.anonymatRepo.replaceCorrectionAssignments(
        cmd.sessionId,
        cmd.assignments.map((a) => ({
          schoolId: cmd.schoolId,
          classId: a.classId,
          correcteurUserId: a.correcteurUserId,
          assignedByUserId: cmd.actorUserId,
        })),
      );
    }

    session.marquerEnCorrection();
    await this.sessionRepo.update(session);

    return { assignmentsCount: session.correctionMode === 'OWN_CLASS'
      ? (await this.anonymatRepo.findCorrectionAssignments(cmd.sessionId)).length
      : cmd.assignments!.length };
  }
}
