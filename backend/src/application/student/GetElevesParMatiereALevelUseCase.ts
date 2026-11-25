import type { StudentAffectationRepository } from '@domain/ports/repositories/StudentAffectationRepository';

/**
 * Regroupement A-Level : tous les élèves ayant une matière A-Level donnée dans leur sélection,
 * potentiellement issus de plusieurs classes (équivalent A-Level de la logique de regroupement LV2).
 * Sert à la saisie de notes et présences par matière sur les créneaux électifs.
 */
export interface EleveALevel {
  id: string;          // userId
  firstName: string;
  lastName: string;
  className: string | null;
}

export interface GetElevesParMatiereResultat {
  subjectId: string;
  subjectName: string;
  eleves: EleveALevel[];
}

export class GetElevesParMatiereALevelUseCase {
  constructor(private readonly affectationRepository: StudentAffectationRepository) {}

  async execute(subjectId: string, schoolId: string, classId?: string): Promise<GetElevesParMatiereResultat> {
    const subject = await this.affectationRepository.trouverMatiere(subjectId, schoolId);
    if (!subject) throw new Error('Matière introuvable dans cet établissement');

    const eleves = await this.affectationRepository.listerElevesParMatiereALevel(subjectId, schoolId, classId);

    return { subjectId: subject.id, subjectName: subject.name, eleves };
  }
}
