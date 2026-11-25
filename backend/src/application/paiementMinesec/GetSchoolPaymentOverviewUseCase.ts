/**
 * APPLICATION — Use case : Dashboard paiements consolidé pour toute l'école
 *
 * Extrait de PaiementMinesecController (qui accédait directement à Prisma) pour
 * respecter la séparation hexagonale — la logique métier n'appartient pas au controller.
 */
import type { PaiementMinesecRepository } from '@domain/ports/repositories/PaiementMinesecRepository';

export interface SchoolPaymentOverview {
  anneeScolaire: string;
  totalEleves: number;
  minesec: { status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[];
  etablissement: { status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[];
}

export class GetSchoolPaymentOverviewUseCase {
  constructor(private readonly paiementRepository: PaiementMinesecRepository) {}

  async execute(schoolId: string, anneeScolaire: string): Promise<SchoolPaymentOverview> {
    const totalEleves = await this.paiementRepository.compterInscriptionsActives(schoolId, anneeScolaire);
    const minesec = await this.paiementRepository.agregerPaiementsMinesec(schoolId, anneeScolaire);
    const etablissement = await this.paiementRepository.agregerPaiementsEtablissement(schoolId, anneeScolaire);

    return { anneeScolaire, totalEleves, minesec, etablissement };
  }
}
