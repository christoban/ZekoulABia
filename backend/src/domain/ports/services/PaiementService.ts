/**
 * DOMAIN LAYER — Port Service Paiement Mobile Money
 * Implémenté par Campay API (MTN MoMo + Orange Money Cameroun).
 */
import type { PaymentMethod } from '@domain/types/enums';

export interface InitierPaiementOptions {
  montant: number;
  devise: string;           // 'XAF'
  telephone: string;        // Numéro MTN ou Orange
  methode: PaymentMethod;
  description: string;
  referenceInterne: string; // invoiceId ou paymentId
  schoolId: string;
}

export interface ResultatPaiement {
  reference: string;        // Référence Campay
  statut: 'PENDING' | 'SUCCESS' | 'FAILED';
  operateurRef?: string;
  urlRecu?: string;
}

export interface DonneeWebhook {
  campayRef: string;
  statut: 'SUCCESS' | 'FAILED';
  montant: number;
  telephone: string;
  operateurRef?: string;
  donneesRaw: Record<string, unknown>;
}

export interface PaiementService {
  initierPaiement(options: InitierPaiementOptions): Promise<ResultatPaiement>;
  verifierStatut(campayRef: string): Promise<ResultatPaiement>;
  traiterWebhook(donnees: DonneeWebhook): Promise<void>;
  initierRemboursement(params: {
    campayRef: string;
    montant: number;
    telephone: string;
    motif: string;
  }): Promise<ResultatPaiement>;
}
