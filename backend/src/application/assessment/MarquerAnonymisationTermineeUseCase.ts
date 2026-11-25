import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import { hashMagicToken } from '@domain/services/MagicTokenGenerator';
import {
  InvalidMagicTokenError,
  SessionNotFoundError,
} from '@domain/errors/AnonymatErrors';

export class MarquerAnonymisationTermineeUseCase {
  constructor(
    private readonly anonymatRepo: AnonymatRepository,
    private readonly sessionRepo: HarmonizedAssessmentSessionRepository,
  ) {}

  async execute(rawToken: string): Promise<{ allDone: boolean }> {
    const member = await this.anonymatRepo.findTeamMemberByTokenHash(
      hashMagicToken(rawToken),
    );

    if (!member) throw new InvalidMagicTokenError('TOKEN_INVALID');
    if (member.magicTokenExpiresAt.getTime() < Date.now()) {
      throw new InvalidMagicTokenError('TOKEN_EXPIRED');
    }
    if (member.status === 'DONE') {
      return { allDone: false };
    }

    await this.anonymatRepo.updateTeamMemberStatus(member.id, 'DONE', new Date());

    const remaining = await this.anonymatRepo.countTeamMembersNotDone(
      member.assessmentSessionId,
    );

    const session = await this.sessionRepo.findById(
      member.assessmentSessionId,
      member.schoolId,
    );
    if (!session) throw new SessionNotFoundError();

    if (remaining === 0) {
      session.marquerAnonymisationTerminee();
      await this.sessionRepo.update(session);
      return { allDone: true };
    }

    session.marquerAnonymisationEnCours();
    await this.sessionRepo.update(session);
    return { allDone: false };
  }
}