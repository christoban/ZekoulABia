import type { SuiviRBACRepository } from '@domain/ports/repositories/SuiviRBACRepository';
import type { StudentFollowUpRepository, FollowUpActionDetail } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { AppelantSuivi } from './CreerActionSuiviEleveUseCase';

/**
 * Historique des actions de suivi d'un élève (B.5.3), avec le garde-fou de confidentialité de
 * B.7 appliqué à deux niveaux :
 * 1. Un gate large — le rôle de l'appelant lui donne-t-il un motif légitime de consulter la
 *    fiche de CET élève (même principe que AIController.estAutoriseAVoirRisqueEleve) ?
 * 2. Un filtre ligne par ligne — même si le gate large passe, chaque action individuelle ne
 *    reste visible que pour son créateur, la personne assignée, ou un rôle habilité (censeur,
 *    admin) — un professeur principal ne voit pas l'observation d'un collègue sur le même élève.
 */
export class ListerHistoriqueSuiviEleveUseCase {
  constructor(
    private readonly repo: StudentFollowUpRepository,
    private readonly suiviRBACRepository: SuiviRBACRepository,
  ) {}

  async execute(appelant: AppelantSuivi, studentId: string): Promise<FollowUpActionDetail[]> {
    const profile = await this.suiviRBACRepository.trouverProfileEleve(studentId, appelant.schoolId);
    if (!profile) throw new Error('Élève introuvable');
    const classId = profile.classId;

    if (!(await this.peutConsulterFiche(appelant, classId))) {
      throw new Error('Vous n\'avez pas accès au suivi de cet élève');
    }

    const toutes = await this.repo.listForStudent(profile.id, appelant.schoolId);
    const estRoleHabilite = this.estRoleHabilite(appelant);

    return toutes.filter(
      (a) => estRoleHabilite || a.createdById === appelant.userId || a.assignedToId === appelant.userId,
    );
  }

  private estRoleHabilite(appelant: AppelantSuivi): boolean {
    const role = appelant.role.toUpperCase();
    if (role === 'ADMIN') return true;
    return role === 'STAFF' && (appelant.permissions ?? []).includes('VALIDATE_GRADES');
  }

  private async peutConsulterFiche(appelant: AppelantSuivi, studentClassId: string | null): Promise<boolean> {
    const role = appelant.role.toUpperCase();

    if (role === 'ADMIN') return true;

    if (role === 'STAFF') {
      const perms = appelant.permissions ?? [];
      return perms.includes('VALIDATE_GRADES') || perms.includes('MANAGE_ORIENTATION') || perms.includes('MANAGE_PEDAGOGICAL_BRIEF');
    }

    if (role === 'TEACHER') {
      if (!studentClassId) return false;
      const [estEnseignant, estProfPrincipal] = await Promise.all([
        this.suiviRBACRepository.verifierEnseignantClasse(appelant.userId, studentClassId),
        this.suiviRBACRepository.verifierProfPrincipal(studentClassId, appelant.userId),
      ]);
      return estEnseignant || estProfPrincipal;
    }

    return false;
  }
}
