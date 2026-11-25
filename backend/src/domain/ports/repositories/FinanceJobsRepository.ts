/**
 * Port — Finance Jobs (Inngest) : abstraction des requêtes Prisma
 * utilisées par finance.ts
 */
export interface OverdueInvoiceDto {
  id: string;
  schoolId: string;
  studentId: string;
  amount: number;
  dueDate: Date | null;
  description: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    studentProfile: {
      parents: { parentProfile: { user: { id: string; email: string | null } } | null }[];
    } | null;
  } | null;
  school: { name: string } | null;
  feePlan: { name: string } | null;
}

export interface AttendanceGroupDto {
  studentId: string;
  _count: { id: number };
}

export interface StaffWithUserDto {
  user: { id: string; email: string | null; firstName: string };
}

export interface OverdueBookLoanDto {
  id: string;
  schoolId: string;
  studentId: string;
  book: { title: string };
  student: { firstName: string; lastName: string };
}

export interface FinanceJobsRepository {
  // Écoles / config
  findActiveSchools(): Promise<{ id: string }[]>;
  getSchoolConfigAbsenceThreshold(schoolId: string): Promise<number | null>;

  // Factures
  findOverdueInvoicesDueWithin(daysAhead: number): Promise<OverdueInvoiceDto[]>;

  // Présences
  countAbsencesGrouped(schoolId: string, since: Date): Promise<AttendanceGroupDto[]>;
  findStaffByPermissionWithUser(schoolId: string, permission: string): Promise<StaffWithUserDto[]>;
  findUserById(id: string): Promise<{ firstName: string; lastName: string } | null>;

  // Bibliothèque
  findOverdueBookLoans(now: Date): Promise<OverdueBookLoanDto[]>;
  markBookLoansOverdue(ids: string[]): Promise<void>;
}
