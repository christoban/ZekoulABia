import type { PrismaClient, Invoice } from '@prisma/client';
import { Facture } from '@domain/entities/Facture';
import type {
  DiscountInput,
  DiscountView,
  FactureRepository,
  FactureEnRetard,
  InstallmentInput,
  InstallmentView,
  PromisePaymentInput,
} from '@domain/ports/repositories/FactureRepository';
import type { DiscountReasonType, InvoiceStatus } from '@domain/types/enums';
import {
  buildDefaultInstallmentsData,
  reallocateInvoiceInstallments,
} from './helpers/financeSequenceHelper';

export class PrismaFactureRepository implements FactureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Facture | null> {
    const data = await this.prisma.invoice.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByEleve(studentId: string): Promise<Facture[]> {
    const data = await this.prisma.invoice.findMany({ where: { studentId } });
    return data.map(d => this.toDomain(d));
  }

  async findBySchool(schoolId: string): Promise<Facture[]> {
    const data = await this.prisma.invoice.findMany({ where: { schoolId } });
    return data.map(d => this.toDomain(d));
  }

  async findByStatut(schoolId: string, statut: InvoiceStatus): Promise<Facture[]> {
    const data = await this.prisma.invoice.findMany({
      where: { schoolId, status: statut },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByClasse(classId: string): Promise<Facture[]> {
    const eleves = await this.prisma.studentProfile.findMany({
      where: { enrollmentsYearScoped: { some: { classId, status: 'ACTIVE' as const, academicYear: { isCurrent: true } } } },
      select: { userId: true },
    });
    const studentIds = eleves.map(e => e.userId);
    const data = await this.prisma.invoice.findMany({
      where: { studentId: { in: studentIds } },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByPlanFrais(feePlanId: string): Promise<Facture[]> {
    const data = await this.prisma.invoice.findMany({ where: { feePlanId } });
    return data.map(d => this.toDomain(d));
  }

  /**
   * Correction du bug loadInvoiceTotals :
   * filtre UNIQUEMENT les paiements SUCCESS (pas PENDING ni FAILED).
   */
  async calculerTotalPayeAvecSucces(factureId: string): Promise<number> {
    const resultat = await this.prisma.payment.aggregate({
      where: { invoiceId: factureId, status: 'SUCCESS' },
      _sum: { amount: true },
    });
    return resultat._sum.amount ?? 0;
  }

  async getElevesEnRetard(schoolId: string): Promise<FactureEnRetard[]> {
    const factures = await this.prisma.invoice.findMany({
      where: {
        schoolId,
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        dueDate: { lt: new Date() },
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
        payments: { where: { status: 'SUCCESS' }, select: { amount: true } },
      },
    });

    const parEleve = new Map<string, FactureEnRetard>();
    for (const f of factures) {
      const totalPaye = f.payments.reduce((s, p) => s + p.amount, 0);
      const existing = parEleve.get(f.studentId);
      if (existing) {
        existing.totalDu += f.amount;
        existing.totalPaye += totalPaye;
        existing.solde += f.amount - totalPaye;
        existing.nombreFacturesEnRetard += 1;
      } else {
        parEleve.set(f.studentId, {
          studentId: f.studentId,
          studentNom: `${f.student.firstName} ${f.student.lastName}`,
          totalDu: f.amount,
          totalPaye: totalPaye,
          solde: f.amount - totalPaye,
          nombreFacturesEnRetard: 1,
        });
      }
    }
    return [...parEleve.values()];
  }

  async aFactureImpayeeBloquante(studentId: string): Promise<boolean> {
    const count = await this.prisma.invoice.count({
      where: {
        studentId,
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      },
    });
    return count > 0;
  }

  async save(facture: Facture): Promise<void> {
    const data = facture.toObject();
    await this.prisma.$transaction(async (tx) => {
      const cfg = await tx.schoolConfig.findUnique({
        where: { schoolId: data.schoolId },
        select: { defaultInstallmentsCount: true },
      });
      const count = cfg?.defaultInstallmentsCount ?? 3;
      const gross = Math.round(data.grossAmount ?? data.amount);
      const net = Math.round(data.amount);

      await tx.invoice.create({
        data: {
          id: data.id,
          schoolId: data.schoolId,
          studentId: data.studentId,
          feePlanId: data.feePlanId,
          academicYearId: data.academicYearId,
          amount: net,
          grossAmount: gross,
          discountTotal: Math.round(data.discountTotal ?? 0),
          currency: data.currency,
          dueDate: data.dueDate,
          status: data.status,
          description: data.description,
          createdAt: data.createdAt,
        },
      });

      const installmentsData = buildDefaultInstallmentsData({
        schoolId: data.schoolId,
        invoiceId: data.id,
        netAmount: net,
        count,
        dueDate: data.dueDate ?? null,
      });
      if (installmentsData.length > 0) {
        await tx.invoiceInstallment.createMany({ data: installmentsData });
      }
    });
  }

  async update(facture: Facture): Promise<void> {
    const data = facture.toObject();
    await this.prisma.invoice.update({
      where: { id: data.id },
      data: { status: data.status },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.invoice.delete({ where: { id } });
  }

  async getInstallments(invoiceId: string): Promise<InstallmentView[]> {
    const rows = await this.prisma.invoiceInstallment.findMany({
      where: { invoiceId },
      orderBy: { trancheNumber: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      invoiceId: r.invoiceId,
      trancheNumber: r.trancheNumber,
      label: r.label,
      amount: r.amount,
      paidAmount: r.paidAmount,
      dueDate: r.dueDate,
      status: r.status as InvoiceStatus,
    }));
  }

  async getDiscounts(invoiceId: string): Promise<DiscountView[]> {
    const rows = await this.prisma.studentDiscount.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      schoolId: r.schoolId,
      invoiceId: r.invoiceId,
      studentId: r.studentId,
      reasonType: r.reasonType as DiscountReasonType,
      amount: r.amount,
      percentage: r.percentage ?? null,
      justification: r.justification,
      grantedById: r.grantedById,
      createdAt: r.createdAt,
    }));
  }

  async configurerEcheancier(
    invoiceId: string,
    schoolId: string,
    tranches: InstallmentInput[],
  ): Promise<{ invoiceId: string; netAmount: number; installments: InstallmentView[] }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
      const inv = await tx.invoice.findFirst({ where: { id: invoiceId, schoolId } });
      if (!inv) throw new Error(`Facture introuvable : ${invoiceId}`);
      if (inv.status === 'CANCELLED') throw new Error("Impossible de modifier l'échéancier d'une facture annulée");
      if (tranches.length === 0 || tranches.length > 12) {
        throw new Error('Le nombre de tranches doit être compris entre 1 et 12');
      }

      const normalized = tranches.map((t, idx) => ({
        trancheNumber: t.trancheNumber ?? idx + 1,
        label: t.label.trim() || `Tranche ${idx + 1}/${tranches.length}`,
        amount: Math.round(t.amount),
        dueDate: new Date(t.dueDate),
      }));
      const sum = normalized.reduce((s, t) => s + t.amount, 0);
      if (normalized.some((t) => t.amount <= 0) || sum !== Math.round(inv.amount)) {
        throw new Error(`La somme des tranches (${sum}) doit égaler le montant net de la facture (${Math.round(inv.amount)})`);
      }

      await tx.payment.updateMany({
        where: { invoiceId, installmentId: { not: null } },
        data: { installmentId: null },
      });
      await tx.invoiceInstallment.deleteMany({ where: { invoiceId } });
      await tx.invoiceInstallment.createMany({
        data: normalized.map((t) => ({
          schoolId,
          invoiceId,
          trancheNumber: t.trancheNumber,
          label: t.label,
          amount: t.amount,
          paidAmount: 0,
          dueDate: t.dueDate,
          status: 'PENDING' as InvoiceStatus,
        })),
      });
      await reallocateInvoiceInstallments(tx, invoiceId);

      const saved = await tx.invoiceInstallment.findMany({
        where: { invoiceId },
        orderBy: { trancheNumber: 'asc' },
      });
      return {
        invoiceId,
        netAmount: Math.round(inv.amount),
        installments: saved.map((r) => ({
          id: r.id,
          invoiceId: r.invoiceId,
          trancheNumber: r.trancheNumber,
          label: r.label,
          amount: r.amount,
          paidAmount: r.paidAmount,
          dueDate: r.dueDate,
          status: r.status as InvoiceStatus,
        })),
      };
    });
  }

  async appliquerRemise(input: DiscountInput): Promise<{
    invoice: Facture;
    discount: DiscountView;
    installments: InstallmentView[];
  }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${input.invoiceId} FOR UPDATE`;
      const inv = await tx.invoice.findFirst({
        where: { id: input.invoiceId, schoolId: input.schoolId },
      });
      if (!inv) throw new Error(`Facture introuvable : ${input.invoiceId}`);
      if (inv.status === 'CANCELLED') throw new Error("Impossible d'appliquer une remise sur une facture annulée");

      const discountAmount = Math.round(input.amount);
      if (discountAmount <= 0) throw new Error('Le montant de la remise doit être supérieur à 0');
      if (!input.justification.trim()) throw new Error('Une justification écrite est obligatoire pour toute remise');

      const paidAgg = await tx.payment.aggregate({
        where: { invoiceId: inv.id, status: 'SUCCESS' },
        _sum: { amount: true },
      });
      const totalPaid = Math.round(paidAgg._sum.amount ?? 0);
      const resteAvant = Math.max(0, Math.round(inv.amount) - totalPaid);
      if (discountAmount > resteAvant) {
        throw new Error(`La remise (${discountAmount}) dépasse le solde restant à payer (${resteAvant})`);
      }

      const gross = Math.round(inv.grossAmount ?? inv.amount);
      const newDiscountTotal = Math.round(inv.discountTotal + discountAmount);
      const newNet = Math.max(0, gross - newDiscountTotal);
      const nextStatus: InvoiceStatus =
        totalPaid >= newNet
          ? 'PAID'
          : totalPaid > 0
            ? 'PARTIAL'
            : inv.dueDate && inv.dueDate < new Date()
              ? 'OVERDUE'
              : 'PENDING';

      const discount = await tx.studentDiscount.create({
        data: {
          schoolId: input.schoolId,
          invoiceId: inv.id,
          studentId: inv.studentId,
          reasonType: input.reasonType,
          amount: discountAmount,
          percentage: input.percentage ?? null,
          justification: input.justification.trim(),
          grantedById: input.grantedById,
        },
      });

      const updatedInv = await tx.invoice.update({
        where: { id: inv.id },
        data: { grossAmount: gross, discountTotal: newDiscountTotal, amount: newNet, status: nextStatus },
      });

      // Réduire les dernières tranches impayées du montant de la remise
      const installments = await tx.invoiceInstallment.findMany({
        where: { invoiceId: inv.id },
        orderBy: { trancheNumber: 'desc' },
      });
      let toDeduct = discountAmount;
      for (const inst of installments) {
        if (toDeduct <= 0) break;
        const reducible = Math.max(0, Math.round(inst.amount) - Math.round(inst.paidAmount));
        if (reducible <= 0) continue;
        const drop = Math.min(reducible, toDeduct);
        await tx.invoiceInstallment.update({
          where: { id: inst.id },
          data: { amount: Math.round(inst.amount) - drop },
        });
        toDeduct -= drop;
      }
      await reallocateInvoiceInstallments(tx, inv.id);

      const updatedInstallments = await tx.invoiceInstallment.findMany({
        where: { invoiceId: inv.id },
        orderBy: { trancheNumber: 'asc' },
      });

      return {
        invoice: this.toDomain(updatedInv),
        discount: {
          id: discount.id,
          schoolId: discount.schoolId,
          invoiceId: discount.invoiceId,
          studentId: discount.studentId,
          reasonType: discount.reasonType as DiscountReasonType,
          amount: discount.amount,
          percentage: discount.percentage ?? null,
          justification: discount.justification,
          grantedById: discount.grantedById,
          createdAt: discount.createdAt,
        },
        installments: updatedInstallments.map((r) => ({
          id: r.id,
          invoiceId: r.invoiceId,
          trancheNumber: r.trancheNumber,
          label: r.label,
          amount: r.amount,
          paidAmount: r.paidAmount,
          dueDate: r.dueDate,
          status: r.status as InvoiceStatus,
        })),
      };
    });
  }

  async enregistrerPromessePaiement(input: PromisePaymentInput): Promise<Facture> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id: input.invoiceId, schoolId: input.schoolId },
    });
    if (!existing) throw new Error(`Facture introuvable : ${input.invoiceId}`);
    const updated = await this.prisma.invoice.update({
      where: { id: existing.id },
      data: {
        promisedPaymentDate: input.promisedDate,
        promisedPaymentNote: input.note?.trim() ?? null,
        promisedByUserId: input.promisedByUserId,
        promisedAt: new Date(),
      },
    });
    return this.toDomain(updated);
  }

  async calculerAvoirDisponible(schoolId: string, studentId: string): Promise<number> {
    const agg = await this.prisma.studentCreditLedger.aggregate({
      where: { schoolId, studentId },
      _sum: { amount: true },
    });
    return Math.max(0, Math.round(agg._sum.amount ?? 0));
  }

  private toDomain(data: Invoice): Facture {
    return Facture.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      studentId: data.studentId,
      feePlanId: data.feePlanId ?? undefined,
      academicYearId: data.academicYearId ?? undefined,
      amount: data.amount,
      grossAmount: data.grossAmount ?? undefined,
      discountTotal: data.discountTotal,
      currency: data.currency,
      dueDate: data.dueDate ?? undefined,
      status: data.status as InvoiceStatus,
      description: data.description ?? undefined,
      promisedPaymentDate: data.promisedPaymentDate ?? undefined,
      promisedPaymentNote: data.promisedPaymentNote ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
