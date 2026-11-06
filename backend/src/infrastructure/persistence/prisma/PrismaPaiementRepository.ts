import type { PrismaClient, Prisma, Payment } from '@prisma/client';
import { Paiement } from '@domain/entities/Paiement';
import type { Facture } from '@domain/entities/Facture';
import type {
  PaiementRepository,
  RevenusParPeriode,
} from '@domain/ports/repositories/PaiementRepository';
import type { PaymentMethod, PaymentStatus, FeeType, CautionStatus } from '@domain/types/enums';

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
        amount: data.amount,
        currency: data.currency,
        method: data.method,
        status: data.status,
        feeType: data.feeType,
        cautionStatus: data.cautionStatus,
        campayRef: data.campayRef,
        campayStatus: data.campayStatus,
        phoneNumber: data.phoneNumber,
        createdAt: data.createdAt,
      },
    });
  }

  /**
   * V3.2 : encaissement cash ATOMIQUE.
   * La transaction re-vérifie à l'intérieur que la facture reste payable et que le
   * montant ne dépasse pas le solde restant, puis crée le paiement et met à jour la
   * facture. Deux encaissements simultanés ne peuvent pas tous deux dépasser le solde.
   */
  async encaisserCash(paiement: Paiement, facture: Facture): Promise<number> {
    const data = paiement.toObject();

    return this.prisma.$transaction(async (tx) => {
      // 0. Verrou pessimiste sur la ligne facture : les transactions concurrentes
      // se sérialisent ici — le totalPaye relu après est garanti à jour.
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${facture.id} FOR UPDATE`;

      // 1. Re-lire la facture dans la transaction (état à jour sous verrou)
      const factureData = await tx.invoice.findUnique({ where: { id: facture.id } });
      if (!factureData) throw new Error(`Facture introuvable : ${facture.id}`);
      if (factureData.status === 'PAID' || factureData.status === 'CANCELLED') {
        throw new Error('Cette facture ne peut plus être payée (annulée ou déjà payée)');
      }

      // 2. Solde restant à ce moment précis
      const paye = await tx.payment.aggregate({
        where: { invoiceId: facture.id, status: 'SUCCESS' },
        _sum: { amount: true },
      });
      const totalPaye = paye._sum.amount ?? 0;
      const resteARegler = Math.max(0, factureData.amount - totalPaye);
      if (data.amount > resteARegler) {
        throw new Error(
          `Le montant encaissé (${data.amount}) dépasse le solde restant de la facture (${resteARegler})`
        );
      }

      // 3. Créer le paiement SUCCESS
      await tx.payment.create({
        data: {
          id: data.id,
          schoolId: data.schoolId,
          invoiceId: data.invoiceId,
          studentId: data.studentId,
          amount: data.amount,
          currency: data.currency,
          method: data.method,
          status: data.status,
          feeType: data.feeType,
          cautionStatus: data.cautionStatus,
          campayRef: data.campayRef,
          campayStatus: data.campayStatus,
          phoneNumber: data.phoneNumber,
          createdAt: data.createdAt,
        },
      });

      // 4. Recalculer et appliquer le nouveau statut, puis persister
      const nouveauTotal = totalPaye + data.amount;
      facture.mettreAJourStatut(nouveauTotal);
      await tx.invoice.update({
        where: { id: facture.id },
        data: { status: facture.status },
      });

      return nouveauTotal;
    });
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
        paidAt: data.paidAt ?? null,
        refundedById: data.refundedById ?? null,
        refundedAt: data.refundedAt ?? null,
        refundTransactionId: data.refundTransactionId ?? null,
      },
    });
  }

  async findRecuData(paymentId: string): Promise<Prisma.PaymentGetPayload<{ include: { student: { include: { studentProfile: true } }; invoice: { include: { feePlan: true; payments: true } }; school: true } }> | null> {
    return this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: { include: { studentProfile: true } },
        invoice: { include: { feePlan: true, payments: true } },
        school: true,
      },
    });
  }

  private toDomain(data: Payment): Paiement {
    return Paiement.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      invoiceId: data.invoiceId ?? undefined,
      studentId: data.studentId,
      amount: data.amount,
      currency: data.currency,
      method: data.method as PaymentMethod,
      status: data.status as PaymentStatus,
      feeType: data.feeType as FeeType,
      cautionStatus: (data.cautionStatus as CautionStatus) ?? undefined,
      transactionId: data.transactionId ?? undefined,
      receiptUrl: data.receiptUrl ?? undefined,
      paidAt: data.paidAt ?? undefined,
      campayRef: data.campayRef ?? undefined,
      campayStatus: data.campayStatus ?? undefined,
      operatorRef: data.operatorRef ?? undefined,
      phoneNumber: data.phoneNumber ?? undefined,
      refundTransactionId: data.refundTransactionId ?? undefined,
      refundedAt: data.refundedAt ?? undefined,
      refundedById: data.refundedById ?? undefined,
      createdAt: data.createdAt,
    });
  }
}
