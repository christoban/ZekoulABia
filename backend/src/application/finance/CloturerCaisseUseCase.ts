import type { CashClosureView, PaiementRepository } from '@domain/ports/repositories/PaiementRepository';

export interface CloturerCaisseCommande {
  schoolId: string;
  closureDate: Date | string;
  closedById: string;
  declaredCash?: number | null;
  notes?: string | null;
}

export class CloturerCaisseUseCase {
  constructor(private readonly paiementRepository: PaiementRepository) {}

  async execute(commande: CloturerCaisseCommande): Promise<CashClosureView> {
    const closureDate = commande.closureDate instanceof Date
      ? commande.closureDate
      : new Date(commande.closureDate);

    if (Number.isNaN(closureDate.getTime())) {
      throw new Error('Date de clôture invalide');
    }

    return this.paiementRepository.cloturerCaisse({
      schoolId: commande.schoolId,
      closureDate,
      closedById: commande.closedById,
      declaredCash: commande.declaredCash ?? null,
      notes: commande.notes?.trim() ?? null,
    });
  }
}

