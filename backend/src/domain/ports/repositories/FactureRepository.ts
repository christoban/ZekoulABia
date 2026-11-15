/**
 * DOMAIN LAYER — Port Repository Facture (Invoice)
 */
import type { Facture } from '@domain/entities/Facture';
import type { DiscountReasonType, InvoiceStatus } from '@domain/types/enums';

export interface FactureEnRetard {
  studentId: string;
  studentNom: string;
  totalDu: number;
  totalPaye: number;
  solde: number;
  nombreFacturesEnRetard: number;
}

export interface InstallmentInput {
  trancheNumber?: number;
  label: string;
  amount: number;
  dueDate: Date;
}

export interface InstallmentView {
  id: string;
  invoiceId: string;
  trancheNumber: number;
  label: string;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  status: InvoiceStatus;
}

export interface DiscountInput {
  schoolId: string;
  invoiceId: string;
  studentId: string;
  reasonType: DiscountReasonType;
  amount: number;
  percentage?: number | null;
  justification: string;
  grantedById: string;
}

export interface DiscountView {
  id: string;
  schoolId: string;
  invoiceId: string;
  studentId: string;
  reasonType: DiscountReasonType;
  amount: number;
  percentage: number | null;
  justification: string;
  grantedById: string;
  createdAt: Date;
}

export interface PromisePaymentInput {
  schoolId: string;
  invoiceId: string;
  promisedDate: Date;
  note?: string;
  promisedByUserId: string;
}

export interface FactureRepository {
  findById(id: string): Promise<Facture | null>;
  findByEleve(studentId: string): Promise<Facture[]>;
  findBySchool(schoolId: string): Promise<Facture[]>;
  findByStatut(schoolId: string, statut: InvoiceStatus): Promise<Facture[]>;
  findByClasse(classId: string): Promise<Facture[]>;
  findByPlanFrais(feePlanId: string): Promise<Facture[]>;

  /**
   * Somme UNIQUEMENT les paiements SUCCESS pour une facture.
   * Correction du bug loadInvoiceTotals() qui comptait tous les statuts.
   */
  calculerTotalPayeAvecSucces(factureId: string): Promise<number>;

  /**
   * Retourne les élèves avec factures en retard et leur solde.
   * Utilisé pour le dashboard Intendant.
   */
  getElevesEnRetard(schoolId: string): Promise<FactureEnRetard[]>;

  /**
   * Vérifie si un élève a une facture impayée bloquante
   * (pour blocage inscription examen, FENASCO, etc.)
   */
  aFactureImpayeeBloquante(studentId: string): Promise<boolean>;

  save(facture: Facture): Promise<void>;
  update(facture: Facture): Promise<void>;
  delete(id: string): Promise<void>;

  getInstallments(invoiceId: string): Promise<InstallmentView[]>;
  getDiscounts(invoiceId: string): Promise<DiscountView[]>;
  configurerEcheancier(
    invoiceId: string,
    schoolId: string,
    tranches: InstallmentInput[],
  ): Promise<{ invoiceId: string; netAmount: number; installments: InstallmentView[] }>;
  appliquerRemise(input: DiscountInput): Promise<{
    invoice: Facture;
    discount: DiscountView;
    installments: InstallmentView[];
  }>;
  enregistrerPromessePaiement(input: PromisePaymentInput): Promise<Facture>;
  calculerAvoirDisponible(schoolId: string, studentId: string): Promise<number>;
}
