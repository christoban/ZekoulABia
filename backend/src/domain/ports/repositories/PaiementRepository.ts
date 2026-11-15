/**
 * DOMAIN LAYER — Port Repository Paiement (Payment)
 */
import type { Paiement } from '@domain/entities/Paiement';
import type { Facture } from '@domain/entities/Facture';
import type { InvoiceStatus } from '@domain/types/enums';

export interface RevenusParPeriode {
  total: number;
  nombrePaiements: number;
  parMethode: Record<string, number>;
}

export interface CashClosureView {
  id: string;
  schoolId: string;
  closureDate: Date;
  closedById: string;
  totalCash: number;
  totalMobileMoney: number;
  totalOther: number;
  totalCancelled: number;
  paymentCount: number;
  declaredCash: number | null;
  variance: number | null;
  notes: string | null;
  createdAt: Date;
  closedBy?: { firstName: string; lastName: string } | null;
}

export interface UnmatchedPaymentView {
  id: string;
  schoolId: string;
  amount: number;
  method: string;
  campayRef: string | null;
  operatorRef: string | null;
  phoneNumber: string | null;
  paidAt: Date | null;
  createdAt: Date;
  studentId: string;
}

export interface CancelPaymentResult {
  cancelledPaymentId: string;
  receiptNumber: string | null;
  invoiceStatus: InvoiceStatus | null;
  totalPaid: number;
  reversedCreditAmount: number;
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
  encaisserCash(paiement: Paiement, facture: Facture, options?: { allowOverpayment?: boolean }): Promise<number>;
  confirmerMobileMoneyAtomique?(
    paiement: Paiement,
    campayRef: string,
    operatorRef?: string,
  ): Promise<{ paiement: Paiement; totalPaye: number; creditAdded: number }>;
  annulerPaiement(params: {
    schoolId: string;
    paymentId: string;
    cancelledById: string;
    reason: string;
  }): Promise<CancelPaymentResult>;
  cloturerCaisse(params: {
    schoolId: string;
    closureDate: Date;
    closedById: string;
    declaredCash?: number | null;
    notes?: string | null;
  }): Promise<CashClosureView>;
  listerCloturesCaisse(schoolId: string): Promise<CashClosureView[]>;
  enregistrerPaiementNonRapproche(params: {
    schoolId?: string;
    campayRef: string;
    montant: number;
    telephone: string;
    operateurRef?: string;
    raw?: Record<string, unknown>;
  }): Promise<void>;
  listerPaiementsNonRapproches(schoolId: string): Promise<UnmatchedPaymentView[]>;
  rapprocherPaiementMobile(params: {
    schoolId: string;
    paymentId: string;
    invoiceId: string;
    reconciledById: string;
  }): Promise<{ paymentId: string; receiptNumber: string; invoiceStatus: InvoiceStatus }>;
}

export interface PaiementRecuData {
  id: string;
  schoolId: string;
  studentId: string;
  amount: number;
  method: string;
  status?: string;
  paidAt: Date | null;
  createdAt: Date;
  receiptNumber?: string | null;
  provisionalReceiptNumber?: string | null;
  operatorFee?: number;
  feeBearer?: string | null;
  cancellationReason?: string | null;
  campayRef?: string | null;
  operatorRef?: string | null;
  recordedBy?: { firstName: string; lastName: string } | null;
  paidBy?: { firstName: string; lastName: string } | null;
  studentCreditBalance?: number;
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
    grossAmount?: number | null;
    discountTotal?: number;
    description?: string | null;
    promisedPaymentDate?: Date | null;
    feePlan?: { name: string } | null;
    payments?: { amount: number; status?: string }[];
    installments?: {
      trancheNumber: number;
      label: string;
      amount: number;
      paidAmount: number;
      dueDate: Date;
      status: string;
    }[];
    discounts?: { reasonType: string; amount: number; justification: string }[];
  } | null;
  school?: { name: string; city?: string | null; phone?: string | null } | null;
}
