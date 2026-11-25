/**
 * APPLICATION — Use case : Vérifier un reçu MINESEC
 *
 * Le secrétariat saisit le numéro de reçu → statut passe à PAYE.
 * Optionnellement, vérification en ligne via cartescolaire.cm.
 */
import type { PaiementMinesecRepository } from '@domain/ports/repositories/PaiementMinesecRepository';
import type { CarteScolaireService } from '@domain/ports/services/CarteScolaireService';

export interface VerifierRecuResult {
  paiementId: string;
  status: 'PAYE' | 'VERIFIE';
  source: 'MANUAL' | 'SCRAPE_AUTO';
  message: string;
}

export class VerifierRecuUseCase {
  constructor(
    private readonly paiementRepository: PaiementMinesecRepository,
    private readonly carteScolaireService: CarteScolaireService,
  ) {}

  async execute(
    schoolId: string,
    paiementId: string,
    numeroRecu: string,
    verifyOnline: boolean = false,
  ): Promise<VerifierRecuResult> {
    // Récupérer le paiement
    const paiement = await this.paiementRepository.trouverPaiement(paiementId);
    if (!paiement) throw new Error('Paiement introuvable');
    if (paiement.schoolId !== schoolId) throw new Error('Accès refusé');

    // Mettre à jour avec le numéro de reçu (confiance admin)
    let status: 'PAYE' | 'VERIFIE' = 'PAYE';
    let source: 'MANUAL' | 'SCRAPE_AUTO' = 'MANUAL';

    // Optionnellement, vérifier en ligne
    if (verifyOnline && paiement.student?.matricule) {
      try {
        const paymentStatus = await this.carteScolaireService.checkPaiementStatus(
          paiement.student.matricule,
          paiement.anneeScolaire,
        );
        if (paymentStatus.paye) {
          status = 'VERIFIE';
          source = 'SCRAPE_AUTO';
        }
      } catch {
        // Scraping échoué — on reste en PAYE (confiance admin)
      }
    }

    await this.paiementRepository.mettreAJourPaiement(paiementId, {
      numeroRecu,
      status,
      recuVerifie: status === 'VERIFIE',
      recuVerifieAt: status === 'VERIFIE' ? new Date() : null,
      datePaiement: new Date(),
      dataSource: source,
    });

    return {
      paiementId,
      status,
      source,
      message: status === 'VERIFIE'
        ? 'Reçu vérifié automatiquement via cartescolaire.cm'
        : 'Reçu enregistré (confiance admin, vérification en attente)',
    };
  }
}
