import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface AssignerEnseignantCommande {
  teacherUserId: string;
  matiereId: string;
  schoolId: string;
  demandeurRole: string;
  action: 'ASSIGNER' | 'RETIRER';
}

export class AssignerEnseignantMatiereUseCase {
  constructor(
    private readonly matiereRepository: MatiereRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: AssignerEnseignantCommande): Promise<void> {
    const enseignant = await this.userRepository.findById(commande.teacherUserId);
    if (!enseignant) throw new Error('Enseignant introuvable');
    if (!enseignant.estEnseignant()) {
      throw new Error(`"${enseignant.nomComplet}" n'est pas un enseignant`);
    }
    if (enseignant.schoolId !== commande.schoolId) {
      throw new Error("Cet enseignant n'appartient pas à votre établissement");
    }

    const matiere = await this.matiereRepository.findById(commande.matiereId);
    if (!matiere || matiere.schoolId !== commande.schoolId) {
      throw new Error('Matière introuvable dans votre établissement');
    }

    if (commande.action === 'ASSIGNER') {
      const dejaAssigne = await this.matiereRepository.estEnseignantAssigne(
        commande.teacherUserId,
        commande.matiereId
      );
      if (dejaAssigne) {
        throw new Error(
          `"${enseignant.nomComplet}" est déjà assigné à cette matière`
        );
      }
      await this.matiereRepository.assignerEnseignant(
        commande.teacherUserId,
        commande.matiereId
      );
    } else {
      await this.matiereRepository.retirerEnseignant(
        commande.teacherUserId,
        commande.matiereId
      );
    }
  }
}
