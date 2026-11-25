/**
 * APPLICATION LAYER — Use Case : Renvoyer une invitation PENDING
 * Relit l'école, régénère le token (72h) sur l'invitation active.
 * L'email + l'audit restent dans le controller.
 */
import crypto from 'crypto';
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import { MasterAdminNotFoundError, MasterAdminValidationError } from './errors';

export interface RenvoyerInvitationResultat {
  email: string;
  schoolName: string;
  newToken: string;
}

export class RenvoyerInvitationEcoleUseCase {
  constructor(
    private readonly queryRepo: MasterAdminQueryRepository,
  ) {}

  async execute(schoolId: string): Promise<RenvoyerInvitationResultat> {
    const school = await this.queryRepo.findSchoolWithPendingInvite(schoolId);
    if (!school) throw new MasterAdminNotFoundError('École introuvable');

    const invite = school.invites[0];
    if (!invite) throw new MasterAdminValidationError('Aucune invitation active à renvoyer pour cette école');

    const newToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await this.queryRepo.renvoyerInvitation(invite.id, newToken, expiresAt);

    return { email: invite.email, schoolName: invite.schoolName, newToken };
  }
}
