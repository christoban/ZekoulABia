/**
 * APPLICATION LAYER — Use Case : Désigner ou retirer la désignation AP
 * Un enseignant (TEACHER) peut être désigné Animateur Pédagogique (AP / HOD).
 * Mécanisme : création d'un StaffProfile avec les permissions AP + mise à jour
 * de TeacherProfile.supervisedSubjectIds.
 */
import type { StaffProfileRepository } from '@domain/ports/repositories/StaffProfileRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { getPermissionsPourTitre } from '@domain/rules/StaffPermissionRules';

export interface DesignerAPCommande {
  userId: string;
  schoolId: string;
  demandeurRole: string;
  departmentSubjectIds: string[];
  action: 'ASSIGN' | 'REMOVE';
}

export class DesignerAPUseCase {
  constructor(
    private readonly staffProfileRepository: StaffProfileRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(commande: DesignerAPCommande): Promise<void> {
    if (commande.demandeurRole !== 'ADMIN') {
      throw new Error('Accès refusé : seul un Admin peut désigner un Animateur Pédagogique');
    }

    const user = await this.staffProfileRepository.findUserPourDesignationAP(commande.userId);

    if (!user) throw new Error('Utilisateur introuvable');
    if (user.schoolId !== commande.schoolId) {
      throw new Error("Accès refusé : cet utilisateur n'appartient pas à votre établissement");
    }
    if (user.role !== 'TEACHER') {
      throw new Error(
        `"${user.firstName} ${user.lastName}" n'est pas un enseignant — seul un TEACHER peut être désigné AP`
      );
    }

    const apPermissions = getPermissionsPourTitre('Animateur Pédagogique');

    if (commande.action === 'ASSIGN') {
      await this.staffProfileRepository.assignerAP(commande.userId, commande.schoolId, apPermissions, commande.departmentSubjectIds);

      void this.activityLog.log({
        userId: commande.userId,
        schoolId: commande.schoolId,
        action: 'Permission AP assignée',
        details: JSON.stringify({ userId: commande.userId, permissions: apPermissions, departmentSubjectIds: commande.departmentSubjectIds }),
      });
    } else {
      await this.staffProfileRepository.retirerAP(commande.userId, apPermissions);

      void this.activityLog.log({
        userId: commande.userId,
        schoolId: commande.schoolId,
        action: 'Permission AP retirée',
        details: JSON.stringify({ userId: commande.userId }),
      });
    }
  }
}
