import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ParentFinancePortalRepository,
  ParentInvoiceDetailItem,
  ParentInvoiceOwnershipRecord,
  ParentPaymentOwnershipRecord,
} from '@domain/ports/repositories/ParentFinancePortalRepository';

export class PrismaParentFinancePortalRepository implements ParentFinancePortalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listInvoicesForParent(params: {
    schoolId: string;
    studentId?: string;
    childUserIds: string[];
    page: number;
    limit: number;
  }): Promise<{ total: number; invoices: ParentInvoiceDetailItem[] }> {
    const { schoolId, studentId, childUserIds, page, limit } = params;
    const where: Prisma.InvoiceWhereInput = {
      schoolId,
      studentId: studentId ? studentId : { in: childUserIds },
    };

    const [total, invoices] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          feePlan: { select: { id: true, name: true, feeType: true, amount: true } },
          installments: { orderBy: { trancheNumber: 'asc' } },
          discounts: { orderBy: { createdAt: 'desc' } },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              paidAt: true,
              method: true,
              feeType: true,
              cautionStatus: true,
              refundedAt: true,
              receiptNumber: true,
              provisionalReceiptNumber: true,
              cancellationReason: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { total, invoices };
  }

  async findInvoiceOwnership(
    invoiceId: string,
    schoolId: string,
  ): Promise<ParentInvoiceOwnershipRecord | null> {
    return this.prisma.invoice.findFirst({
      where: { id: invoiceId, schoolId },
      select: { id: true, schoolId: true, studentId: true },
    });
  }

  async findPaymentOwnership(filter: {
    paymentId?: string;
    campayRef?: string;
  }): Promise<ParentPaymentOwnershipRecord | null> {
    return this.prisma.payment.findFirst({
      where: filter.paymentId ? { id: filter.paymentId } : { campayRef: filter.campayRef },
      select: { id: true, schoolId: true, studentId: true },
    });
  }
}
