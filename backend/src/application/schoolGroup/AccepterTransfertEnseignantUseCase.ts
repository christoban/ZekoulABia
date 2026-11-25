/**
 * APPLICATION LAYER — L'Admin de l'école CIBLE accepte une demande de transfert d'enseignant
 * vacataire. Plus simple que le cas élève (pas de notes/présences à préserver au même degré) :
 * création directe d'un nouveau compte TEACHER dans l'école cible via le flux d'invitation
 * déjà existant — statut ACCEPTED immédiatement, pas d'étape de validation famille (Section 5).
 */
import type { GroupTransferRepository } from '@domain/ports/repositories/GroupTransferRepository';
import type { GroupeScolaireQueryRepository } from '@domain/ports/repositories/GroupeScolaireQueryRepository';
import { InscrireUtilisateurUseCase } from '../user/InscrireUtilisateurUseCase';

export interface AccepterTransfertEnseignantCommande {
  demandeId: string;
  targetSchoolId: string; // dérivé du token Admin, jamais du corps de la requête
}

export class AccepterTransfertEnseignantUseCase {
  constructor(
    private readonly transfertRepository: GroupTransferRepository,
    private readonly queryRepository: GroupeScolaireQueryRepository,
    private readonly inscrire: InscrireUtilisateurUseCase,
  ) {}

  async execute(cmd: AccepterTransfertEnseignantCommande) {
    const demande = await this.transfertRepository.trouverParId(cmd.demandeId);
    if (!demande) throw new Error('Demande de transfert introuvable');
    if (demande.targetSchoolId !== cmd.targetSchoolId) throw new Error('Accès refusé');
    if (demande.status !== 'PENDING_TARGET_ADMIN') throw new Error(`Cette demande est déjà au statut ${demande.status}`);
    if (demande.type !== 'STAFF') throw new Error('Cette demande ne concerne pas un enseignant');

    const sourceTeacher = await this.queryRepository.trouverSourceEnseignant(demande.sourceUserId);
    if (!sourceTeacher) throw new Error('Enseignant introuvable dans l\'école source');
    if (!sourceTeacher.email) throw new Error('Cet enseignant n\'a pas d\'email — impossible de lui envoyer un lien de création de compte');

    const resultat = await this.inscrire.execute({
      schoolId: cmd.targetSchoolId,
      role: 'TEACHER',
      email: sourceTeacher.email,
      phone: sourceTeacher.phone ?? undefined,
      firstName: sourceTeacher.firstName,
      lastName: sourceTeacher.lastName,
    });

    await this.transfertRepository.accepterEnseignant(demande.id);

    return { userId: resultat.userId, email: sourceTeacher.email, firstName: sourceTeacher.firstName, lastName: sourceTeacher.lastName };
  }
}
