import type { Prisma, PrismaClient } from '@prisma/client';
import type { Paiement } from '@domain/entities/Paiement';
import type { InvoiceStatus } from '@domain/types/enums';
import type {
  CancelPaymentResult,
  CashClosureView,
  UnmatchedPaymentView,
} from '@domain/ports/repositories/PaiementRepository';
import {
  allocateSequentialReceiptNumber,
  assertCashDateOpen,
  reallocateInvoiceInstallments,
} from './financeSequenceHelper';

function computeInvoiceStatusFromPaid(amount: number, totalPaid: number, dueDate: Date | null): InvoiceStatus {
  if (totalPaid >= Math.round(amount)) return 'PAID';
  if (totalPaid > 0) return 'PARTIAL';
  if (dueDate && dueDate < new Date()) return 'OVERDUE';
  return 'PENDING';
}

export async function confirmMobileMoneyAtomicOp(
  prisma: PrismaClient,
  paiement: Paiement,
  campayRef: string,
  operatorRef?: string,
): Promise<{ totalPaye: number; creditAdded: number; receiptNumber: string }> {
  return prisma.$transaction(async (tx) => {
    const invoiceId = paiement.invoiceId;
    if (invoiceId) {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
    }

    const currentPay = await tx.payment.findUnique({ where: { id: paiement.id } });
    if (currentPay && currentPay.status === 'SUCCESS') {
      const agg = invoiceId
        ? await tx.payment.aggregate({ where: { invoiceId, status: 'SUCCESS' }, _sum: { amount: true } })
        : { _sum: { amount: currentPay.amount } };
      return {
        totalPaye: Math.round(agg._sum.amount ?? 0),
        creditAdded: 0,
        receiptNumber: currentPay.receiptNumber ?? '',
      };
    }

    const txDate = new Date();
    const receiptNumber =
      currentPay?.receiptNumber ??
      (await allocateSequentialReceiptNumber(tx, paiement.schoolId, txDate));

    let totalBefore = 0;
    let creditAdded = 0;
    let academicYearId: string | null = currentPay?.academicYearId ?? null;

    if (invoiceId) {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (invoice) {
        academicYearId = academicYearId ?? invoice.academicYearId ?? null;
        const payAgg = await tx.payment.aggregate({
          where: { invoiceId, status: 'SUCCESS' },
          _sum: { amount: true },
        });
        totalBefore = Math.round(payAgg._sum.amount ?? 0);
        const reste = Math.max(0, Math.round(invoice.amount) - totalBefore);
        creditAdded = Math.max(0, Math.round(paiement.amount) - reste);
      }
    }

    await tx.payment.update({
      where: { id: paiement.id },
      data: {
        status: 'SUCCESS',
        campayRef,
        campayStatus: 'SUCCESSFUL',
        operatorRef: operatorRef ?? null,
        paidAt: txDate,
        receiptNumber,
        academicYearId,
        isUnmatched: false,
      },
    });

    if (creditAdded > 0) {
      await tx.studentCreditLedger.create({
        data: {
          schoolId: paiement.schoolId,
          studentId: paiement.studentId,
          sourcePaymentId: paiement.id,
          amount: creditAdded,
          description: `Trop-perçu Mobile Money (${receiptNumber})`,
        },
      });
    }

    const totalPaye = totalBefore + Math.round(paiement.amount);

    if (invoiceId) {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (invoice && invoice.status !== 'CANCELLED') {
        const nextStatus = computeInvoiceStatusFromPaid(invoice.amount, totalPaye, invoice.dueDate);
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: nextStatus } });
        await reallocateInvoiceInstallments(tx, invoiceId);
      }
    }

    return { totalPaye, creditAdded, receiptNumber };
  });
}

export async function cancelPaymentOp(
  prisma: PrismaClient,
  params: {
    schoolId: string;
    paymentId: string;
    cancelledById: string;
    reason: string;
  },
): Promise<CancelPaymentResult> {
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 3) {
    throw new Error("Le motif d'annulation est obligatoire (minimum 3 caractères)");
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: params.paymentId, schoolId: params.schoolId },
    });
    if (!payment) {
      throw new Error('Paiement introuvable');
    }
    if (payment.status === 'REFUNDED') {
      throw new Error('Ce paiement a déjà été annulé');
    }
    if (payment.status !== 'SUCCESS') {
      throw new Error('Seuls les paiements validés peuvent être annulés');
    }

    const txDate = payment.paidAt ?? payment.createdAt;
    await assertCashDateOpen(tx, params.schoolId, txDate);

    const now = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        cautionStatus: payment.feeType === 'CAUTION' ? 'REFUNDED' : payment.cautionStatus,
        cancellationReason: cleanReason,
        refundedById: params.cancelledById,
        refundedAt: now,
      },
    });

    const creditAgg = await tx.studentCreditLedger.aggregate({
      where: { schoolId: params.schoolId, sourcePaymentId: payment.id },
      _sum: { amount: true },
    });
    const creditSum = Math.round(creditAgg._sum.amount ?? 0);
    if (creditSum > 0) {
      await tx.studentCreditLedger.create({
        data: {
          schoolId: params.schoolId,
          studentId: payment.studentId,
          sourcePaymentId: payment.id,
          amount: -creditSum,
          description: `Annulation du trop-perçu (${payment.receiptNumber ?? payment.id}) : ${cleanReason}`,
          createdById: params.cancelledById,
        },
      });
    }

    let invoiceStatus: InvoiceStatus | null = null;
    let totalPaid = 0;

    if (payment.invoiceId) {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${payment.invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
      if (invoice) {
        const payAgg = await tx.payment.aggregate({
          where: { invoiceId: invoice.id, status: 'SUCCESS' },
          _sum: { amount: true },
        });
        totalPaid = Math.round(payAgg._sum.amount ?? 0);
        if (invoice.status === 'CANCELLED') {
          invoiceStatus = 'CANCELLED';
        } else {
          invoiceStatus = computeInvoiceStatusFromPaid(invoice.amount, totalPaid, invoice.dueDate);
          await tx.invoice.update({ where: { id: invoice.id }, data: { status: invoiceStatus } });
        }
        await reallocateInvoiceInstallments(tx, invoice.id);
      }
    }

    return {
      cancelledPaymentId: payment.id,
      receiptNumber: payment.receiptNumber ?? null,
      invoiceStatus,
      totalPaid,
      reversedCreditAmount: Math.max(0, creditSum),
    };
  });
}

export async function closeCashRegisterOp(
  prisma: PrismaClient,
  params: {
    schoolId: string;
    closureDate: Date;
    closedById: string;
    declaredCash?: number | null;
    notes?: string | null;
  },
): Promise<CashClosureView> {
  const d = params.closureDate;
  const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

  return prisma.$transaction(async (tx) => {
    const existing = await tx.cashClosure.findFirst({
      where: { schoolId: params.schoolId, closureDate: { gte: dayStart, lte: dayEnd } },
      select: { id: true },
    });
    if (existing) {
      throw new Error('Une clôture de caisse existe déjà pour cette date');
    }

    const [successPayments, cancelledPayments] = await Promise.all([
      tx.payment.findMany({
        where: { schoolId: params.schoolId, status: 'SUCCESS', paidAt: { gte: dayStart, lte: dayEnd } },
        select: { amount: true, method: true },
      }),
      tx.payment.findMany({
        where: { schoolId: params.schoolId, status: 'REFUNDED', refundedAt: { gte: dayStart, lte: dayEnd } },
        select: { amount: true },
      }),
    ]);

    let totalCash = 0;
    let totalMobileMoney = 0;
    let totalOther = 0;
    for (const p of successPayments) {
      const amt = Math.round(p.amount);
      if (p.method === 'CASH') totalCash += amt;
      else if (p.method === 'MTN_MOMO' || p.method === 'ORANGE_MONEY') totalMobileMoney += amt;
      else totalOther += amt;
    }
    const totalCancelled = cancelledPayments.reduce((s, p) => s + Math.round(p.amount), 0);
    const declared = params.declaredCash !== undefined && params.declaredCash !== null
      ? Math.round(params.declaredCash)
      : null;
    const variance = declared !== null ? declared - totalCash : null;

    const created = await tx.cashClosure.create({
      data: {
        schoolId: params.schoolId,
        closureDate: dayStart,
        closedById: params.closedById,
        totalCash,
        totalMobileMoney,
        totalOther,
        totalCancelled,
        paymentCount: successPayments.length,
        declaredCash: declared,
        variance,
        notes: params.notes ?? null,
      },
      include: { closedBy: { select: { firstName: true, lastName: true } } },
    });

    return {
      id: created.id,
      schoolId: created.schoolId,
      closureDate: created.closureDate,
      closedById: created.closedById,
      totalCash: created.totalCash,
      totalMobileMoney: created.totalMobileMoney,
      totalOther: created.totalOther,
      totalCancelled: created.totalCancelled,
      paymentCount: created.paymentCount,
      declaredCash: created.declaredCash,
      variance: created.variance,
      notes: created.notes,
      createdAt: created.createdAt,
      closedBy: created.closedBy,
    };
  });
}

export async function recordUnmatchedMobilePaymentOp(
  prisma: PrismaClient,
  params: {
    schoolId?: string;
    campayRef: string;
    montant: number;
    telephone: string;
    operateurRef?: string;
    raw?: Record<string, unknown>;
  },
): Promise<void> {
  const existing = await prisma.payment.findFirst({ where: { campayRef: params.campayRef }, select: { id: true } });
  if (existing) return;

  const extRef = typeof params.raw?.external_reference === 'string' ? params.raw.external_reference : undefined;
  let schoolId = params.schoolId;
  let studentId: string | undefined;

  if (extRef) {
    const inv = await prisma.invoice.findUnique({
      where: { id: extRef },
      select: { schoolId: true, studentId: true },
    });
    if (inv) {
      schoolId = schoolId ?? inv.schoolId;
      studentId = inv.studentId;
    }
  }

  if (!studentId && params.telephone) {
    const userByPhone = await prisma.user.findFirst({
      where: {
        phone: { contains: params.telephone.slice(-9) },
        ...(schoolId ? { schoolId } : {}),
      },
      select: { id: true, schoolId: true },
    });
    if (userByPhone) {
      schoolId = schoolId ?? userByPhone.schoolId;
      studentId = userByPhone.id;
    }
  }

  if (!schoolId) {
    const firstSchool = await prisma.school.findFirst({ select: { id: true } });
    if (!firstSchool) return;
    schoolId = firstSchool.id;
  }

  if (!studentId) {
    const fallbackUser = await prisma.user.findFirst({ where: { schoolId }, select: { id: true } });
    if (!fallbackUser) return;
    studentId = fallbackUser.id;
  }

  const normalizedPhone = params.telephone.replace(/\D/g, '');
  const isOrange = /^237?(69|655|656|657|658|659)/.test(normalizedPhone);

  await prisma.payment.create({
    data: {
      schoolId,
      invoiceId: null,
      studentId,
      amount: Math.max(1, Math.round(params.montant)),
      currency: 'XAF',
      method: isOrange ? 'ORANGE_MONEY' : 'MTN_MOMO',
      status: 'SUCCESS',
      feeType: 'TUITION',
      campayRef: params.campayRef,
      campayStatus: 'SUCCESSFUL',
      operatorRef: params.operateurRef ?? null,
      phoneNumber: params.telephone,
      paidAt: new Date(),
      isUnmatched: true,
      webhookData: (params.raw ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function reconcileUnmatchedMobilePaymentOp(
  prisma: PrismaClient,
  params: {
    schoolId: string;
    paymentId: string;
    invoiceId: string;
    reconciledById: string;
  },
): Promise<{ paymentId: string; receiptNumber: string; invoiceStatus: InvoiceStatus }> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: params.paymentId, schoolId: params.schoolId, isUnmatched: true, status: 'SUCCESS' },
    });
    if (!payment) {
      throw new Error('Paiement non rapproché introuvable');
    }

    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${params.invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findFirst({
      where: { id: params.invoiceId, schoolId: params.schoolId },
    });
    if (!invoice) {
      throw new Error('Facture cible introuvable dans cet établissement');
    }
    if (invoice.status === 'CANCELLED') {
      throw new Error('Impossible de rapprocher un paiement sur une facture annulée');
    }

    const payAgg = await tx.payment.aggregate({
      where: { invoiceId: invoice.id, status: 'SUCCESS' },
      _sum: { amount: true },
    });
    const totalBefore = Math.round(payAgg._sum.amount ?? 0);
    const reste = Math.max(0, Math.round(invoice.amount) - totalBefore);
    const excess = Math.max(0, Math.round(payment.amount) - reste);

    const txDate = payment.paidAt ?? new Date();
    const receiptNumber =
      payment.receiptNumber ?? (await allocateSequentialReceiptNumber(tx, params.schoolId, txDate));

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        academicYearId: invoice.academicYearId,
        isUnmatched: false,
        recordedById: params.reconciledById,
        receiptNumber,
      },
    });

    if (excess > 0) {
      await tx.studentCreditLedger.create({
        data: {
          schoolId: params.schoolId,
          studentId: invoice.studentId,
          sourcePaymentId: payment.id,
          amount: excess,
          description: `Trop-perçu après rapprochement Mobile Money (${receiptNumber})`,
          createdById: params.reconciledById,
        },
      });
    }

    const totalAfter = totalBefore + Math.round(payment.amount);
    const invoiceStatus = computeInvoiceStatusFromPaid(invoice.amount, totalAfter, invoice.dueDate);
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: invoiceStatus } });
    await reallocateInvoiceInstallments(tx, invoice.id);

    return { paymentId: payment.id, receiptNumber, invoiceStatus };
  });
}

export async function listUnmatchedPaymentsOp(
  prisma: PrismaClient,
  schoolId: string,
): Promise<UnmatchedPaymentView[]> {
  return prisma.payment.findMany({
    where: { schoolId, isUnmatched: true, status: 'SUCCESS' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      schoolId: true,
      amount: true,
      method: true,
      campayRef: true,
      operatorRef: true,
      phoneNumber: true,
      paidAt: true,
      createdAt: true,
      studentId: true,
    },
  });
}

