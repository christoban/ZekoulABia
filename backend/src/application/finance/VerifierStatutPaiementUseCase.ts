/**
 * APPLICATION LAYER — Use Case : Vérifier le statut d'un paiement Mobile Money
 * Interroge activement Campay si le paiement est toujours en attente (fallback au webhook).
 * Confirme le paiement et solde la facture si le paiement est validé.
 */
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PaiementService } from '@domain/ports/services/PaiementService';

export interface VerifierStatutCommande {
  schoolId: string;
  invoiceId?: string;
  paymentId?: string;
  campayRef?: string;
}

export interface VerifierStatutResultat {
  statut: 'SUCCESS' | 'PENDING' | 'FAILED';
  reference?: string;
  montant?: number;
  operateur?: string;
  message?: string;
}

export class VerifierStatutPaiementUseCase {
  constructor(
    private readonly paiementRepository: PaiementRepository,
    private readonly factureRepository: FactureRepository,
    private readonly paiementService: PaiementService,
  ) {}

  async execute(commande: VerifierStatutCommande): Promise<VerifierStatutResultat> {
    // 1. Retrouver le paiement
    let paiement = null;

    if (commande.paymentId) {
      paiement = await this.paiementRepository.findById(commande.paymentId);
    } else if (commande.campayRef) {
      paiement = await this.paiementRepository.findByCampayRef(commande.campayRef);
    } else if (commande.invoiceId) {
      const paiements = await this.paiementRepository.findByFacture(commande.invoiceId);
      // Chercher d'abord un paiement PENDING
      paiement = paiements.find((p) => p.estEnAttente()) ?? paiements[0] ?? null;
    }

    // Si aucun paiement trouvé mais qu'une facture existe
    if (!paiement) {
      if (commande.invoiceId) {
        const facture = await this.factureRepository.findById(commande.invoiceId);
        if (facture && facture.status === 'PAID') {
          return { statut: 'SUCCESS', message: 'Facture déjà soldée' };
        }
      }
      return { statut: 'FAILED', message: 'Aucun paiement trouvé pour cette référence' };
    }

    if (paiement.schoolId !== commande.schoolId) {
      throw new Error('Paiement non autorisé pour cet établissement');
    }

    // 2. Si le paiement est déjà validé
    if (paiement.estReussi()) {
      return {
        statut: 'SUCCESS',
        reference: paiement.campayRef,
        montant: paiement.amount,
        message: 'Paiement déjà confirmé',
      };
    }

    // 3. Si le paiement est PENDING et qu'on a une référence Campay
    if (paiement.estEnAttente() && paiement.campayRef) {
      try {
        const resultatCampay = await this.paiementService.verifierStatut(paiement.campayRef);

        if (resultatCampay.statut === 'SUCCESS') {
          // Confirmer le paiement
          paiement.confirmer(resultatCampay.reference, resultatCampay.operateurRef);
          await this.paiementRepository.update(paiement);

          // Mettre à jour la facture
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

          return {
            statut: 'SUCCESS',
            reference: resultatCampay.reference,
            montant: paiement.amount,
            operateur: resultatCampay.operateurRef,
            message: 'Paiement validé avec succès',
          };
        }

        if (resultatCampay.statut === 'FAILED') {
          paiement.marquerEchoue();
          await this.paiementRepository.update(paiement);
          return {
            statut: 'FAILED',
            reference: resultatCampay.reference,
            message: "Le paiement a échoué ou a été annulé par l'opérateur",
          };
        }

        return {
          statut: 'PENDING',
          reference: resultatCampay.reference,
          montant: paiement.amount,
          message: 'Paiement en attente de validation sur votre téléphone',
        };
      } catch {
        // En cas d'erreur de communication avec Campay, laisser en attente
        return {
          statut: 'PENDING',
          reference: paiement.campayRef,
          montant: paiement.amount,
          message: "Vérification en cours auprès de l'opérateur",
        };
      }
    }

    return {
      statut: paiement.status as 'SUCCESS' | 'PENDING' | 'FAILED',
      reference: paiement.campayRef,
      montant: paiement.amount,
    };
  }
}
