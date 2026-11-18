/**
 * DOMAIN LAYER — Port Repository Portail Finance Parent
 * Encapsule les requêtes de facturation et de vérification d'appartenance pour le portail parent.
 */
import type {
  CautionStatus,
  DiscountReasonType,
  FeeType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '@domain/types/enums';

export interface ParentInvoiceInstallmentView {
  id: string;
  schoolId: string;
  invoiceId: string;
  trancheNumber: number;
  label: string;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  status: InvoiceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParentInvoiceDiscountView {
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

export interface ParentInvoicePaymentSummaryView {
  id: string;
  amount: number;
  status: PaymentStatus;
  paidAt: Date | null;
  method: PaymentMethod;
  feeType: FeeType;
  cautionStatus: CautionStatus | null;
  refundedAt: Date | null;
  receiptNumber: string | null;
  provisionalReceiptNumber: string | null;
  cancellationReason: string | null;
}

export interface ParentInvoiceDetailItem {
  id: string;
  schoolId: string;
  studentId: string;
  feePlanId: string | null;
  academicYearId: string | null;
  amount: number;
  grossAmount: number | null;
  discountTotal: number;
  currency: string;
  dueDate: Date | null;
  status: InvoiceStatus;
  description: string | null;
  promisedPaymentDate: Date | null;
  promisedPaymentNote: string | null;
  promisedByUserId: string | null;
  promisedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
  feePlan: {
    id: string;
    name: string;
    feeType: FeeType;
    amount: number;
  } | null;
  installments: ParentInvoiceInstallmentView[];
  discounts: ParentInvoiceDiscountView[];
  payments: ParentInvoicePaymentSummaryView[];
}

export interface ParentInvoiceOwnershipRecord {
  id: string;
  schoolId: string;
  studentId: string;
}

export interface ParentPaymentOwnershipRecord {
  id: string;
  schoolId: string;
  studentId: string;
}

export interface ParentFinancePortalRepository {
  listInvoicesForParent(params: {
    schoolId: string;
    studentId?: string;
    childUserIds: string[];
    page: number;
    limit: number;
  }): Promise<{ total: number; invoices: ParentInvoiceDetailItem[] }>;

  findInvoiceOwnership(
    invoiceId: string,
    schoolId: string,
  ): Promise<ParentInvoiceOwnershipRecord | null>;

  findPaymentOwnership(filter: {
    paymentId?: string;
    campayRef?: string;
  }): Promise<ParentPaymentOwnershipRecord | null>;
}
