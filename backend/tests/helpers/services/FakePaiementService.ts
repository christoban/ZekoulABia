import type {
  PaiementService,
  InitierPaiementOptions,
  ResultatPaiement,
  DonneeWebhook,
} from '@domain/ports/services/PaiementService';

export class FakePaiementService implements PaiementService {
  appels: InitierPaiementOptions[] = [];
  simulerEchec = false;

  async initierPaiement(options: InitierPaiementOptions): Promise<ResultatPaiement> {
    this.appels.push(options);
    if (this.simulerEchec) throw new Error('Campay indisponible');
    return {
      reference: `FAKE-REF-${Date.now()}`,
      statut: 'PENDING',
    };
  }
  async verifierStatut(ref: string): Promise<ResultatPaiement> {
    return { reference: ref, statut: 'SUCCESS' };
  }
  async traiterWebhook(_d: DonneeWebhook): Promise<void> {}
  async initierRemboursement(_p: {
    campayRef: string;
    montant: number;
    telephone: string;
    motif: string;
  }): Promise<ResultatPaiement> {
    return { reference: 'FAKE-REFUND', statut: 'SUCCESS' };
  }
}
