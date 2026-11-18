/**
 * INFRASTRUCTURE LAYER — Opérations Prisma Discipline, APEE, Bibliothèque et Orientation pour `PrismaCopilotPortalGateway`.
 */
import type { PrismaClient } from '@prisma/client';
import { whereProfilesParClasse } from '@application/shared/studentEnrollment';
import type {
  PortalActiveBookLoan,
  PortalActiveDisciplineRecord,
  PortalActiveStudentBookLoansParams,
  PortalApeeBalanceSummary,
  PortalBookAvailability,
  PortalBookLoanMutationParams,
  PortalBookSearchResult,
  PortalCreateBookLoanParams,
  PortalCreateDisciplineRecordParams,
  PortalDisciplineRecordSummary,
  PortalOrientationFicheLookup,
  PortalOrientationRiskFiche,
  PortalOrientationRiskLookup,
  PortalPendingApeeExpense,
} from '@domain/ports/repositories/copilot/CopilotPortalTypes';

export async function createDisciplineRecord(
  prisma: PrismaClient,
  params: PortalCreateDisciplineRecordParams,
): Promise<{ id: string }> {
  return prisma.disciplineRecord.create({
    data: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      type: params.type,
      reason: params.reason,
      decidedById: params.decidedById,
      ...(params.startDate ? { startDate: params.startDate } : {}),
      ...(params.endDate ? { endDate: params.endDate } : {}),
    },
    select: { id: true },
  });
}

export async function findLatestActiveDisciplineRecord(
  prisma: PrismaClient,
  schoolId: string,
  studentId: string,
): Promise<PortalActiveDisciplineRecord | null> {
  return prisma.disciplineRecord.findFirst({
    where: { schoolId, studentId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true },
  });
}

export async function liftDisciplineRecordById(
  prisma: PrismaClient,
  schoolId: string,
  recordId: string,
): Promise<void> {
  await prisma.disciplineRecord.update({
    where: { id: recordId, schoolId },
    data: { status: 'LIFTED' },
  });
}

export async function findRecentDisciplineRecords(
  prisma: PrismaClient,
  schoolId: string,
  studentId: string,
  take: number,
): Promise<PortalDisciplineRecordSummary[]> {
  return prisma.disciplineRecord.findMany({
    where: { schoolId, studentId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { type: true, reason: true, status: true, createdAt: true },
  });
}

export async function deleteApeeTransactionById(
  prisma: PrismaClient,
  schoolId: string,
  transactionId: string,
): Promise<void> {
  await prisma.aPEETransaction.delete({ where: { id: transactionId, schoolId } });
}

export async function findPendingApeeExpenseByDescription(
  prisma: PrismaClient,
  schoolId: string,
  descriptionContains: string,
): Promise<PortalPendingApeeExpense | null> {
  return prisma.aPEETransaction.findFirst({
    where: {
      schoolId,
      type: 'DEPENSE',
      valide: false,
      description: { contains: descriptionContains, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, montant: true },
  });
}

export async function getApeeBalanceSummary(
  prisma: PrismaClient,
  schoolId: string,
): Promise<PortalApeeBalanceSummary> {
  const [collectes, depenses, pendingExpensesCount] = await Promise.all([
    prisma.aPEETransaction.aggregate({ where: { schoolId, type: 'COLLECTE' }, _sum: { montant: true } }),
    prisma.aPEETransaction.aggregate({ where: { schoolId, type: 'DEPENSE', valide: true }, _sum: { montant: true } }),
    prisma.aPEETransaction.count({ where: { schoolId, type: 'DEPENSE', valide: false } }),
  ]);
  return {
    totalCollectes: collectes._sum.montant ?? 0,
    totalDepenses: depenses._sum.montant ?? 0,
    pendingExpensesCount,
  };
}

export async function findBookByTitleContains(
  prisma: PrismaClient,
  schoolId: string,
  titleContains: string,
): Promise<PortalBookAvailability | null> {
  return prisma.book.findFirst({
    where: { schoolId, title: { contains: titleContains, mode: 'insensitive' } },
    select: { id: true, title: true, available: true },
  });
}

export async function searchBooks(
  prisma: PrismaClient,
  schoolId: string,
  query: string,
  take: number,
): Promise<PortalBookSearchResult[]> {
  return prisma.book.findMany({
    where: {
      schoolId,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { author: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { title: true, author: true, available: true, quantity: true },
    take,
  });
}

export async function findActiveStudentBookLoans(
  prisma: PrismaClient,
  params: PortalActiveStudentBookLoansParams,
): Promise<PortalActiveBookLoan[]> {
  const loans = await prisma.bookLoan.findMany({
    where: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      status: { in: ['ACTIVE', 'OVERDUE'] },
      ...(params.bookTitleContains
        ? { book: { title: { contains: params.bookTitleContains, mode: 'insensitive' } } }
        : {}),
    },
    select: { id: true, bookId: true, dueDate: true, status: true, book: { select: { title: true } } },
  });
  return loans.map((l) => ({
    id: l.id,
    bookId: l.bookId,
    bookTitle: l.book.title,
    dueDate: l.dueDate,
    status: l.status,
  }));
}

export async function createBookLoanTransaction(
  prisma: PrismaClient,
  params: PortalCreateBookLoanParams,
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.bookLoan.create({
      data: {
        schoolId: params.schoolId,
        bookId: params.bookId,
        studentId: params.studentId,
        dueDate: params.dueDate,
      },
      select: { id: true },
    });
    await tx.book.update({
      where: { id: params.bookId, schoolId: params.schoolId },
      data: { available: { decrement: 1 } },
    });
    return loan;
  });
}

export async function cancelBookLoanTransaction(
  prisma: PrismaClient,
  params: PortalBookLoanMutationParams,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.bookLoan.delete({ where: { id: params.loanId, schoolId: params.schoolId } });
    await tx.book.update({
      where: { id: params.bookId, schoolId: params.schoolId },
      data: { available: { increment: 1 } },
    });
  });
}

export async function returnBookLoanTransaction(
  prisma: PrismaClient,
  params: PortalBookLoanMutationParams,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.bookLoan.update({
      where: { id: params.loanId, schoolId: params.schoolId },
      data: { status: 'RETURNED', returnedAt: new Date() },
    });
    await tx.book.update({
      where: { id: params.bookId, schoolId: params.schoolId },
      data: { available: { increment: 1 } },
    });
  });
}

export async function findOpenOrientationFicheId(
  prisma: PrismaClient,
  params: PortalOrientationFicheLookup,
): Promise<string | null> {
  const fiche = await prisma.ficheOrientation.findFirst({
    where: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      academicYearId: params.academicYearId,
      status: { in: ['OUVERTE', 'EN_COURS'] },
    },
    select: { id: true },
  });
  return fiche?.id ?? null;
}

export async function findOpenHighRiskOrientationFiches(
  prisma: PrismaClient,
  params: PortalOrientationRiskLookup,
): Promise<PortalOrientationRiskFiche[]> {
  const fiches = await prisma.ficheOrientation.findMany({
    where: {
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      status: { in: ['OUVERTE', 'EN_COURS'] },
      riskLevel: { in: ['ELEVE', 'CRITIQUE'] },
      ...(params.classId ? { student: { studentProfile: whereProfilesParClasse(params.classId) } } : {}),
    },
    select: { riskLevel: true, student: { select: { firstName: true, lastName: true } } },
  });
  return fiches.map((f) => ({
    riskLevel: f.riskLevel,
    firstName: f.student.firstName,
    lastName: f.student.lastName,
  }));
}
