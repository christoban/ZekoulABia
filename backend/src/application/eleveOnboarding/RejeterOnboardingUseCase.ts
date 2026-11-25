/**
 * APPLICATION — Use case : Rejeter un onboarding élève (doublon, erreur de saisie, etc.)
 */
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { canGererInscriptions } from '@domain/rules/EnrollmentRules';
import type { OnboardingStatus } from '@domain/types/enums';
import type { RejeterOnboardingCommande, RejeterOnboardingResultat } from './types';

export class RejeterOnboardingUseCase {
  constructor(
    private readonly eleveOnboardingRepository: EleveOnboardingRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(cmd: RejeterOnboardingCommande & { staffPermissions?: readonly string[] }): Promise<RejeterOnboardingResultat> {
    if (!cmd.rejectionReason?.trim()) throw new Error('Un motif de rejet est requis');

    const school = await this.schoolRepository.findById(cmd.schoolId);
    const adminGere = school?.adminGereInscriptions ?? false;

    const isAdmin = cmd.validatorRole === 'ADMIN';
    const hasStaffPermission = cmd.staffPermissions?.includes('MANAGE_ENROLLMENT') ?? false;

    if (!isAdmin && !hasStaffPermission && !canGererInscriptions({ role: cmd.validatorRole, staffPermissions: cmd.staffPermissions, adminGereInscriptions: adminGere })) {
      throw new Error('Vous n’avez pas les droits nécessaires pour rejeter des dossiers.');
    }

    const onboarding = await this.eleveOnboardingRepository.findOnboardingById(cmd.onboardingId, cmd.schoolId);
    if (!onboarding) throw new Error('Dossier introuvable');

    const statusValides: OnboardingStatus[] = ['SUBMITTED', 'DRAFT', 'LINK_SENT'];
    if (!statusValides.includes(onboarding.status)) {
      throw new Error(`Ce dossier ne peut pas être rejeté depuis son statut actuel (${onboarding.status})`);
    }

    await this.eleveOnboardingRepository.rejeterOnboarding(onboarding.id, {
      rejectionReason: cmd.rejectionReason,
      rejectedById: cmd.rejectedById,
      rejectedAt: new Date(),
    });

    if (onboarding.sourceType === 'GROUPE_TRANSFERT') {
      const demande = await this.eleveOnboardingRepository.findGroupTransferRequestByOnboarding(onboarding.id);
      if (demande) {
        await this.eleveOnboardingRepository.reactiverStudentProfilesTransferes(demande.sourceUserId);
      }
    }

    return { onboardingId: onboarding.id, status: 'REJECTED' };
  }
}
