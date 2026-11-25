/**
 * APPLICATION LAYER — Use Case : Rembourser ou retenir une caution
 * Workflow caution : HELD → REFUNDED ou HELD → PERMANENTLY_HELD
 */
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';

export interface RembourserCautionCommande {
  paiementId: string;
  rembourseurId: string;
  schoolId: string;
  action: 'REMBOURSER' | 'RETENIR_DEFINITIVEMENT';
  motif?: string;
}

export class RembourserCautionUseCase {
  constructor(private readonly paiementRepository: PaiementRepository) {}

  async execute(commande: RembourserCautionCommande): Promise<void> {
    const paiement = await this.paiementRepository.findById(commande.paiementId);
    if (!paiement) throw new Error(`Paiement introuvable : ${commande.paiementId}`);
    if (paiement.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : paiement hors de votre établissement');
    }
    if (!paiement.estCaution()) {
      throw new Error("Ce paiement n'est pas une caution");
    }

    if (commande.action === 'REMBOURSER') {
      paiement.rembourserCaution(commande.rembourseurId);
    } else {
      paiement.retenirCautionDefinitivement(commande.rembourseurId);
    }

    await this.paiementRepository.update(paiement);
  }
}
