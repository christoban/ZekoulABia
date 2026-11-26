/**
 * APPLICATION LAYER — Use Case Lot 2 (apply) : Application atomique et non destructive
 * de la synchronisation différentielle d'un Programme national.
 *
 * Garanties :
 * - Transaction Prisma unique.
 * - Idempotent : si déjà à jour, renvoie dejaAJour = true sans aucune écriture.
 * - Préserve strictement tous les Chapitre.id existants, toutes les coches ChapitreAvancement,
 *   tous les états ProgrammeModuleEtat et toutes les entrées CahierDeTexte.
 * - Ne supprime aucune leçon (y compris celles retirées du national).
 */
import type { SynchronisationProgrammeRepository } from '@domain/ports/repositories/SynchronisationProgrammeRepository';
import { calculerDiffSynchronisationProgramme } from '@domain/rules/officialProgressionDiff';
import { PedagogieNotFoundError, PedagogieValidationError } from './errors';

export interface AppliquerSynchronisationProgrammeResultat {
  programmeId: string;
  dejaAJour: boolean;
  nbAjoutes: number;
  nbModifies: number;
  nbConservesRetiresDuNational: number;
  nouveauChecksum: string | null;
}

export class AppliquerSynchronisationProgrammeUseCase {
  constructor(private readonly syncRepo: SynchronisationProgrammeRepository) {}

  async execute(params: {
    schoolId: string;
    programmeId: string;
  }): Promise<AppliquerSynchronisationProgrammeResultat> {
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

    if (!diff.aDerive) {
      return {
        programmeId: prog.id,
        dejaAJour: true,
        nbAjoutes: 0,
        nbModifies: 0,
        nbConservesRetiresDuNational: 0,
        nouveauChecksum: prog.sourceChecksum,
      };
    }

    const applied = await this.syncRepo.appliquerSynchronisationAtomique({
      schoolId: params.schoolId,
      programmeId: prog.id,
      officialProgressionId: prog.officialProgressionId,
      nouveauTitre: diff.titreApres,
      nouveauChecksum: diff.checksumNational,
      ajoutes: diff.ajoutes,
      modifies: diff.modifies,
    });

    return {
      programmeId: applied.programmeId,
      dejaAJour: false,
      nbAjoutes: applied.nbAjoutes,
      nbModifies: applied.nbModifies,
      nbConservesRetiresDuNational: diff.retiresDuNational.length,
      nouveauChecksum: applied.nouveauChecksum,
    };
  }
}
