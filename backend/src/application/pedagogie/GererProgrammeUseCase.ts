import type { ProgrammeRepository, ProgrammeProps } from '@domain/ports/repositories/ProgrammeRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import { PedagogieNotFoundError, PedagogieValidationError } from './errors';

export interface CreerProgrammeInput {
  schoolId: string;
  titre: string;
  subjectId: string;
  classId?: string;
  level?: string;
  academicYearId?: string;
}

export interface MettreAJourProgrammeInput {
  schoolId: string;
  id: string;
  titre?: string;
  classId?: string | null;
  level?: string | null;
}

export interface SupprimerProgrammeInput {
  schoolId: string;
  id: string;
}

export class GererProgrammeUseCase {
  constructor(
    private readonly programmeRepository: ProgrammeRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
  ) {}

  async creer(input: CreerProgrammeInput): Promise<ProgrammeProps> {
    if (!input.titre?.trim() || !input.subjectId) {
      throw new PedagogieValidationError('titre et subjectId sont requis');
    }

    const anneeId = input.academicYearId ?? (await this.anneeRepository.findCourante(input.schoolId))?.id;
    if (!anneeId) {
      throw new PedagogieValidationError('Aucune année académique active');
    }

    return this.programmeRepository.save({
      schoolId: input.schoolId,
      subjectId: input.subjectId,
      classId: input.classId ?? null,
      level: input.level ?? null,
      academicYearId: anneeId,
      titre: input.titre.trim(),
    });
  }

  async mettreAJour(input: MettreAJourProgrammeInput): Promise<ProgrammeProps> {
    const existing = await this.programmeRepository.findByIdAndSchool(input.id, input.schoolId);
    if (!existing) {
      throw new PedagogieNotFoundError('Programme introuvable');
    }

    const data: { id: string; titre?: string; classId?: string | null; level?: string | null } = { id: input.id };
    if (input.titre?.trim()) data.titre = input.titre.trim();
    if (input.classId !== undefined) data.classId = input.classId;
    if (input.level !== undefined) data.level = input.level;

    return this.programmeRepository.update(data);
  }

  async supprimer(input: SupprimerProgrammeInput): Promise<void> {
    const existing = await this.programmeRepository.findByIdAndSchool(input.id, input.schoolId);
    if (!existing) {
      throw new PedagogieNotFoundError('Programme introuvable');
    }
    await this.programmeRepository.delete(input.id);
  }
}
