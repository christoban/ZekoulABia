import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { ClasseCoefficientRepository } from '@domain/ports/repositories/ClasseCoefficientRepository';
import { CYCLE2_LEVELS, parseSerie } from '@application/school/SubjectAssignmentHelper';

export interface AjouterMatiereClasseCommande {
  schoolId: string;
  classId: string;
  subjectId: string;
  coefficient: number;
  classOnly?: boolean;
}

export interface SupprimerMatiereClasseCommande {
  schoolId: string;
  classId: string;
  subjectId: string;
}

function deriverSerieCode(classe: { level?: string | null; serie?: string | null; filiere?: string | null; name: string }): string | null {
  return (
    classe.serie ??
    classe.filiere ??
    (classe.level && (CYCLE2_LEVELS as string[]).includes(classe.level) ? parseSerie(classe.name ?? '', classe.level) : null)
  );
}

export class GererMatiereClasseUseCase {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly coefficientRepository: ClasseCoefficientRepository,
  ) {}

  async ajouter(commande: AjouterMatiereClasseCommande): Promise<Record<string, unknown>> {
    const { schoolId, classId, subjectId, coefficient, classOnly } = commande;

    if (!subjectId || coefficient == null) {
      throw new Error('subjectId et coefficient requis');
    }

    const classe = await this.classeRepository.findById(classId);
    if (!classe || classe.schoolId !== schoolId) {
      throw new Error('Classe introuvable');
    }

    const existingOverride = await this.coefficientRepository.findOverride(classId, subjectId);

    if (classOnly || existingOverride) {
      const override = await this.coefficientRepository.upsertOverride({
        schoolId,
        classId,
        subjectId,
        coefficient,
      });
      return { ...override, classOnly: true };
    }

    const serieCode = deriverSerieCode({
      level: classe.level,
      serie: classe.serie,
      filiere: classe.filiere,
      name: classe.name,
    });

    const coeff = await this.coefficientRepository.upsertCoefficient({
      schoolId,
      subjectId,
      classLevel: classe.level ?? '',
      serieCode,
      coefficient,
    });

    return { ...coeff, classOnly: false };
  }

  async supprimer(commande: SupprimerMatiereClasseCommande): Promise<{ message: string }> {
    const { schoolId, classId, subjectId } = commande;

    const existingOverride = await this.coefficientRepository.findOverride(classId, subjectId);
    if (existingOverride) {
      await this.coefficientRepository.deleteOverride(classId, subjectId);
      return { message: 'Matière spécifique retirée de cette classe' };
    }

    const classe = await this.classeRepository.findById(classId);
    if (!classe || classe.schoolId !== schoolId) {
      throw new Error('Classe introuvable');
    }

    const serieCode = deriverSerieCode({
      level: classe.level,
      serie: classe.serie,
      filiere: classe.filiere,
      name: classe.name,
    });

    await this.coefficientRepository.deleteCoefficientsForSubject({
      schoolId,
      subjectId,
      classLevel: classe.level ?? '',
      serieCode,
    });

    return { message: 'Matière retirée de la classe' };
  }
}
