import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
import type { AnonymatInvitationPort } from '@domain/ports/services/AnonymatInvitationPort';
import type { AnonymatLinkGeneratorPort } from '@domain/ports/services/AnonymatLinkGeneratorPort';
import type { LoggerPort } from '@domain/ports/services/LoggerPort';
import { generateMagicToken } from '@domain/services/MagicTokenGenerator';
import { splitClassesAmongMembers } from '@domain/services/AnonymatTeamSplitter';
import { canManageAnonymat } from '@domain/rules/AnonymatRules';
import {
  ForbiddenAnonymatError,
  SessionNotFoundError,
  SessionNotAnonymizedError,
  AnonymatDomainError,
} from '@domain/errors/AnonymatErrors';

export type TeamMemberInput =
  | { type: 'USER'; userId: string; email: string | null }
  | { type: 'EMAIL'; email: string };

export interface DesignerEquipeAnonymatCommande {
  schoolId: string;
  sessionId: string;
  actorUserId: string;
  actorRole: string;
  actorStaffPermissions?: readonly string[];
  members: TeamMemberInput[];
  classIds: string[];
  schoolName: string;
  tokenValidityHours?: number;
}

export class DesignerEquipeAnonymatUseCase {
  constructor(
    private readonly sessionRepo: HarmonizedAssessmentSessionRepository,
    private readonly anonymatRepo: AnonymatRepository,
    private readonly invitation: AnonymatInvitationPort,
    private readonly linkGenerator: AnonymatLinkGeneratorPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(cmd: DesignerEquipeAnonymatCommande): Promise<{ membersCreated: number }> {
    if (!canManageAnonymat({
      role: cmd.actorRole,
      staffPermissions: cmd.actorStaffPermissions,
    })) {
      throw new ForbiddenAnonymatError();
    }

    const session = await this.sessionRepo.findById(cmd.sessionId, cmd.schoolId);
    if (!session) throw new SessionNotFoundError();
    if (!session.isAnonymized) throw new SessionNotAnonymizedError();

    if (cmd.members.length === 0) {
      throw new AnonymatDomainError('Aucun membre désigné', 'NO_MEMBERS');
    }

    session.marquerEquipeDesignee(); // valide CODES_GENERES | EQUIPE_DESIGNEE

    const groups = await this.anonymatRepo.findStudentsForSessionGroupedByClass({
      schoolId: cmd.schoolId,
      classIds: cmd.classIds,
    });

    const classBlocks = groups.map((g) => ({
      classId: g.classId,
      className: g.className,
      studentCount: g.students.length,
    }));

    const splits = splitClassesAmongMembers(classBlocks, cmd.members.length);
    const validityMs = (cmd.tokenValidityHours ?? 48) * 60 * 60 * 1000;

    const toCreate: Array<{
      schoolId: string;
      assessmentSessionId: string;
      userId: string | null;
      email: string | null;
      magicTokenHash: string;
      magicTokenExpiresAt: Date;
      assignedClassIds: string[];
      classSliceStart: number | null;
      classSliceEnd: number | null;
    }> = [];

    const invites: Array<{ email: string; rawToken: string; expiresAt: Date }> = [];

    for (let i = 0; i < cmd.members.length; i++) {
      const member = cmd.members[i];
      const split = splits[i];
      if (!split || split.assignedClassIds.length === 0) continue;

      const { rawToken, tokenHash, expiresAt } = generateMagicToken(validityMs);
      const email =
        member.type === 'EMAIL' ? member.email : member.email;

      toCreate.push({
        schoolId: cmd.schoolId,
        assessmentSessionId: cmd.sessionId,
        userId: member.type === 'USER' ? member.userId : null,
        email,
        magicTokenHash: tokenHash,
        magicTokenExpiresAt: expiresAt,
        assignedClassIds: split.assignedClassIds,
        classSliceStart: split.classSliceStart ?? null,
        classSliceEnd: split.classSliceEnd ?? null,
      });

      if (email) {
        invites.push({ email, rawToken, expiresAt });
      }
    }

    await this.anonymatRepo.createTeamMembers(toCreate);
    await this.sessionRepo.update(session);

    for (const inv of invites) {
      const listUrl = this.linkGenerator.buildListUrl(inv.rawToken);
      try {
        await this.invitation.envoyerInvitationAnonymat({
          email: inv.email,
          listUrl,
          schoolName: cmd.schoolName,
          expiresAt: inv.expiresAt,
        });
      } catch (err) {
        this.logger.error('[Anonymat] Échec envoi invitation équipe', err);
      }
    }

    return { membersCreated: toCreate.length };
  }
}