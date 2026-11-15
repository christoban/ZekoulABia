/**
 * DOMAIN LAYER — Entité Paiement (Payment)
 *
 * Workflow standard : PENDING → SUCCESS | FAILED
 * Workflow caution  : PENDING → SUCCESS → REFUNDED
 *                                       → (CAUTION_HELD → CAUTION_REFUNDED)
 */
import type { PaymentMethod, PaymentStatus, FeeType, CautionStatus } from '@domain/types/enums';

export interface PaiementProps {
  id: string;
  schoolId: string;
  invoiceId?: string;
  studentId: string;
  academicYearId?: string;
  installmentId?: string;
  recordedById?: string;
  paidById?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  feeType: FeeType;
  cautionStatus?: CautionStatus;
  transactionId?: string;
  receiptUrl?: string;
  receiptNumber?: string;
  provisionalReceiptNumber?: string;
  operatorFee?: number;
  feeBearer?: string;
  paidAt?: Date;
  campayRef?: string;
  campayStatus?: string;
  operatorRef?: string;
  phoneNumber?: string;
  cancellationReason?: string;
  reversalOfPaymentId?: string;
  isUnmatched?: boolean;
  clientRecordedAt?: Date;
  clockSkewSeconds?: number;
  refundTransactionId?: string;
  refundedAt?: Date;
  refundedById?: string;
  createdAt: Date;
}

export interface CreerPaiementProps {
  schoolId: string;
  invoiceId?: string;
  studentId: string;
  academicYearId?: string;
  installmentId?: string;
  recordedById?: string;
  paidById?: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  feeType: FeeType;
  operatorFee?: number;
  feeBearer?: string;
  campayRef?: string;
  phoneNumber?: string;
}

export interface CreerPaiementCashProps {
  schoolId: string;
  invoiceId: string;
  studentId: string;
  academicYearId?: string;
  installmentId?: string;
  amount: number;
  currency?: string;
  enregistreurId: string;
  paidById?: string;
  provisionalReceiptNumber?: string;
  clientRecordedAt?: Date;
}

export class Paiement {
  private constructor(private readonly props: PaiementProps) {}

  static create(props: CreerPaiementProps): Paiement {
    if (props.amount <= 0) throw new Error('Le montant du paiement doit être supérieur à 0');

    return new Paiement({
      ...props,
      id: crypto.randomUUID(),
      currency: props.currency ?? 'XAF',
      status: 'PENDING',
      cautionStatus: props.feeType === 'CAUTION' ? 'HELD' : undefined,
      createdAt: new Date(),
    });
  }

  static reconstituer(props: PaiementProps): Paiement {
    return new Paiement(props);
  }

  /** Paiement en espèces enregistré directement au guichet — pas de Campay. */
  static creerCash(props: CreerPaiementCashProps): Paiement {
    if (props.amount <= 0) throw new Error('Le montant du paiement doit être supérieur à 0');
    const now = new Date();
    const clockSkewSeconds = props.clientRecordedAt
      ? Math.round((now.getTime() - props.clientRecordedAt.getTime()) / 1000)
      : undefined;
    return new Paiement({
      id: crypto.randomUUID(),
      schoolId: props.schoolId,
      invoiceId: props.invoiceId,
      studentId: props.studentId,
      academicYearId: props.academicYearId,
      installmentId: props.installmentId,
      recordedById: props.enregistreurId,
      paidById: props.paidById,
      amount: Math.round(props.amount),
      currency: props.currency ?? 'XAF',
      method: 'CASH',
      feeType: 'TUITION',
      status: 'SUCCESS',
      provisionalReceiptNumber: props.provisionalReceiptNumber,
      clientRecordedAt: props.clientRecordedAt,
      clockSkewSeconds,
      paidAt: now,
      createdAt: now,
    });
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get invoiceId(): string | undefined { return this.props.invoiceId; }
  get studentId(): string { return this.props.studentId; }
  get academicYearId(): string | undefined { return this.props.academicYearId; }
  get installmentId(): string | undefined { return this.props.installmentId; }
  get recordedById(): string | undefined { return this.props.recordedById; }
  get paidById(): string | undefined { return this.props.paidById; }
  get amount(): number { return this.props.amount; }
  get phoneNumber(): string | undefined { return this.props.phoneNumber; }
  get method(): PaymentMethod { return this.props.method; }
  get status(): PaymentStatus { return this.props.status; }
  get feeType(): FeeType { return this.props.feeType; }
  get campayRef(): string | undefined { return this.props.campayRef; }
  get cautionStatus(): CautionStatus | undefined { return this.props.cautionStatus; }
  get receiptNumber(): string | undefined { return this.props.receiptNumber; }
  get provisionalReceiptNumber(): string | undefined { return this.props.provisionalReceiptNumber; }
  get operatorFee(): number | undefined { return this.props.operatorFee; }
  get feeBearer(): string | undefined { return this.props.feeBearer; }
  get cancellationReason(): string | undefined { return this.props.cancellationReason; }
  get isUnmatched(): boolean | undefined { return this.props.isUnmatched; }
  get clientRecordedAt(): Date | undefined { return this.props.clientRecordedAt; }
  get clockSkewSeconds(): number | undefined { return this.props.clockSkewSeconds; }
  get paidAt(): Date | undefined { return this.props.paidAt; }

  // --- Méthodes métier ---

  estMobileMoney(): boolean {
    return this.props.method === 'MTN_MOMO' || this.props.method === 'ORANGE_MONEY';
  }

  estCaution(): boolean { return this.props.feeType === 'CAUTION'; }
  estReussi(): boolean { return this.props.status === 'SUCCESS'; }
  estEnAttente(): boolean { return this.props.status === 'PENDING'; }

  confirmer(campayRef: string, operatorRef?: string): void {
    if (this.props.status !== 'PENDING') {
      throw new Error(`Impossible de confirmer : statut actuel "${this.props.status}"`);
    }
    this.props.status = 'SUCCESS';
    this.props.campayRef = campayRef;
    this.props.campayStatus = 'SUCCESSFUL';
    this.props.operatorRef = operatorRef;
    this.props.paidAt = new Date();
  }

  assignReceiptNumber(receiptNumber: string): void {
    this.props.receiptNumber = receiptNumber;
  }

  marquerEchoue(): void {
    if (this.props.status !== 'PENDING') {
      throw new Error(`Impossible de marquer échoué : statut actuel "${this.props.status}"`);
    }
    this.props.status = 'FAILED';
    this.props.campayStatus = 'FAILED';
  }

  rembourserCaution(rembourseurId: string): void {
    if (!this.estCaution()) {
      throw new Error("Ce paiement n'est pas une caution");
    }
    if (this.props.cautionStatus !== 'HELD') {
      throw new Error("La caution doit être à l'état HELD pour être remboursée");
    }
    this.props.cautionStatus = 'REFUNDED';
    this.props.status = 'REFUNDED';
    this.props.refundedById = rembourseurId;
    this.props.refundedAt = new Date();
  }

  retenirCautionDefinitivement(rembourseurId: string): void {
    if (!this.estCaution()) {
      throw new Error("Ce paiement n'est pas une caution");
    }
    if (this.props.cautionStatus !== 'HELD') {
      throw new Error("La caution doit être à l'état HELD");
    }
    this.props.cautionStatus = 'PERMANENTLY_HELD';
    this.props.refundedById = rembourseurId;
    this.props.refundedAt = new Date();
  }

  toObject(): PaiementProps {
    return { ...this.props };
  }
}
