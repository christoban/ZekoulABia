import type { PrismaClient, Expense } from '@prisma/client';
import { Depense } from '@domain/entities/Depense';
import type { DepenseRepository } from '@domain/ports/repositories/DepenseRepository';

export class PrismaDepenseRepository implements DepenseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Depense | null> {
    const data = await this.prisma.expense.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findBySchool(schoolId: string): Promise<Depense[]> {
    const data = await this.prisma.expense.findMany({ where: { schoolId } });
    return data.map(d => this.toDomain(d));
  }

  async findByCategorie(schoolId: string, categorie: string): Promise<Depense[]> {
    const data = await this.prisma.expense.findMany({
      where: { schoolId, category: categorie },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByPeriode(schoolId: string, debut: Date, fin: Date): Promise<Depense[]> {
    const data = await this.prisma.expense.findMany({
      where: { schoolId, date: { gte: debut, lte: fin } },
    });
    return data.map(d => this.toDomain(d));
  }

  async getTotalDepenses(schoolId: string, debut?: Date, fin?: Date): Promise<number> {
    const where: Record<string, unknown> = { schoolId };
    if (debut || fin) {
      const dateFilter: Record<string, Date> = {};
      if (debut) dateFilter.gte = debut;
      if (fin) dateFilter.lte = fin;
      where.date = dateFilter;
    }
    const result = await this.prisma.expense.aggregate({
      where,
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  async save(depense: Depense): Promise<void> {
    const data = depense.toObject();
    await this.prisma.expense.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        label: data.label,
        amount: data.amount,
        currency: data.currency,
        category: data.category,
        date: data.date,
        createdById: data.createdById,
      },
    });
  }

  async update(depense: Depense): Promise<void> {
    const data = depense.toObject();
    await this.prisma.expense.update({
      where: { id: data.id },
      data: {
        label: data.label,
        amount: data.amount,
        category: data.category ?? null,
        date: data.date,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.expense.delete({ where: { id } });
  }

  private toDomain(data: Expense): Depense {
    return Depense.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      label: data.label,
      amount: data.amount,
      currency: data.currency,
      category: data.category ?? undefined,
      date: data.date,
      createdById: data.createdById ?? '',
    });
  }
}
