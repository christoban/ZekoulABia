/**
 * APPLICATION — Use case : Soumettre un onboarding élève pour validation administrative.
 *
 * Appelé par le secrétariat (STAFF avec MANAGE_ENROLLMENT) ou l'administrateur
 * après avoir rempli ou complété les informations d'un dossier en DRAFT ou RETURNED.
 * Fait passer le statut à SUBMITTED.
 */
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';

export interface SoumettreOnboardingCommande {
  schoolId: string;
  onboardingId: string;
  submittedById: string;
  submitterRole: string;
  classId?: string;
  nomProvisoire?: string;
  submittedData?: Record<string, unknown>;
}

export interface SoumettreOnboardingResultat {
  onboardingId: string;
  status: 'SUBMITTED';
}

export class SoumettreOnboardingUseCase {
  constructor(private readonly eleveOnboardingRepository: EleveOnboardingRepository) {}

  async execute(cmd: SoumettreOnboardingCommande): Promise<SoumettreOnboardingResultat> {
    const onboarding = await this.eleveOnboardingRepository.findOnboardingById(cmd.onboardingId, cmd.schoolId);
    if (!onboarding) throw new Error('Dossier introuvable');

    if (onboarding.status !== 'DRAFT' && onboarding.status !== 'RETURNED') {
      throw new Error(
        `Ce dossier ne peut pas être soumis depuis son statut actuel (${onboarding.status}) — seuls les dossiers DRAFT ou RETURNED peuvent être soumis pour validation.`,
      );
    }

    await this.eleveOnboardingRepository.soumettreOnboarding(onboarding.id, {
      classId: cmd.classId,
      nomProvisoire: cmd.nomProvisoire,
      submittedData: cmd.submittedData,
      submittedById: cmd.submittedById,
      submitterRole: cmd.submitterRole,
    });

    return { onboardingId: onboarding.id, status: 'SUBMITTED' };
  }
}
