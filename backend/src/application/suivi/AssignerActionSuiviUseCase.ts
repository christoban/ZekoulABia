import type { SuiviRBACRepository } from '@domain/ports/repositories/SuiviRBACRepository';
import type { StudentFollowUpRepository, FollowUpActionDetail } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { AppelantSuivi } from './CreerActionSuiviEleveUseCase';
import { PERMISSIONS_CONSEILLER } from './CreerActionSuiviEleveUseCase';

export interface AssignerActionSuiviCommande {
  appelant: AppelantSuivi;
  actionId: string;
  nouvelAssigneId: string;
}

/**
 * Rôle autorisé (B.4) : quiconque porte la permission VALIDATE_GRADES — PAS un contrôle par
 * titre "Censeur" (cohérent avec le principe du code : jamais de vérification par titre, voir
 * StaffPermissionRules.ts). En pratique, VALIDATE_GRADES est aussi portée par Directeur Adjoint
 * (primaire FR), Vice-Principal (secondaire EN) et Deputy Head Teacher (primaire EN) — n'importe
 * lequel de ces titres peut donc réassigner une action, pas seulement le Censeur. Le nom de
 * variable `estCenseur` ci-dessous est un raccourci pour "le cas le plus fréquent", pas une
 * description exacte de la règle — ne pas s'y fier pour deviner qui a réellement le droit.
 *
 * Revérifié contre la spec exacte et définitive (relecture juillet 2026) qui retire au Censeur
 * toute capacité de CRÉATION d'action (observation/entretien/convocation/signalement, voir
 * CreerActionSuiviEleveUseCase) : réassigner n'est pas créer une nouvelle action, c'est une
 * capacité administrative de dispatch cohérente avec son rôle de supervision d'ensemble
 * ("notifié seulement... aucune action déclenchable" concerne les 4 types d'action de suivi, pas
 * la réattribution d'un cas déjà signalé par le PP vers un autre conseiller). Volontairement pas
 * changé.
 */
export class AssignerActionSuiviUseCase {
  constructor(
    private readonly repo: StudentFollowUpRepository,
    private readonly suiviRBACRepository: SuiviRBACRepository,
  ) {}

  async execute(cmd: AssignerActionSuiviCommande): Promise<FollowUpActionDetail> {
    const role = cmd.appelant.role.toUpperCase();
    const estCenseur = role === 'STAFF' && (cmd.appelant.permissions ?? []).includes('VALIDATE_GRADES');
    if (!estCenseur) {
      throw new Error('Seul un membre du personnel habilité à valider les notes peut réassigner une action de suivi');
    }

    const action = await this.repo.findById(cmd.actionId, cmd.appelant.schoolId);
    if (!action) throw new Error('Action de suivi introuvable');
    if (action.status === 'CLOS') throw new Error('Impossible de réassigner une action déjà clôturée');

    // nouvelAssigneId vient du corps de la requête — jamais fait confiance sans vérification :
    // même contrôle que CreerActionSuiviEleveUseCase (SIGNALEMENT_CONSEILLER) pour éviter de
    // réattribuer un cas à un utilisateur non-conseiller ou d'une autre école, qui hériterait
    // alors de la capacité "conseiller escaladé" et recevrait une notification exposant le nom de
    // l'élève (trouvé en revue de code — même classe de vulnérabilité que la création).
    const destinataireValide = await this.suiviRBACRepository.verifierDestinataireConseiller(cmd.nouvelAssigneId, cmd.appelant.schoolId);
    if (!destinataireValide) {
      throw new Error('Le nouveau destinataire n\'est pas un conseiller pédagogique valide de votre établissement');
    }

    return this.repo.reassign(cmd.actionId, cmd.nouvelAssigneId);
  }
}
