import type { CancelPaymentResult, PaiementRepository } from '@domain/ports/repositories/PaiementRepository';

export interface AnnulerPaiementCommande {
  schoolId: string;
  paymentId: string;
  cancelledById: string;
  reason: string;
}

export class AnnulerPaiementUseCase {
  constructor(private readonly paiementRepository: PaiementRepository) {}

  async execute(commande: AnnulerPaiementCommande): Promise<CancelPaymentResult> {
    if (!commande.reason || commande.reason.trim().length < 3) {
      throw new Error("Le motif d'annulation est obligatoire (minimum 3 caractères)");
    }

    return this.paiementRepository.annulerPaiement({
      schoolId: commande.schoolId,
      paymentId: commande.paymentId,
      cancelledById: commande.cancelledById,
      reason: commande.reason.trim(),
    });
  }
}

