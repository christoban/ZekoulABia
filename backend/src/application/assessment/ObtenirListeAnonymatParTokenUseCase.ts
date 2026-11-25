import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
import { hashMagicToken } from '@domain/services/MagicTokenGenerator';
import { InvalidMagicTokenError } from '@domain/errors/AnonymatErrors';
import type { AnonymatListRow } from '@domain/ports/repositories/AnonymatRepository';

export type ListeAnonymatResult = {
  memberId: string;
  sessionId: string;
  status: 'IN_PROGRESS' | 'DONE' | 'PENDING' | 'EXPIRED';
  expiresAt: Date;
  rows: AnonymatListRow[];
};

export class ObtenirListeAnonymatParTokenUseCase {
  constructor(private readonly anonymatRepo: AnonymatRepository) {}

  async execute(rawToken: string): Promise<ListeAnonymatResult> {
    const member = await this.anonymatRepo.findTeamMemberByTokenHash(
      hashMagicToken(rawToken),
    );

    if (!member) throw new InvalidMagicTokenError('TOKEN_INVALID');
    if (member.magicTokenExpiresAt.getTime() < Date.now()) {
      throw new InvalidMagicTokenError('TOKEN_EXPIRED');
    }
    if (member.status === 'DONE') {
      throw new InvalidMagicTokenError('ALREADY_DONE');
    }
    if (member.status === 'EXPIRED') {
      throw new InvalidMagicTokenError('TOKEN_EXPIRED');
    }

    if (member.status === 'PENDING') {
      await this.anonymatRepo.updateTeamMemberStatus(member.id, 'IN_PROGRESS');
    }

    const rows = await this.anonymatRepo.getOrderedListForMember(member.id);

    return {
      memberId: member.id,
      sessionId: member.assessmentSessionId,
      status: member.status === 'PENDING' ? 'IN_PROGRESS' : member.status,
      expiresAt: member.magicTokenExpiresAt,
      rows,
    };
  }
}