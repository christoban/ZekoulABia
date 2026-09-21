/**
 * APPLICATION — Use case : Renvoyer un onboarding élève au secrétariat avec un commentaire.
 *
 * Réservé à l'administrateur. Fait passer le statut de SUBMITTED à RETURNED.
 * Le secrétariat voit le dossier dans ses éléments « À compléter », lit le commentaire,
 * corrige les informations, et peut le re-soumettre pour validation.
 */
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';

export interface RenvoyerOnboardingCommande {
  schoolId: string;
  onboardingId: string;
  adminId: string;
  adminRole: string;
  commentaire: string;
}

export interface RenvoyerOnboardingResultat {
  onboardingId: string;
  status: 'RETURNED';
  commentaire: string;
}

export class RenvoyerOnboardingUseCase {
  constructor(private readonly eleveOnboardingRepository: EleveOnboardingRepository) {}

  async execute(cmd: RenvoyerOnboardingCommande): Promise<RenvoyerOnboardingResultat> {
    if (cmd.adminRole !== 'ADMIN') {
      throw new Error('Seul l’administrateur peut renvoyer un dossier au secrétariat.');
    }

    if (!cmd.commentaire?.trim()) {
      throw new Error('Un commentaire expliquant le motif du renvoi est obligatoire.');
    }

    const onboarding = await this.eleveOnboardingRepository.findOnboardingById(cmd.onboardingId, cmd.schoolId);
    if (!onboarding) throw new Error('Dossier introuvable');

    if (onboarding.status !== 'SUBMITTED') {
      throw new Error(
        `Seul un dossier soumis pour validation (statut SUBMITTED) peut être renvoyé au secrétariat (statut actuel : ${onboarding.status}).`,
      );
    }

    await this.eleveOnboardingRepository.renvoyerOnboarding(onboarding.id, {
      commentaire: cmd.commentaire.trim(),
      adminId: cmd.adminId,
    });

    return {
      onboardingId: onboarding.id,
      status: 'RETURNED',
      commentaire: cmd.commentaire.trim(),
    };
  }
}
