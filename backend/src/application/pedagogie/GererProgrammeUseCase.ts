import type { ProgrammeRepository, ProgrammeProps } from '@domain/ports/repositories/ProgrammeRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import { PedagogieNotFoundError, PedagogieValidationError } from './errors';
import { exigerDroitGestionProgrammeMatiere, type PedagogieActor } from './PedagogieAccessGuard';

export interface CreerProgrammeInput {
  schoolId: string;
  titre: string;
  subjectId: string;
  classId?: string;
  level?: string;
  academicYearId?: string;
  actor?: PedagogieActor;
}

export interface MettreAJourProgrammeInput {
  schoolId: string;
  id: string;
  titre?: string;
  classId?: string | null;
  level?: string | null;
  actor?: PedagogieActor;
}

export interface SupprimerProgrammeInput {
  schoolId: string;
  id: string;
  actor?: PedagogieActor;
}

export class GererProgrammeUseCase {
  constructor(
    private readonly programmeRepository: ProgrammeRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly departmentRepository?: DepartmentRepository,
  ) {}

  async creer(input: CreerProgrammeInput): Promise<ProgrammeProps> {
    if (!input.titre?.trim() || !input.subjectId) {
      throw new PedagogieValidationError('titre et subjectId sont requis');
    }

    if (this.departmentRepository) {
      await exigerDroitGestionProgrammeMatiere(
        this.departmentRepository,
        input.schoolId,
        input.subjectId,
        input.actor,
      );
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

    if (this.departmentRepository) {
      await exigerDroitGestionProgrammeMatiere(
        this.departmentRepository,
        input.schoolId,
        existing.subjectId,
        input.actor,
      );
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

    if (this.departmentRepository) {
      await exigerDroitGestionProgrammeMatiere(
        this.departmentRepository,
        input.schoolId,
        existing.subjectId,
        input.actor,
      );
    }

    await this.programmeRepository.delete(input.id);
  }
}
