/**
 * APPLICATION — Use case : Activer / Désactiver la gestion des inscriptions par l'Admin
 *
 * Permet au Proveneur / Proviseur (ADMIN) de basculer l'option adminGereInscriptions
 * sur l'établissement. La bascule est tracée dans ActivitiesLog sans nécessiter de justification.
 */
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export interface ChangerGestionInscriptionsAdminCommande {
  schoolId: string;
  adminUserId: string;
  actif: boolean;
}

export class ChangerGestionInscriptionsAdminUseCase {
  constructor(
    private readonly schoolRepository: SchoolRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(cmd: ChangerGestionInscriptionsAdminCommande): Promise<{ success: boolean; adminGereInscriptions: boolean }> {
    await this.schoolRepository.updateAdminGereInscriptions(cmd.schoolId, cmd.actif);

    const action = cmd.actif ? 'INSCRIPTIONS_ADMIN_GESTION_ACTIVEE' : 'INSCRIPTIONS_ADMIN_GESTION_DESACTIVEE';
    const details = cmd.actif
      ? 'Activation de la gestion directe des inscriptions par l’Admin'
      : 'Désactivation de la gestion directe des inscriptions par l’Admin (mode consultation seule)';

    await this.activityLog.log({
      userId: cmd.adminUserId,
      schoolId: cmd.schoolId,
      action,
      details,
    });

    return {
      success: true,
      adminGereInscriptions: cmd.actif,
    };
  }
}
