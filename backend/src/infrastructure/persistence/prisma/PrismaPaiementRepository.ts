import type { PrismaClient, Payment } from '@prisma/client';
import { Paiement } from '@domain/entities/Paiement';
import type { Facture } from '@domain/entities/Facture';
import type {
  CancelPaymentResult,
  CashClosureView,
  PaiementRecuData,
  PaiementRepository,
  RevenusParPeriode,
  UnmatchedPaymentView,
} from '@domain/ports/repositories/PaiementRepository';
import type { PaymentMethod, PaymentStatus, FeeType, CautionStatus, InvoiceStatus } from '@domain/types/enums';
import {
  allocateSequentialReceiptNumber,
  assertCashDateOpen,
  reallocateInvoiceInstallments,
} from './helpers/financeSequenceHelper';
import {
  cancelPaymentOp,
  closeCashRegisterOp,
  confirmMobileMoneyAtomicOp,
  listUnmatchedPaymentsOp,
  reconcileUnmatchedMobilePaymentOp,
  recordUnmatchedMobilePaymentOp,
} from './helpers/financePaymentOps';

export class PrismaPaiementRepository implements PaiementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Paiement | null> {
    const data = await this.prisma.payment.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByFacture(factureId: string): Promise<Paiement[]> {
    const data = await this.prisma.payment.findMany({ where: { invoiceId: factureId } });
    return data.map(d => this.toDomain(d));
  }

  async findByEleve(studentId: string): Promise<Paiement[]> {
    const data = await this.prisma.payment.findMany({ where: { studentId } });
    return data.map(d => this.toDomain(d));
  }

  async findByCampayRef(campayRef: string): Promise<Paiement | null> {
    const data = await this.prisma.payment.findFirst({ where: { campayRef } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async existePaiementEnAttente(factureId: string): Promise<boolean> {
    const count = await this.prisma.payment.count({
      where: { invoiceId: factureId, status: 'PENDING' },
    });
    return count > 0;
  }

  async findCautionsActives(schoolId: string): Promise<Paiement[]> {
    const data = await this.prisma.payment.findMany({
      where: { schoolId, feeType: 'CAUTION', cautionStatus: 'HELD' },
    });
    return data.map(d => this.toDomain(d));
  }

  async getRevenusParPeriode(
    schoolId: string,
    debut: Date,
    fin: Date
  ): Promise<RevenusParPeriode> {
    const paiements = await this.prisma.payment.findMany({
      where: {
        schoolId,
        status: 'SUCCESS',
        paidAt: { gte: debut, lte: fin },
      },
      select: { amount: true, method: true },
    });

    const total = paiements.reduce((s, p) => s + p.amount, 0);
    const parMethode: Record<string, number> = {};
    for (const p of paiements) {
      parMethode[p.method] = (parMethode[p.method] ?? 0) + p.amount;
    }

    return { total, nombrePaiements: paiements.length, parMethode };
  }

  async save(paiement: Paiement): Promise<void> {
    const data = paiement.toObject();
    await this.prisma.payment.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        invoiceId: data.invoiceId,
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        installmentId: data.installmentId,
        recordedById: data.recordedById,
        paidById: data.paidById,
        amount: Math.round(data.amount),
        currency: data.currency,
        method: data.method,
        status: data.status,
        feeType: data.feeType,
        cautionStatus: data.cautionStatus,
        receiptNumber: data.receiptNumber,
        provisionalReceiptNumber: data.provisionalReceiptNumber,
        operatorFee: data.operatorFee ?? 0,
        feeBearer: data.feeBearer,
        campayRef: data.campayRef,
        campayStatus: data.campayStatus,
        phoneNumber: data.phoneNumber,
        clientRecordedAt: data.clientRecordedAt,
        clockSkewSeconds: data.clockSkewSeconds,
        paidAt: data.paidAt,
        createdAt: data.createdAt,
      },
    });
  }

  /**
   * V3.2 : encaissement cash ATOMIQUE avec numérotation séquentielle, caisse ouverte et trop-perçu.
   */
  async encaisserCash(
    paiement: Paiement,
    facture: Facture,
    options?: { allowOverpayment?: boolean },
  ): Promise<number> {
    const data = paiement.toObject();

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${facture.id} FOR UPDATE`;

      const factureData = await tx.invoice.findUnique({ where: { id: facture.id } });
      if (!factureData) throw new Error(`Facture introuvable : ${facture.id}`);
      if (factureData.status === 'PAID' || factureData.status === 'CANCELLED') {
        throw new Error('Cette facture ne peut plus être payée (annulée ou déjà payée)');
      }

      const txDate = data.paidAt ?? data.createdAt ?? new Date();
      await assertCashDateOpen(tx, data.schoolId, txDate);

      const paye = await tx.payment.aggregate({
        where: { invoiceId: facture.id, status: 'SUCCESS' },
        _sum: { amount: true },
      });
      const totalPaye = Math.round(paye._sum.amount ?? 0);
      const resteARegler = Math.max(0, Math.round(factureData.amount) - totalPaye);
      if (!options?.allowOverpayment && data.amount > resteARegler) {
        throw new Error(
          `Le montant encaissé (${data.amount}) dépasse le solde restant de la facture (${resteARegler})`,
        );
      }

      const excess = options?.allowOverpayment
        ? Math.max(0, Math.round(data.amount) - resteARegler)
        : 0;
      const receiptNumber =
        data.receiptNumber ?? (await allocateSequentialReceiptNumber(tx, data.schoolId, txDate));

      await tx.payment.create({
        data: {
          id: data.id,
          schoolId: data.schoolId,
          invoiceId: data.invoiceId,
          studentId: data.studentId,
          academicYearId: data.academicYearId ?? factureData.academicYearId,
          installmentId: data.installmentId,
          recordedById: data.recordedById,
          paidById: data.paidById,
          amount: Math.round(data.amount),
          currency: data.currency,
          method: data.method,
          status: data.status,
          feeType: data.feeType,
          cautionStatus: data.cautionStatus,
          receiptNumber,
          provisionalReceiptNumber: data.provisionalReceiptNumber,
          operatorFee: data.operatorFee ?? 0,
          feeBearer: data.feeBearer,
          campayRef: data.campayRef,
          campayStatus: data.campayStatus,
          phoneNumber: data.phoneNumber,
          clientRecordedAt: data.clientRecordedAt,
          clockSkewSeconds: data.clockSkewSeconds,
          paidAt: txDate,
          createdAt: data.createdAt,
        },
      });
      paiement.assignReceiptNumber(receiptNumber);

      if (excess > 0) {
        await tx.studentCreditLedger.create({
          data: {
            schoolId: data.schoolId,
            studentId: data.studentId,
            sourcePaymentId: data.id,
            amount: excess,
            description: `Trop-perçu sur facture ${facture.id} (${receiptNumber})`,
            createdById: data.recordedById ?? null,
          },
        });
      }

      const nouveauTotal = totalPaye + Math.round(data.amount);
      facture.mettreAJourStatut(nouveauTotal);
      await tx.invoice.update({
        where: { id: facture.id },
        data: { status: facture.status },
      });
      await reallocateInvoiceInstallments(tx, facture.id);

      return nouveauTotal;
    });
  }

  async confirmerMobileMoneyAtomique(
    paiement: Paiement,
    campayRef: string,
    operatorRef?: string,
  ): Promise<{ paiement: Paiement; totalPaye: number; creditAdded: number }> {
    const res = await confirmMobileMoneyAtomicOp(this.prisma, paiement, campayRef, operatorRef);
    if (paiement.estEnAttente()) {
      paiement.confirmer(campayRef, operatorRef);
    }
    if (res.receiptNumber) {
      paiement.assignReceiptNumber(res.receiptNumber);
    }
    return { paiement, totalPaye: res.totalPaye, creditAdded: res.creditAdded };
  }

  async annulerPaiement(params: {
    schoolId: string;
    paymentId: string;
    cancelledById: string;
    reason: string;
  }): Promise<CancelPaymentResult> {
    return cancelPaymentOp(this.prisma, params);
  }

  async cloturerCaisse(params: {
    schoolId: string;
    closureDate: Date;
    closedById: string;
    declaredCash?: number | null;
    notes?: string | null;
  }): Promise<CashClosureView> {
    return closeCashRegisterOp(this.prisma, params);
  }

  async listerCloturesCaisse(schoolId: string): Promise<CashClosureView[]> {
    return this.prisma.cashClosure.findMany({
      where: { schoolId },
      orderBy: { closureDate: 'desc' },
      take: 90,
      include: { closedBy: { select: { firstName: true, lastName: true } } },
    });
  }

  async enregistrerPaiementNonRapproche(params: {
    schoolId?: string;
    campayRef: string;
    montant: number;
    telephone: string;
    operateurRef?: string;
    raw?: Record<string, unknown>;
  }): Promise<void> {
    await recordUnmatchedMobilePaymentOp(this.prisma, params);
  }

  async listerPaiementsNonRapproches(schoolId: string): Promise<UnmatchedPaymentView[]> {
    return listUnmatchedPaymentsOp(this.prisma, schoolId);
  }

  async rapprocherPaiementMobile(params: {
    schoolId: string;
    paymentId: string;
    invoiceId: string;
    reconciledById: string;
  }): Promise<{ paymentId: string; receiptNumber: string; invoiceStatus: InvoiceStatus }> {
    return reconcileUnmatchedMobilePaymentOp(this.prisma, params);
  }

  async update(paiement: Paiement): Promise<void> {
    const data = paiement.toObject();
    await this.prisma.payment.update({
      where: { id: data.id },
      data: {
        status: data.status,
        cautionStatus: data.cautionStatus ?? null,
        campayRef: data.campayRef ?? null,
        campayStatus: data.campayStatus ?? null,
        operatorRef: data.operatorRef ?? null,
        receiptNumber: data.receiptNumber ?? null,
        cancellationReason: data.cancellationReason ?? null,
        paidAt: data.paidAt ?? null,
        refundedById: data.refundedById ?? null,
        refundedAt: data.refundedAt ?? null,
        refundTransactionId: data.refundTransactionId ?? null,
      },
    });
  }

  async findRecuData(paymentId: string): Promise<PaiementRecuData | null> {
    const row = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        recordedBy: { select: { firstName: true, lastName: true } },
        paidBy: { select: { firstName: true, lastName: true } },
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            studentProfile: {
              select: {
                matricule: true,
                enrollmentsYearScoped: {
                  where: { status: 'ACTIVE' },
                  orderBy: { enrolledAt: 'desc' },
                  take: 1,
                  select: { class: { select: { name: true } } },
                },
              },
            },
          },
        },
        invoice: {
          select: {
            amount: true,
            grossAmount: true,
            discountTotal: true,
            description: true,
            promisedPaymentDate: true,
            feePlan: { select: { name: true } },
            payments: { select: { amount: true, status: true } },
            installments: {
              orderBy: { trancheNumber: 'asc' },
              select: {
                trancheNumber: true,
                label: true,
                amount: true,
                paidAmount: true,
                dueDate: true,
                status: true,
              },
            },
            discounts: {
              select: { reasonType: true, amount: true, justification: true },
            },
          },
        },
        school: { select: { name: true, city: true, phone: true } },
      },
    });
    if (!row) return null;

    const creditAgg = await this.prisma.studentCreditLedger.aggregate({
      where: { schoolId: row.schoolId, studentId: row.studentId },
      _sum: { amount: true },
    });

    return {
      ...row,
      studentCreditBalance: Math.max(0, Math.round(creditAgg._sum.amount ?? 0)),
    };
  }

  private toDomain(data: Payment): Paiement {
    return Paiement.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      invoiceId: data.invoiceId ?? undefined,
      studentId: data.studentId,
      academicYearId: data.academicYearId ?? undefined,
      installmentId: data.installmentId ?? undefined,
      recordedById: data.recordedById ?? undefined,
      paidById: data.paidById ?? undefined,
      amount: data.amount,
      currency: data.currency,
      method: data.method as PaymentMethod,
      status: data.status as PaymentStatus,
      feeType: data.feeType as FeeType,
      cautionStatus: (data.cautionStatus as CautionStatus) ?? undefined,
      transactionId: data.transactionId ?? undefined,
      receiptUrl: data.receiptUrl ?? undefined,
      receiptNumber: data.receiptNumber ?? undefined,
      provisionalReceiptNumber: data.provisionalReceiptNumber ?? undefined,
      operatorFee: data.operatorFee ?? 0,
      feeBearer: data.feeBearer ?? undefined,
      paidAt: data.paidAt ?? undefined,
      campayRef: data.campayRef ?? undefined,
      campayStatus: data.campayStatus ?? undefined,
      operatorRef: data.operatorRef ?? undefined,
      phoneNumber: data.phoneNumber ?? undefined,
      cancellationReason: data.cancellationReason ?? undefined,
      reversalOfPaymentId: data.reversalOfPaymentId ?? undefined,
      isUnmatched: data.isUnmatched,
      clientRecordedAt: data.clientRecordedAt ?? undefined,
      clockSkewSeconds: data.clockSkewSeconds ?? undefined,
      refundTransactionId: data.refundTransactionId ?? undefined,
      refundedAt: data.refundedAt ?? undefined,
      refundedById: data.refundedById ?? undefined,
      createdAt: data.createdAt,
    });
  }
}
