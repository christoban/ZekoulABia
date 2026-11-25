/**
 * APPLICATION LAYER — Use Case : Réinitialiser le MFA d'un utilisateur bloqué
 * Débloque un compte Admin/Staff/Teacher ayant perdu l'accès à son authenticator
 * ET à ses codes de récupération. Geste sensible — l'audit reste dans le controller.
 */
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import { MasterAdminNotFoundError, MasterAdminValidationError } from './errors';

export interface ReinitialiserMfaResultat {
  userId: string;
  userRole: string;
  userEmail: string;
  schoolName: string;
}

export class ReinitialiserMfaUtilisateurUseCase {
  constructor(
    private readonly queryRepo: MasterAdminQueryRepository,
  ) {}

  async execute(subdomain: string, email: string): Promise<ReinitialiserMfaResultat> {
    const school = await this.queryRepo.findSchoolBySubdomain(subdomain.toLowerCase().trim());
    if (!school) throw new MasterAdminNotFoundError('Établissement introuvable');

    const user = await this.queryRepo.findUserForMfaReset(school.id, email.toLowerCase().trim());
    if (!user) throw new MasterAdminNotFoundError('Compte introuvable dans cet établissement');
    if (!user.mfaEnabled) {
      throw new MasterAdminValidationError('Le MFA de ce compte n\'est pas actif — rien à réinitialiser.');
    }

    await this.queryRepo.reinitialiserMfa(user.id);

    return { userId: user.id, userRole: user.role, userEmail: email, schoolName: school.name };
  }
}
