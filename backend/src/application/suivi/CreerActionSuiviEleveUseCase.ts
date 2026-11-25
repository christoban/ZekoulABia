import type { SuiviRBACRepository } from '@domain/ports/repositories/SuiviRBACRepository';
import type {
  StudentFollowUpRepository,
  FollowUpActionDetail,
  FollowUpActionType,
  InterviewMode,
} from '@domain/ports/repositories/StudentFollowUpRepository';

export interface AppelantSuivi {
  userId: string;
  schoolId: string;
  role: string;
  permissions?: string[];
}

export interface CreerActionSuiviCommande {
  appelant: AppelantSuivi;
  studentId: string; // userId de l'élève (cohérent avec le reste du code, ex. AIController)
  type: FollowUpActionType;
  triggeringRecommendationId?: string;
  subjectId?: string; // requis pour un enseignant de matière (pas professeur principal)
  assignedToId?: string;
  targetDate?: Date;
  interviewMode?: InterviewMode; // requis pour ENTRETIEN_PARENT uniquement
  note?: string;
}

/**
 * Permissions STAFF donnant l'autorité "Conseiller pédagogique/d'orientation" — deux permissions
 * distinctes selon le template :
 * - MANAGE_ORIENTATION       : Conseiller d'Orientation, Guidance Counsellor — SECONDAIRE
 *                              UNIQUEMENT, n'existe dans aucun titre primaire (cohérent, le choix
 *                              de filière n'existe pas au primaire).
 * - MANAGE_PEDAGOGICAL_BRIEF : Animateur Pédagogique (secondaire FR), Conseiller Pédagogique
 *                              (primaire FR), HOD (secondaire EN) — présent aussi bien au primaire
 *                              qu'au secondaire.
 * Volontairement PAS de vérification par titre/nom de rôle — uniquement par permission, pour
 * rester correct sur les 17 templates sans jamais coder "Conseiller pédagogique"/"Professeur
 * principal" en dur. Seul gap connu : le template EN_PRIMARY (Deputy Head Teacher/Bursar/
 * Librarian) ne provisionne aucun titre avec l'une ou l'autre de ces deux permissions —
 * SIGNALEMENT_CONSEILLER n'aura alors aucun destinataire possible pour ce template précis (pas un
 * bug de ce chantier, un gap pré-existant de StaffPermissionRules.ts pour ce template). Dans ce
 * cas comme dans tout établissement sans conseiller pédagogique configuré (~85% des
 * établissements secondaires publics camerounais), le flux s'arrête simplement au niveau du
 * professeur principal — le bouton "Signaler au conseiller" est masqué côté frontend
 * (StudentFollowUpButtons.tsx, `conseillerDisponible`).
 */
export const PERMISSIONS_CONSEILLER = ['MANAGE_ORIENTATION', 'MANAGE_PEDAGOGICAL_BRIEF'] as const;

interface Capacites {
  estProfPrincipal: boolean;
  estConseiller: boolean;
  estEnseignantMatiere: boolean; // enseignant sur la classe, sans en être professeur principal
}

/**
 * Chaîne d'escalade — spec exacte et définitive (relecture juillet 2026) :
 * - Noter une observation        : PP, Conseiller pédagogique (uniquement sur un cas déjà
 *                                   escaladé vers lui — "cas par cas, pas de veille passive sur
 *                                   toute l'école"), Enseignant de matière (restreint à sa propre
 *                                   matière). Le Censeur n'a AUCUNE action déclenchable — voir
 *                                   plus bas.
 * - Signaler au conseiller       : Professeur principal SEUL. Le Censeur est notifié mais n'agit
 *                                   jamais dans le système ("s'il juge un cas urgent, il passe par
 *                                   le professeur principal directement, hors du système") — pas
 *                                   d'entrée pour lui dans ce use case. Le Conseiller pédagogique
 *                                   ne peut jamais se signaler un cas à lui-même.
 * - Programmer un entretien parent : Professeur principal en premier lieu (contact naturel et
 *                                   habituel de la famille) ; le Conseiller pédagogique
 *                                   UNIQUEMENT sur un cas qui lui a déjà été signalé
 *                                   (SIGNALEMENT_CONSEILLER ouvert/en cours qui lui est assigné).
 * - Convoquer l'élève             : EXCLUSIF au Conseiller pédagogique, une fois le cas escaladé
 *                                   vers lui — jamais le professeur principal (pas de bureau, voit
 *                                   déjà ses élèves quotidiennement en classe ; contrairement au
 *                                   conseiller, pour qui convoquer à date fixe est la méthode de
 *                                   travail normale).
 * Dans tous les cas : une seule personne agit à la fois sur un même cas, jamais deux rôles actifs
 * en parallèle sur la même famille.
 */
export class CreerActionSuiviEleveUseCase {
  constructor(
    private readonly repo: StudentFollowUpRepository,
    private readonly suiviRBACRepository: SuiviRBACRepository,
  ) {}

  async execute(cmd: CreerActionSuiviCommande): Promise<FollowUpActionDetail> {
    const profile = await this.suiviRBACRepository.trouverProfileEleve(cmd.studentId, cmd.appelant.schoolId);
    if (!profile) throw new Error('Élève introuvable');
    const currentClassId = profile.classId;
    if (!currentClassId) throw new Error("Cet élève n'est inscrit dans aucune classe");

    const cap = await this.calculerCapacites(cmd.appelant, currentClassId);
    let subjectIdPersiste: string | undefined;

    switch (cmd.type) {
      case 'OBSERVATION': {
        let autorise = cap.estProfPrincipal || cap.estEnseignantMatiere;
        if (!autorise && cap.estConseiller) {
          autorise = await this.casEscaladeVersMoi(profile.id, cmd.appelant.userId);
        }
        if (!autorise) {
          throw new Error('Vous n\'êtes pas autorisé à créer une action de suivi pour cet élève');
        }
        if (!cmd.note?.trim()) {
          throw new Error('Une observation nécessite un texte');
        }
        if (cap.estEnseignantMatiere && !cap.estProfPrincipal) {
          if (!cmd.subjectId) {
            throw new Error('Précisez la matière concernée par votre observation');
          }
          const assignation = await this.suiviRBACRepository.verifierEnseignantMatiere(cmd.appelant.userId, currentClassId, cmd.subjectId);
          if (!assignation) {
            throw new Error('Vous n\'enseignez pas cette matière dans la classe de cet élève');
          }
          subjectIdPersiste = cmd.subjectId;
        }
        break;
      }

      case 'SIGNALEMENT_CONSEILLER': {
        if (!cap.estProfPrincipal) {
          throw new Error('Seul le professeur principal peut signaler un cas au conseiller pédagogique');
        }
        if (!cmd.assignedToId) {
          throw new Error('Un signalement au conseiller doit désigner un destinataire précis');
        }
        // Le destinataire vient du corps de la requête — jamais fait confiance sans vérification :
        // doit être un membre du personnel de LA MÊME école, porteur d'une des deux permissions
        // "conseiller". Sans ce contrôle, un appelant pourrait désigner n'importe quel utilisateur
        // (même d'une autre école) comme destinataire, qui hériterait alors de la capacité
        // "conseiller escaladé" (CONVOCATION_ELEVE, ENTRETIEN_PARENT, OBSERVATION via
        // casEscaladeVersMoi) et recevrait une notification contenant le nom de l'élève —
        // escalade de privilège + fuite de données inter-établissements (trouvé en revue de code).
        const destinataireValide = await this.suiviRBACRepository.verifierDestinataireConseiller(cmd.assignedToId, cmd.appelant.schoolId);
        if (!destinataireValide) {
          throw new Error('Le destinataire choisi n\'est pas un conseiller pédagogique valide de votre établissement');
        }
        break;
      }

      case 'ENTRETIEN_PARENT': {
        const escalade = cap.estProfPrincipal ? false : await this.casEscaladeVersMoi(profile.id, cmd.appelant.userId);
        if (!cap.estProfPrincipal && !escalade) {
          throw new Error('Programmer un entretien parent relève du professeur principal, ou du conseiller pédagogique une fois le cas signalé');
        }
        if (!cmd.interviewMode) {
          throw new Error('Précisez si vous proposez une date ou si vous demandez la disponibilité du parent');
        }
        if (!cmd.targetDate && cmd.interviewMode !== 'DEMANDE_DISPONIBILITE') {
          throw new Error('Un entretien parent nécessite une date cible');
        }
        break;
      }

      case 'CONVOCATION_ELEVE': {
        // Exclusif au conseiller pédagogique, jamais le professeur principal (voir doc de classe).
        const escalade = await this.casEscaladeVersMoi(profile.id, cmd.appelant.userId);
        if (!escalade) {
          throw new Error('Convoquer l\'élève est exclusif au conseiller pédagogique, une fois le cas signalé');
        }
        if (!cmd.targetDate) {
          throw new Error('Une convocation nécessite une date cible');
        }
        break;
      }
    }

    return this.repo.create({
      schoolId: cmd.appelant.schoolId,
      studentProfileId: profile.id,
      triggeringRecommendationId: cmd.triggeringRecommendationId,
      subjectId: subjectIdPersiste,
      type: cmd.type,
      createdById: cmd.appelant.userId,
      // assignedToId n'est un destinataire choisi par le client que pour SIGNALEMENT_CONSEILLER
      // (vérifié ci-dessus) — pour tout autre type, un assignedToId envoyé quand même dans le
      // corps de la requête est ignoré, pas persisté tel quel (défense en profondeur : même sans
      // capacité déverrouillée pour ce type, on ne veut pas notifier/exposer le nom de l'élève à
      // un tiers non vérifié). Sans destinataire explicite, l'action reste assignée à son créateur
      // — toujours rattachable à quelqu'un pour "Mes actions de suivi" (B.5.2), jamais orpheline.
      assignedToId: (cmd.type === 'SIGNALEMENT_CONSEILLER' ? cmd.assignedToId : undefined) ?? cmd.appelant.userId,
      targetDate: cmd.targetDate,
      interviewMode: cmd.type === 'ENTRETIEN_PARENT' ? cmd.interviewMode : undefined,
      note: cmd.note,
    });
  }

  /** Le Censeur n'obtient volontairement aucune capacité ici — "notifié seulement, aucune action déclenchable". */
  private async calculerCapacites(appelant: AppelantSuivi, studentClassId: string | null): Promise<Capacites> {
    const role = appelant.role.toUpperCase();
    const capacites: Capacites = { estProfPrincipal: false, estConseiller: false, estEnseignantMatiere: false };

    if (role === 'STAFF') {
      const perms = appelant.permissions ?? [];
      capacites.estConseiller = PERMISSIONS_CONSEILLER.some((p) => perms.includes(p));
      return capacites;
    }

    if (role === 'TEACHER' && studentClassId) {
      const [estProfPrincipal, estEnseignant] = await Promise.all([
        this.suiviRBACRepository.verifierProfPrincipal(studentClassId, appelant.userId),
        this.suiviRBACRepository.verifierEnseignantClasse(appelant.userId, studentClassId),
      ]);
      capacites.estProfPrincipal = estProfPrincipal;
      capacites.estEnseignantMatiere = !estProfPrincipal && estEnseignant;
    }

    return capacites;
  }

  /**
   * "Le cas m'a déjà été signalé" — un SIGNALEMENT_CONSEILLER encore ouvert/en cours sur cet
   * élève, assigné précisément à cet appelant. Volontairement indépendant de estConseiller : ce
   * qui autorise l'entretien/la convocation/l'observation à ce stade, c'est d'être le destinataire
   * réel de l'escalade, pas de porter telle ou telle permission.
   */
  private async casEscaladeVersMoi(studentProfileId: string, userId: string): Promise<boolean> {
    return this.suiviRBACRepository.verifierCasEscalade(studentProfileId, userId);
  }
}
