import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';

export class DefinirPeriodeCouranteUseCase {
  constructor(private readonly anneeRepository: AnneeAcademiqueRepository) {}

  async definirPeriode(periodeId: string, schoolId: string): Promise<void> {
    const periode = await this.anneeRepository.findPeriodeById(periodeId, schoolId);
    if (!periode) throw new Error(`Période introuvable : ${periodeId}`);

    await this.anneeRepository.desactiverToutesPeriodes(periode.academicYearId);
    await this.anneeRepository.activerPeriode(periodeId);
  }

  async definirSequence(sequenceId: string, schoolId: string): Promise<void> {
    const sequence = await this.anneeRepository.findSequenceById(sequenceId, schoolId);
    if (!sequence) throw new Error(`Séquence introuvable : ${sequenceId}`);

    await this.anneeRepository.desactiverToutesSequences(sequence.academicPeriodId);
    await this.anneeRepository.activerSequence(sequenceId);
  }
}
