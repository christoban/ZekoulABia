import type { Prisma } from '@prisma/client';
import type { InvoiceStatus } from '@domain/types/enums';

export async function allocateSequentialReceiptNumber(
  tx: Prisma.TransactionClient,
  schoolId: string,
  txDate: Date,
): Promise<string> {
  const year = txDate.getUTCFullYear();
  const seq = await tx.receiptSequence.upsert({
    where: { schoolId_year: { schoolId, year } },
    create: { schoolId, year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return `REC-${year}-${String(seq.lastValue).padStart(5, '0')}`;
}

export function buildDefaultInstallmentsData(params: {
  schoolId: string;
  invoiceId: string;
  netAmount: number;
  count: number;
  dueDate?: Date | null;
}) {
  const n = Math.max(1, Math.min(12, Math.round(params.count || 3)));
  const total = Math.max(0, Math.round(params.netAmount));
  const base = Math.floor(total / n);
  const start = new Date();
  const finalDue = params.dueDate ? new Date(params.dueDate) : new Date(start.getTime() + 90 * 86400_000);

  return Array.from({ length: n }, (_, idx) => {
    const trancheNumber = idx + 1;
    const isLast = trancheNumber === n;
    const amount = isLast ? total - base * (n - 1) : base;
    let trancheDue: Date;
    if (n === 1) {
      trancheDue = finalDue;
    } else if (isLast) {
      trancheDue = finalDue;
    } else {
      const span = Math.max(30 * 86400_000, finalDue.getTime() - start.getTime());
      trancheDue = new Date(start.getTime() + Math.round((span * idx) / (n - 1)));
    }
    return {
      schoolId: params.schoolId,
      invoiceId: params.invoiceId,
      trancheNumber,
      label: `Tranche ${trancheNumber}/${n}`,
      amount,
      paidAmount: 0,
      dueDate: trancheDue,
      status: 'PENDING' as InvoiceStatus,
    };
  });
}

export async function reallocateInvoiceInstallments(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<void> {
  const [payAgg, installments] = await Promise.all([
    tx.payment.aggregate({
      where: { invoiceId, status: 'SUCCESS' },
      _sum: { amount: true },
    }),
    tx.invoiceInstallment.findMany({
      where: { invoiceId },
      orderBy: { trancheNumber: 'asc' },
    }),
  ]);
  if (installments.length === 0) return;

  let remainingPool = Math.round(payAgg._sum.amount ?? 0);
  for (const inst of installments) {
    const cap = Math.round(inst.amount);
    const allocated = Math.min(cap, Math.max(0, remainingPool));
    remainingPool = Math.max(0, remainingPool - allocated);
    const nextStatus: InvoiceStatus =
      allocated >= cap && cap > 0
        ? 'PAID'
        : allocated > 0
          ? 'PARTIAL'
          : inst.dueDate < new Date()
            ? 'OVERDUE'
            : 'PENDING';

    await tx.invoiceInstallment.update({
      where: { id: inst.id },
      data: { paidAmount: allocated, status: nextStatus },
    });
  }
}

export async function assertCashDateOpen(
  tx: Prisma.TransactionClient,
  schoolId: string,
  txDate: Date,
): Promise<void> {
  const start = new Date(Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth(), txDate.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth(), txDate.getUTCDate(), 23, 59, 59, 999));
  const closed = await tx.cashClosure.findFirst({
    where: { schoolId, closureDate: { gte: start, lte: end } },
    select: { id: true, closureDate: true },
  });
  if (closed) {
    throw new Error('La caisse de cette journée est déjà clôturée — encaissement en espèces refusé');
  }
}

