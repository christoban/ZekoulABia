/**
 * DOMAIN LAYER — Port Repository Paiement (Payment)
 */
import type { Paiement } from '@domain/entities/Paiement';
import type { Facture } from '@domain/entities/Facture';
import type { PaymentMethod } from '@domain/types/enums';

export interface RevenusParPeriode {
  total: number;
  nombrePaiements: number;
  parMethode: Record<string, number>;
}

export interface PaiementRepository {
  findById(id: string): Promise<Paiement | null>;
  findByFacture(factureId: string): Promise<Paiement[]>;
  findByEleve(studentId: string): Promise<Paiement[]>;
  findByCampayRef(campayRef: string): Promise<Paiement | null>;

  /**
   * Vérifie s'il existe déjà un paiement PENDING pour cette facture.
   * Évite les doublons de tentatives Mobile Money.
   */
  existePaiementEnAttente(factureId: string): Promise<boolean>;

  /**
   * Retourne les cautions actives (HELD) d'une école.
   * Utilisé pour le dashboard cautions de l'Intendant.
   */
  findCautionsActives(schoolId: string): Promise<Paiement[]>;

  /**
   * Calcule les revenus sur une période pour le reporting.
   */
  getRevenusParPeriode(
    schoolId: string,
    debut: Date,
    fin: Date
  ): Promise<RevenusParPeriode>;

  save(paiement: Paiement): Promise<void>;
  update(paiement: Paiement): Promise<void>;

  // Reçu — FinanceController.genererRecu / envoyerRecuParEmail (même include)
  findRecuData(paymentId: string): Promise<PaiementRecuData | null>;

  /**
   * Encaissement en espèces ATOMIQUE (V3.2) : crée le paiement SUCCESS et met à jour
   * la facture dans une MÊME transaction, en re-vérifiant à l'intérieur que la facture
   * reste payable et que le montant ne dépasse pas le solde restant. Deux encaissements
   * simultanés sur la même facture ne peuvent donc pas tous les deux réussir.
   *
   * @returns total payé cumulé (paiements SUCCESS) après cet encaissement.
   */
  encaisserCash(paiement: Paiement, facture: Facture): Promise<number>;
}

export interface PaiementRecuData {
  id: string;
  schoolId: string;
  amount: number;
  method: string;
  paidAt: Date | null;
  createdAt: Date;
  campayRef?: string | null;
  operatorRef?: string | null;
  student?: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
    studentProfile?: {
      matricule?: string | null;
      enrollmentsYearScoped?: { class?: { name: string } | null }[];
    } | null;
  } | null;
  invoice?: {
    amount: number;
    description?: string | null;
    feePlan?: { name: string } | null;
    payments?: { amount: number }[];
  } | null;
  school?: { name: string } | null;
}
