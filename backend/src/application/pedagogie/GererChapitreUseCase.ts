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
    const estProgrammeNational = programme.source === 'national';
    const volumeNormalise =
      typeof input.volumeHeuresPrevu === 'number' &&
      Number.isFinite(input.volumeHeuresPrevu) &&
      input.volumeHeuresPrevu > 0
        ? Math.trunc(input.volumeHeuresPrevu)
        : input.volumeHeuresPrevu === null && estProgrammeNational
          ? null
          : 2;

    return this.chapitreRepository.create({
      programmeId: input.programmeId,
      titre: input.titre.trim(),
      ordre: input.ordre ?? nextOrdre,
      volumeHeuresPrevu: volumeNormalise,
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

    // Sur un programme manuel, ne jamais passer volumeHeuresPrevu à null involontairement
    const estProgrammeNational = chapitre.programme.source === 'national';
    let volumeUpdate: number | null | undefined = input.volumeHeuresPrevu;
    if (volumeUpdate === null && !estProgrammeNational) {
      volumeUpdate = chapitre.volumeHeuresPrevu ?? 2;
    } else if (
      typeof volumeUpdate === 'number' &&
      (!Number.isFinite(volumeUpdate) || volumeUpdate <= 0)
    ) {
      volumeUpdate = estProgrammeNational ? null : (chapitre.volumeHeuresPrevu ?? 2);
    }

    return this.chapitreRepository.update({
      id: input.id,
      titre: input.titre?.trim() ? input.titre.trim() : undefined,
      ordre: input.ordre,
      volumeHeuresPrevu: volumeUpdate,
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
