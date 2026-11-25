import type { MatiereRepository, MatiereProps } from '@domain/ports/repositories/MatiereRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface CreerMatiereCommande {
  schoolId: string;
  name: string;
  code?: string;
  coefficient?: number;
  hoursPerWeek?: number;
  subjectType?: 'THEORETICAL' | 'PRACTICAL' | 'MIXED';
  teacherUserIds?: string[];
  demandeurRole: string;
}

export interface CreerMatiereResultat {
  matiereId: string;
  name: string;
}

export class CreerMatiereUseCase {
  constructor(
    private readonly matiereRepository: MatiereRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: CreerMatiereCommande): Promise<CreerMatiereResultat> {
    if (commande.demandeurRole !== 'ADMIN') {
      throw new Error('Seul un Admin peut créer une matière');
    }

    if (commande.code?.trim()) {
      const codeExiste = await this.matiereRepository.existsByCode(
        commande.schoolId,
        commande.code
      );
      if (codeExiste) {
        throw new Error(
          `Une matière avec le code "${commande.code}" existe déjà dans cet établissement`
        );
      }
    }

    if (commande.teacherUserIds?.length) {
      for (const userId of commande.teacherUserIds) {
        const enseignant = await this.userRepository.findById(userId);
        if (!enseignant || !enseignant.estEnseignant()) {
          throw new Error(`L'utilisateur ${userId} n'est pas un enseignant valide`);
        }
        if (enseignant.schoolId !== commande.schoolId) {
          throw new Error(`L'enseignant ${userId} n'appartient pas à cet établissement`);
        }
      }
    }

    const matiere: MatiereProps = {
      id: crypto.randomUUID(),
      schoolId: commande.schoolId,
      name: commande.name.trim(),
      code: commande.code?.trim(),
      coefficient: commande.coefficient ?? 1,
      hoursPerWeek: commande.hoursPerWeek ?? 2,
      subjectType: commande.subjectType ?? 'THEORETICAL',
    };

    await this.matiereRepository.save(matiere);

    if (commande.teacherUserIds?.length) {
      await this.matiereRepository.syncEnseignants(matiere.id, commande.teacherUserIds);
    }

    return { matiereId: matiere.id, name: matiere.name };
  }
}
