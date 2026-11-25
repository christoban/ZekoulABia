/**
 * DOMAIN LAYER — Port Repository Bibliothèque (ouvrages et emprunts)
 * Encapsule l'accès aux tables Book et BookLoan dans le scope d'un établissement.
 */

export type LibraryLoanStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE';

export interface BookRecord {
  id: string;
  schoolId: string;
  title: string;
  author: string | null;
  isbn: string | null;
  quantity: number;
  available: number;
  category: string | null;
  createdAt: Date;
}

export interface BookCatalogItem extends BookRecord {
  _count: {
    loans: number;
  };
}

export interface BookLoanRecord {
  id: string;
  schoolId: string;
  bookId: string;
  studentId: string;
  borrowedAt: Date;
  dueDate: Date | null;
  returnedAt: Date | null;
  status: LibraryLoanStatus;
}

export interface BookLoanCatalogItem extends BookLoanRecord {
  book: {
    id: string;
    title: string;
    author: string | null;
    isbn: string | null;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface BookLoanCreatedItem extends BookLoanRecord {
  book: {
    id: string;
    title: string;
    author: string | null;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface BookLoanWithBookTitle extends BookLoanRecord {
  book: {
    id: string;
    title: string;
  };
}

export interface StudentMyLoanItem extends BookLoanRecord {
  book: {
    id: string;
    title: string;
    author: string | null;
    category: string | null;
  };
}

export interface ParentMyLoanItem extends StudentMyLoanItem {
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateBookInput {
  schoolId: string;
  title: string;
  author: string | null;
  isbn: string | null;
  quantity: number;
  available: number;
  category: string | null;
}

export interface UpdateBookInput {
  title?: string;
  author?: string | null;
  isbn?: string | null;
  quantity?: number;
  available?: number;
  category?: string | null;
}

export interface LibraryRepository {
  listBooks(
    schoolId: string,
    filters: { search?: string; category?: string; page: number; limit: number },
  ): Promise<{ total: number; books: BookCatalogItem[] }>;

  createBook(input: CreateBookInput): Promise<BookRecord>;

  findBookByIdAndSchool(id: string, schoolId: string): Promise<BookRecord | null>;

  updateBook(id: string, input: UpdateBookInput): Promise<BookRecord>;

  countActiveLoansForBook(bookId: string): Promise<number>;

  deleteBook(id: string): Promise<void>;

  listLoans(
    schoolId: string,
    filters: { status?: LibraryLoanStatus; page: number; limit: number },
  ): Promise<{ total: number; loans: BookLoanCatalogItem[] }>;

  findStudentInSchool(studentId: string, schoolId: string): Promise<{ id: string } | null>;

  createLoanWithDecrement(input: {
    schoolId: string;
    bookId: string;
    studentId: string;
    dueDate: Date | null;
  }): Promise<BookLoanCreatedItem>;

  findLoanByIdAndSchool(id: string, schoolId: string): Promise<BookLoanRecord | null>;

  returnLoanWithIncrement(loanId: string, bookId: string): Promise<BookLoanWithBookTitle>;

  renewLoan(loanId: string, dueDate: Date): Promise<BookLoanWithBookTitle>;

  listLoansForStudent(schoolId: string, studentId: string): Promise<StudentMyLoanItem[]>;

  listLoansForStudents(schoolId: string, studentIds: string[]): Promise<ParentMyLoanItem[]>;
}
