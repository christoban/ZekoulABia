import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface ModifierMatiereCommande {
  matiereId: string;
  schoolId: string;
  demandeurRole: string;
  name?: string;
  code?: string;
  coefficient?: number;
  hoursPerWeek?: number;
  subjectType?: 'THEORETICAL' | 'PRACTICAL' | 'MIXED';
  teacherUserIds?: string[];
}

export class ModifierMatiereUseCase {
  constructor(
    private readonly matiereRepository: MatiereRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: ModifierMatiereCommande): Promise<void> {
    if (commande.demandeurRole !== 'ADMIN') {
      throw new Error('Seul un Admin peut modifier une matière');
    }

    const matiere = await this.matiereRepository.findById(commande.matiereId);
    if (!matiere) throw new Error(`Matière introuvable : ${commande.matiereId}`);
    if (matiere.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : matière hors de votre établissement');
    }

    if (commande.code?.trim() && commande.code !== matiere.code) {
      const codeExiste = await this.matiereRepository.existsByCode(
        commande.schoolId,
        commande.code,
        commande.matiereId
      );
      if (codeExiste) {
        throw new Error(`Code "${commande.code}" déjà utilisé par une autre matière`);
      }
    }

    const misAJour = {
      ...matiere,
      ...(commande.name && { name: commande.name.trim() }),
      ...(commande.code !== undefined && { code: commande.code?.trim() }),
      ...(commande.coefficient !== undefined && { coefficient: commande.coefficient }),
      ...(commande.hoursPerWeek !== undefined && { hoursPerWeek: commande.hoursPerWeek }),
      ...(commande.subjectType && { subjectType: commande.subjectType }),
    };

    await this.matiereRepository.update(misAJour);

    if (commande.teacherUserIds !== undefined) {
      for (const userId of commande.teacherUserIds) {
        const enseignant = await this.userRepository.findById(userId);
        if (!enseignant?.estEnseignant() || enseignant.schoolId !== commande.schoolId) {
          throw new Error(`Enseignant invalide ou hors établissement : ${userId}`);
        }
      }
      await this.matiereRepository.syncEnseignants(commande.matiereId, commande.teacherUserIds);
    }
  }
}
