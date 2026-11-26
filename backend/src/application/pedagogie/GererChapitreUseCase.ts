import type { ChapitreRepository, ChapitreProps } from '@domain/ports/repositories/ChapitreRepository';
import type { ProgrammeRepository } from '@domain/ports/repositories/ProgrammeRepository';
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import { PedagogieNotFoundError, PedagogieValidationError } from './errors';
import { exigerDroitGestionProgrammeMatiere, type PedagogieActor } from './PedagogieAccessGuard';

export interface AjouterChapitreInput {
  schoolId: string;
  programmeId: string;
  titre: string;
  ordre?: number;
  volumeHeuresPrevu?: number | null;
  sequenceCibleFin?: number | null;
  actor?: PedagogieActor;
}

export interface MettreAJourChapitreInput {
  schoolId: string;
  id: string;
  titre?: string;
  ordre?: number;
  volumeHeuresPrevu?: number | null;
  sequenceCibleFin?: number | null;
  actor?: PedagogieActor;
}

export interface SupprimerChapitreInput {
  schoolId: string;
  id: string;
  actor?: PedagogieActor;
}

export class GererChapitreUseCase {
  constructor(
    private readonly chapitreRepository: ChapitreRepository,
    private readonly programmeRepository: ProgrammeRepository,
    private readonly departmentRepository?: DepartmentRepository,
  ) {}

  async ajouter(input: AjouterChapitreInput): Promise<ChapitreProps> {
    if (!input.titre?.trim()) {
      throw new PedagogieValidationError('Le titre du chapitre est requis');
    }

    const programme = await this.programmeRepository.findByIdAndSchool(input.programmeId, input.schoolId);
    if (!programme) {
      throw new PedagogieNotFoundError('Programme introuvable');
    }

    if (this.departmentRepository) {
      await exigerDroitGestionProgrammeMatiere(
        this.departmentRepository,
        input.schoolId,
        programme.subjectId,
        input.actor,
      );
    }

    const nextOrdre = await this.chapitreRepository.findNextOrdre(input.programmeId);

    return this.chapitreRepository.create({
      programmeId: input.programmeId,
      titre: input.titre.trim(),
      ordre: input.ordre ?? nextOrdre,
      volumeHeuresPrevu: input.volumeHeuresPrevu ?? 2,
      sequenceCibleFin: input.sequenceCibleFin ?? null,
    });
  }

  async mettreAJour(input: MettreAJourChapitreInput): Promise<ChapitreProps> {
    const chapitre = await this.chapitreRepository.findByIdAndSchool(input.id, input.schoolId);
    if (!chapitre) {
      throw new PedagogieNotFoundError('Chapitre introuvable');
    }

    if (this.departmentRepository && chapitre.programme.subjectId) {
      await exigerDroitGestionProgrammeMatiere(
        this.departmentRepository,
        input.schoolId,
        chapitre.programme.subjectId,
        input.actor,
      );
    }

    return this.chapitreRepository.update({
      id: input.id,
      titre: input.titre?.trim() ? input.titre.trim() : undefined,
      ordre: input.ordre,
      volumeHeuresPrevu: input.volumeHeuresPrevu,
      sequenceCibleFin: input.sequenceCibleFin,
    });
  }

  async supprimer(input: SupprimerChapitreInput): Promise<void> {
    const chapitre = await this.chapitreRepository.findByIdAndSchool(input.id, input.schoolId);
    if (!chapitre) {
      throw new PedagogieNotFoundError('Chapitre introuvable');
    }

    if (this.departmentRepository && chapitre.programme.subjectId) {
      await exigerDroitGestionProgrammeMatiere(
        this.departmentRepository,
        input.schoolId,
        chapitre.programme.subjectId,
        input.actor,
      );
    }

    await this.chapitreRepository.delete(input.id);
  }
}
