/**
 * APPLICATION LAYER — L'Admin de l'école CIBLE accepte une demande de transfert d'élève.
 * Ne mute JAMAIS le schoolId de l'ancien User (casserait l'historique Grade/Attendance/Payment
 * du tenant source) — délègue à CreerSqueletteOnboardingUseCase, le même mécanisme de lien
 * sécurisé/validation humaine que l'onboarding classique. L'ancien compte reste intact dans
 * l'école source, marqué studentStatus=TRANSFERRED pour que son historique reste consultable
 * là où il a eu lieu (Section 5 du plan).
 */
import type { GroupTransferRepository } from '@domain/ports/repositories/GroupTransferRepository';
import type { GroupeScolaireQueryRepository } from '@domain/ports/repositories/GroupeScolaireQueryRepository';
import { CreerSqueletteOnboardingUseCase } from '../eleveOnboarding/CreerSqueletteOnboardingUseCase';

export interface AccepterTransfertEleveCommande {
  demandeId: string;
  targetSchoolId: string; // dérivé du token Admin, jamais du corps de la requête
  acceptedById: string;
}

export class AccepterTransfertEleveUseCase {
  constructor(
    private readonly transfertRepository: GroupTransferRepository,
    private readonly queryRepository: GroupeScolaireQueryRepository,
    private readonly creerSquelette: CreerSqueletteOnboardingUseCase,
  ) {}

  async execute(cmd: AccepterTransfertEleveCommande) {
    const demande = await this.transfertRepository.trouverParId(cmd.demandeId);
    if (!demande) throw new Error('Demande de transfert introuvable');
    if (demande.targetSchoolId !== cmd.targetSchoolId) throw new Error('Accès refusé');
    if (demande.status !== 'PENDING_TARGET_ADMIN') throw new Error(`Cette demande est déjà au statut ${demande.status}`);
    if (demande.type !== 'STUDENT') throw new Error('Cette demande ne concerne pas un élève');

    const sourceUser = await this.queryRepository.trouverSourceUserAvecProfil(demande.sourceUserId);
    if (!sourceUser || !sourceUser.studentProfile) throw new Error("Élève introuvable dans l'école source");

    // Suggestion de classe — best-effort par niveau, toujours éditable par l'Admin cible avant
    // que la famille ne valide (jamais une assignation automatique définitive).
    let classId: string | undefined;
    const niveau = sourceUser.studentProfile.niveau;
    if (niveau) {
      const classeCorrespondante = await this.queryRepository.trouverClasseParNiveau(cmd.targetSchoolId, niveau);
      classId = classeCorrespondante?.id;
    }

    const parentContact = sourceUser.studentProfile.parentContacts?.[0] ?? null;
    const contactEmail = parentContact?.email ?? sourceUser.email ?? null;
    const contactTelephone = parentContact?.phone ?? sourceUser.phone ?? null;
    const recipientType = parentContact ? 'PARENT' : 'ELEVE';

    const onboarding = await this.creerSquelette.execute({
      schoolId: cmd.targetSchoolId,
      createdById: cmd.acceptedById,
      nomProvisoire: `${sourceUser.firstName} ${sourceUser.lastName}`,
      classId,
      contactEmail,
      contactTelephone,
      recipientType,
      sourceType: 'GROUPE_TRANSFERT',
      aucunContactDisponible: !contactEmail && !contactTelephone,
    });

    await this.transfertRepository.accepterEleve(demande.id, onboarding.id, sourceUser.studentProfile.id);

    return { ...onboarding, nomProvisoire: `${sourceUser.firstName} ${sourceUser.lastName}` };
  }
}
