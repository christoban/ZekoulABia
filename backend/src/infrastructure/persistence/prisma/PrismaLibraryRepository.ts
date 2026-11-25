import type { LoanStatus, Prisma, PrismaClient } from '@prisma/client';
import type {
  BookCatalogItem,
  BookLoanCatalogItem,
  BookLoanCreatedItem,
  BookLoanRecord,
  BookLoanWithBookTitle,
  BookRecord,
  CreateBookInput,
  LibraryLoanStatus,
  LibraryRepository,
  ParentMyLoanItem,
  StudentMyLoanItem,
  UpdateBookInput,
} from '@domain/ports/repositories/LibraryRepository';

export class PrismaLibraryRepository implements LibraryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listBooks(
    schoolId: string,
    filters: { search?: string; category?: string; page: number; limit: number },
  ): Promise<{ total: number; books: BookCatalogItem[] }> {
    const { search, category, page, limit } = filters;
    const where: Prisma.BookWhereInput = {
      schoolId,
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { author: { contains: search, mode: 'insensitive' } },
              { isbn: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, books] = await Promise.all([
      this.prisma.book.count({ where }),
      this.prisma.book.findMany({
        where,
        include: { _count: { select: { loans: { where: { status: 'ACTIVE' } } } } },
        orderBy: { title: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { total, books };
  }

  async createBook(input: CreateBookInput): Promise<BookRecord> {
    return this.prisma.book.create({
      data: {
        schoolId: input.schoolId,
        title: input.title,
        author: input.author,
        isbn: input.isbn,
        quantity: input.quantity,
        available: input.available,
        category: input.category,
      },
    });
  }

  async findBookByIdAndSchool(id: string, schoolId: string): Promise<BookRecord | null> {
    return this.prisma.book.findFirst({ where: { id, schoolId } });
  }

  async updateBook(id: string, input: UpdateBookInput): Promise<BookRecord> {
    return this.prisma.book.update({
      where: { id },
      data: input,
    });
  }

  async countActiveLoansForBook(bookId: string): Promise<number> {
    return this.prisma.bookLoan.count({
      where: { bookId, status: { in: ['ACTIVE', 'OVERDUE'] } },
    });
  }

  async deleteBook(id: string): Promise<void> {
    await this.prisma.book.delete({ where: { id } });
  }

  async listLoans(
    schoolId: string,
    filters: { status?: LibraryLoanStatus; page: number; limit: number },
  ): Promise<{ total: number; loans: BookLoanCatalogItem[] }> {
    const where: Prisma.BookLoanWhereInput = {
      schoolId,
      ...(filters.status ? { status: filters.status as LoanStatus } : {}),
    };

    const [total, loans] = await Promise.all([
      this.prisma.bookLoan.count({ where }),
      this.prisma.bookLoan.findMany({
        where,
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true } },
          student: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { borrowedAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return { total, loans };
  }

  async findStudentInSchool(studentId: string, schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { id: studentId, schoolId, role: 'STUDENT' },
      select: { id: true },
    });
  }

  async createLoanWithDecrement(input: {
    schoolId: string;
    bookId: string;
    studentId: string;
    dueDate: Date | null;
  }): Promise<BookLoanCreatedItem> {
    const [loan] = await this.prisma.$transaction([
      this.prisma.bookLoan.create({
        data: {
          schoolId: input.schoolId,
          bookId: input.bookId,
          studentId: input.studentId,
          dueDate: input.dueDate,
        },
        include: {
          book: { select: { id: true, title: true, author: true } },
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.book.update({
        where: { id: input.bookId },
        data: { available: { decrement: 1 } },
      }),
    ]);
    return loan;
  }

  async findLoanByIdAndSchool(id: string, schoolId: string): Promise<BookLoanRecord | null> {
    return this.prisma.bookLoan.findFirst({ where: { id, schoolId } });
  }

  async returnLoanWithIncrement(loanId: string, bookId: string): Promise<BookLoanWithBookTitle> {
    const [updated] = await this.prisma.$transaction([
      this.prisma.bookLoan.update({
        where: { id: loanId },
        data: { status: 'RETURNED', returnedAt: new Date() },
        include: { book: { select: { id: true, title: true } } },
      }),
      this.prisma.book.update({
        where: { id: bookId },
        data: { available: { increment: 1 } },
      }),
    ]);
    return updated;
  }

  async renewLoan(loanId: string, dueDate: Date): Promise<BookLoanWithBookTitle> {
    return this.prisma.bookLoan.update({
      where: { id: loanId },
      // Renouveler un emprunt en retard le remet ACTIVE — sinon le job markOverdueLoans le
      // re-marquerait OVERDUE dès le lendemain malgré la nouvelle date limite future.
      data: { dueDate, status: 'ACTIVE' },
      include: { book: { select: { id: true, title: true } } },
    });
  }

  async listLoansForStudent(schoolId: string, studentId: string): Promise<StudentMyLoanItem[]> {
    return this.prisma.bookLoan.findMany({
      where: { schoolId, studentId },
      include: { book: { select: { id: true, title: true, author: true, category: true } } },
      orderBy: { borrowedAt: 'desc' },
      take: 50,
    });
  }

  async listLoansForStudents(schoolId: string, studentIds: string[]): Promise<ParentMyLoanItem[]> {
    return this.prisma.bookLoan.findMany({
      where: { schoolId, studentId: { in: studentIds } },
      include: {
        book: { select: { id: true, title: true, author: true, category: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { borrowedAt: 'desc' },
      take: 100,
    });
  }
}
