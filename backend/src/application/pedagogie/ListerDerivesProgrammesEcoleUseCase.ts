/**
 * APPLICATION LAYER — Use Case Lot 2 : Détection des dérives entre les programmes
 * nationaux matérialisés dans l'école et le référentiel OfficialProgrammeProgression courant.
 */
import type { SynchronisationProgrammeRepository } from '@domain/ports/repositories/SynchronisationProgrammeRepository';
import { calculerDiffSynchronisationProgramme } from '@domain/rules/officialProgressionDiff';

export interface DeriveProgrammeItem {
  programmeId: string;
  programmeTitre: string;
  subjectId: string;
  subjectName: string;
  classId: string | null;
  className: string | null;
  level: string | null;
  filiere: string | null;
  officialProgressionId: string;
  checksumEcole: string | null;
  checksumNational: string | null;
  titreModifie: boolean;
  ajoutesCount: number;
  modifiesCount: number;
  retiresCount: number;
  retiresUtilisesCount: number;
  inchangesCount: number;
}

export interface ListeDerivesEcoleResultat {
  totalProgrammesNationaux: number;
  totalAvecDerive: number;
  derives: DeriveProgrammeItem[];
}

export class ListerDerivesProgrammesEcoleUseCase {
  constructor(private readonly syncRepo: SynchronisationProgrammeRepository) {}

  async execute(params: {
    schoolId: string;
    academicYearId?: string;
  }): Promise<ListeDerivesEcoleResultat> {
    const programmes = await this.syncRepo.listerProgrammesNationauxAvecReference(
      params.schoolId,
      params.academicYearId,
    );

    const derives: DeriveProgrammeItem[] = [];
    for (const prog of programmes) {
      if (!prog.officialActive) continue;
      const diff = calculerDiffSynchronisationProgramme({
        programmeTitre: prog.titre,
        programmeChecksum: prog.sourceChecksum,
        chapitresEcole: prog.chapitresEcole,
        officialTitre: prog.officialTitre,
        officialChecksum: prog.officialChecksum,
        chapitresOfficiels: prog.chapitresOfficiels,
      });
      if (!diff.aDerive) continue;

      derives.push({
        programmeId: prog.id,
        programmeTitre: prog.titre,
        subjectId: prog.subjectId,
        subjectName: prog.subjectName,
        classId: prog.classId,
        className: prog.className,
        level: prog.level,
        filiere: prog.filiere,
        officialProgressionId: prog.officialProgressionId,
        checksumEcole: diff.checksumEcole,
        checksumNational: diff.checksumNational,
        titreModifie: diff.titreModifie,
        ajoutesCount: diff.ajoutes.length,
        modifiesCount: diff.modifies.length,
        retiresCount: diff.retiresDuNational.length,
        retiresUtilisesCount: diff.retiresDuNational.filter((r) => r.utilisee).length,
        inchangesCount: diff.inchangesCount,
      });
    }

    return {
      totalProgrammesNationaux: programmes.length,
      totalAvecDerive: derives.length,
      derives,
    };
  }
}
