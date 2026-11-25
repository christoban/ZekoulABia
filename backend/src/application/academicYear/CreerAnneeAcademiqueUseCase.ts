import type {
  AnneeAcademiqueRepository,
  AnneeAcademiqueProps,
  PeriodeAcademiqueProps,
  SequenceAcademiqueProps,
} from '@domain/ports/repositories/AnneeAcademiqueRepository';

export interface CreerAnneeCommande {
  schoolId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent?: boolean;
  creerPeriodesAutomatiquement?: boolean;
}

export interface CreerAnneeResultat {
  anneeId: string;
  name: string;
  periodesCreees: number;
  sequencesCreees: number;
}

export class CreerAnneeAcademiqueUseCase {
  constructor(private readonly anneeRepository: AnneeAcademiqueRepository) {}

  async execute(commande: CreerAnneeCommande): Promise<CreerAnneeResultat> {
    const dejaExiste = await this.anneeRepository.existsByName(
      commande.schoolId,
      commande.name
    );
    if (dejaExiste) {
      throw new Error(
        `Une année académique "${commande.name}" existe déjà pour cet établissement`
      );
    }

    if (commande.isCurrent !== false) {
      await this.anneeRepository.desactiverToutesAnneesEcole(commande.schoolId);
    }

    const annee: AnneeAcademiqueProps = {
      id: crypto.randomUUID(),
      schoolId: commande.schoolId,
      name: commande.name,
      startDate: commande.startDate,
      endDate: commande.endDate,
      isCurrent: commande.isCurrent !== false,
      status: 'ACTIVE',
    };
    await this.anneeRepository.save(annee);

    let periodesCreees = 0;
    let sequencesCreees = 0;

    if (commande.creerPeriodesAutomatiquement !== false) {
      const dureeAnnee = commande.endDate.getTime() - commande.startDate.getTime();
      const dureeTrimestre = Math.floor(dureeAnnee / 3);

      for (let t = 0; t < 3; t++) {
        const debutTrimestre = new Date(commande.startDate.getTime() + t * dureeTrimestre);
        const finTrimestre = t < 2
          ? new Date(commande.startDate.getTime() + (t + 1) * dureeTrimestre - 1)
          : commande.endDate;

        const periode: PeriodeAcademiqueProps = {
          id: crypto.randomUUID(),
          academicYearId: annee.id,
          name: `Trimestre ${t + 1}`,
          type: 'TRIMESTER',
          orderIndex: t + 1,
          startDate: debutTrimestre,
          endDate: finTrimestre,
          isCurrent: t === 0,
        };
        await this.anneeRepository.savePeriode(periode);
        periodesCreees++;

        const dureePeriode = finTrimestre.getTime() - debutTrimestre.getTime();
        const types: ('DS' | 'COMPOSITION')[] = ['DS', 'COMPOSITION'];

        for (let s = 0; s < 2; s++) {
          const debutSeq = new Date(debutTrimestre.getTime() + s * Math.floor(dureePeriode / 2));
          const finSeq = s === 0
            ? new Date(debutTrimestre.getTime() + Math.floor(dureePeriode / 2) - 1)
            : finTrimestre;

          const sequence: SequenceAcademiqueProps = {
            id: crypto.randomUUID(),
            academicPeriodId: periode.id,
            schoolId: commande.schoolId,
            name: `Séquence ${t * 2 + s + 1}`,
            type: types[s],
            orderIndex: s + 1,
            startDate: debutSeq,
            endDate: finSeq,
            isCurrent: t === 0 && s === 0,
          };
          await this.anneeRepository.saveSequence(sequence);
          sequencesCreees++;
        }
      }
    }

    return {
      anneeId: annee.id,
      name: annee.name,
      periodesCreees,
      sequencesCreees,
    };
  }
}
