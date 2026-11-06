import type { PrismaClient, StaffPermissionType } from '@prisma/client';
import type {
  FinanceJobsRepository,
  OverdueInvoiceDto,
  AttendanceGroupDto,
  StaffWithUserDto,
  OverdueBookLoanDto,
} from '@domain/ports/repositories/FinanceJobsRepository';

export class PrismaFinanceJobsRepository implements FinanceJobsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveSchools(): Promise<{ id: string }[]> {
    return this.prisma.school.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  }

  async getSchoolConfigAbsenceThreshold(schoolId: string): Promise<number | null> {
    const cfg = await this.prisma.schoolConfig.findUnique({
      where: { schoolId },
      select: { absenceAlertThreshold: true },
    });
    return cfg?.absenceAlertThreshold ?? null;
  }

  async findOverdueInvoicesDueWithin(daysAhead: number): Promise<OverdueInvoiceDto[]> {
    const today = new Date();
    const limit = new Date(today);
    limit.setDate(today.getDate() + daysAhead);
    const rows = await this.prisma.invoice.findMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: { lte: limit },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            studentProfile: {
              include: {
                parents: {
                  include: {
                    parentProfile: {
                      include: { user: { select: { id: true, email: true } } },
                    },
                  },
                },
              },
            },
          },
        },
        school: { select: { name: true } },
        feePlan: { select: { name: true } },
      },
    });
    return rows as unknown as OverdueInvoiceDto[];
  }

  async countAbsencesGrouped(schoolId: string, since: Date): Promise<AttendanceGroupDto[]> {
    return this.prisma.attendance.groupBy({
      by: ["studentId"],
      where: { schoolId, status: "ABSENT", date: { gte: since } },
      _count: { id: true },
    }) as unknown as AttendanceGroupDto[];
  }

  async findStaffByPermissionWithUser(schoolId: string, permission: string): Promise<StaffWithUserDto[]> {
    return this.prisma.staffProfile.findMany({
      where: { schoolId, permissions: { some: { permission: permission as StaffPermissionType } } },
      include: { user: { select: { id: true, email: true, firstName: true } } },
    }) as unknown as StaffWithUserDto[];
  }

  async findUserById(id: string): Promise<{ firstName: string; lastName: string } | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { firstName: true, lastName: true },
    });
  }

  async findOverdueBookLoans(now: Date): Promise<OverdueBookLoanDto[]> {
    return this.prisma.bookLoan.findMany({
      where: { status: "ACTIVE", dueDate: { lt: now } },
      select: {
        id: true, schoolId: true, studentId: true,
        book: { select: { title: true } },
        student: { select: { firstName: true, lastName: true } },
      },
    }) as unknown as OverdueBookLoanDto[];
  }

  async markBookLoansOverdue(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.bookLoan.updateMany({
      where: { id: { in: ids } },
      data: { status: "OVERDUE" },
    });
  }
}
