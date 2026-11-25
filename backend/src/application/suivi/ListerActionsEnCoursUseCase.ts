import type { StudentFollowUpRepository, FollowUpActionDetail } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { AppelantSuivi } from './CreerActionSuiviEleveUseCase';

/**
 * "Mes actions de suivi" (B.5.2) — étend volontairement B.4 au-delà de "Censeur, Conseiller
 * pédagogique" : un Professeur principal ou un enseignant de matière qui crée une action
 * s'assigne lui-même par défaut (voir CreerActionSuiviEleveUseCase) et doit pouvoir la retrouver
 * pour la clôturer, sinon elle reste indéfiniment invisible malgré B.5.2 ("assignées à
 * l'utilisateur connecté", sans restriction de rôle). La portée "tout l'établissement" décrite
 * dans le tableau de B.4 pour "le Censeur" est en réalité accordée à quiconque porte
 * VALIDATE_GRADES — pas un contrôle par titre (StaffPermissionRules.ts) : Directeur Adjoint
 * (primaire FR), Vice-Principal (secondaire EN) et Deputy Head Teacher (primaire EN) portent
 * aussi cette permission et ont donc la même portée, pas seulement le Censeur. Les autres rôles
 * ne voient que les leurs.
 */
export class ListerActionsEnCoursUseCase {
  constructor(private readonly repo: StudentFollowUpRepository) {}

  async execute(appelant: AppelantSuivi): Promise<FollowUpActionDetail[]> {
    const role = appelant.role.toUpperCase();
    const perms = appelant.permissions ?? [];

    if (role === 'STAFF' && perms.includes('VALIDATE_GRADES')) {
      return this.repo.listOpen(appelant.schoolId, {}); // VALIDATE_GRADES — vue établissement, tous titres porteurs confondus
    }

    if (role === 'TEACHER' || (role === 'STAFF' && (perms.includes('MANAGE_ORIENTATION') || perms.includes('MANAGE_PEDAGOGICAL_BRIEF')))) {
      return this.repo.listOpen(appelant.schoolId, { assignedToId: appelant.userId });
    }

    throw new Error('Vous n\'avez pas accès aux actions de suivi');
  }
}
