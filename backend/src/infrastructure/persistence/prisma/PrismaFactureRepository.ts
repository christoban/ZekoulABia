import type { PrismaClient, Invoice } from '@prisma/client';
import { Facture } from '@domain/entities/Facture';
import type {
  FactureRepository,
  FactureEnRetard,
} from '@domain/ports/repositories/FactureRepository';
import type { InvoiceStatus } from '@domain/types/enums';

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
    await this.prisma.invoice.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        studentId: data.studentId,
        feePlanId: data.feePlanId,
        amount: data.amount,
        currency: data.currency,
        dueDate: data.dueDate,
        status: data.status,
        description: data.description,
        createdAt: data.createdAt,
      },
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

  private toDomain(data: Invoice): Facture {
    return Facture.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      studentId: data.studentId,
      feePlanId: data.feePlanId ?? undefined,
      amount: data.amount,
      currency: data.currency,
      dueDate: data.dueDate ?? undefined,
      status: data.status as InvoiceStatus,
      description: data.description ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
