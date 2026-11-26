/**
 * APPLICATION LAYER — Use Case Lot 2 (propose / dry-run) : Prévisualisation non destructive
 * de la synchronisation d'un Programme d'école avec la dernière version nationale.
 * Ne réalise AUCUNE écriture en base.
 */
import type { SynchronisationProgrammeRepository } from '@domain/ports/repositories/SynchronisationProgrammeRepository';
import {
  calculerDiffSynchronisationProgramme,
  type DiffSynchronisationProgramme,
} from '@domain/rules/officialProgressionDiff';
import { PedagogieNotFoundError, PedagogieValidationError } from './errors';

export interface PropositionSynchronisationProgrammeResultat {
  programme: {
    id: string;
    titre: string;
    subjectName: string;
    className: string | null;
    level: string | null;
    filiere: string | null;
    officialProgressionId: string;
  };
  diff: DiffSynchronisationProgramme;
}

export class ProposerSynchronisationProgrammeUseCase {
  constructor(private readonly syncRepo: SynchronisationProgrammeRepository) {}

  async execute(params: {
    schoolId: string;
    programmeId: string;
  }): Promise<PropositionSynchronisationProgrammeResultat> {
    const prog = await this.syncRepo.findProgrammePourSynchronisation(
      params.schoolId,
      params.programmeId,
    );
    if (!prog) {
      throw new PedagogieNotFoundError('Programme introuvable');
    }
    if (prog.source !== 'national' || !prog.officialProgressionId) {
      throw new PedagogieValidationError(
        "Ce programme est manuel et n'est pas rattaché au référentiel national.",
      );
    }

    const diff = calculerDiffSynchronisationProgramme({
      programmeTitre: prog.titre,
      programmeChecksum: prog.sourceChecksum,
      chapitresEcole: prog.chapitresEcole,
      officialTitre: prog.officialTitre,
      officialChecksum: prog.officialChecksum,
      chapitresOfficiels: prog.chapitresOfficiels,
    });

    return {
      programme: {
        id: prog.id,
        titre: prog.titre,
        subjectName: prog.subjectName,
        className: prog.className,
        level: prog.level,
        filiere: prog.filiere,
        officialProgressionId: prog.officialProgressionId,
      },
      diff,
    };
  }
}
