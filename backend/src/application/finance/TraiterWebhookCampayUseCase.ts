/**
 * APPLICATION LAYER — Use Case : Traiter le webhook Campay
 * Confirme ou rejette un paiement Mobile Money.
 * Met à jour le statut de la facture (correction bug : filtre SUCCESS).
 */
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { DonneeWebhook } from '@domain/ports/services/PaiementService';

export class TraiterWebhookCampayUseCase {
  constructor(
    private readonly paiementRepository: PaiementRepository,
    private readonly factureRepository: FactureRepository,
  ) {}

  async execute(donnees: DonneeWebhook): Promise<void> {
    // 1. Retrouver le paiement via la référence Campay
    const paiement = await this.paiementRepository.findByCampayRef(donnees.campayRef);
    if (!paiement) {
      throw new Error(`Paiement introuvable pour la référence Campay : ${donnees.campayRef}`);
    }

    if (donnees.statut === 'SUCCESS') {
      if (this.paiementRepository.confirmerMobileMoneyAtomique) {
        const res = await this.paiementRepository.confirmerMobileMoneyAtomique(
          paiement,
          donnees.campayRef,
          donnees.operateurRef,
        );
        if (paiement.invoiceId) {
          const facture = await this.factureRepository.findById(paiement.invoiceId);
          if (facture && facture.status !== 'CANCELLED') {
            const repoTotal = await this.factureRepository.calculerTotalPayeAvecSucces(paiement.invoiceId);
            const totalPaye = repoTotal > 0 ? repoTotal : res.totalPaye;
            const prevStatus = facture.status;
            facture.mettreAJourStatut(totalPaye);
            if (facture.status !== prevStatus) {
              await this.factureRepository.update(facture);
            }
          }
        }
      } else {
        paiement.confirmer(donnees.campayRef, donnees.operateurRef);
        await this.paiementRepository.update(paiement);

        if (paiement.invoiceId) {
          const facture = await this.factureRepository.findById(paiement.invoiceId);
          if (facture) {
            const totalPaye = await this.factureRepository.calculerTotalPayeAvecSucces(
              paiement.invoiceId
            );
            facture.mettreAJourStatut(totalPaye);
            await this.factureRepository.update(facture);
          }
        }
      }
    } else {
      // 2b. Marquer le paiement comme échoué
      paiement.marquerEchoue();
      await this.paiementRepository.update(paiement);
    }
  }
}
