import type {
  PrismaClient,
  Prisma,
  FeeType as PrismaFeeType,
  InvoiceStatus as PrismaInvoiceStatus,
  UserRole as PrismaUserRole,
} from '@prisma/client';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';
import type {
  ClassDirectorySummary,
  ClassStudentDirectoryUserRecord,
  FeePlanListRecord,
  InvoiceDirectoryRecord,
  ListInvoicesDirectoryFilter,
  ListInvoicesDirectoryResult,
  ListUsersDirectoryFilter,
  ListUsersDirectoryResult,
  SchoolProfileSummary,
  SchoolProfileUpdateInput,
  StaffDirectoryQueryRepository,
  StaffDirectoryUserRecord,
  StudentForOfficialPhotoRecord,
  UpdatedOfficialPhotoResult,
} from '@domain/ports/repositories/StaffDirectoryQueryRepository';

export class PrismaStaffDirectoryQueryRepository implements StaffDirectoryQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listUsers(filter: ListUsersDirectoryFilter): Promise<ListUsersDirectoryResult> {
    const where: Prisma.UserWhereInput = {
      schoolId: filter.schoolId,
      ...(filter.role ? { role: filter.role as unknown as PrismaUserRole } : {}),
      ...(filter.classId && filter.role === 'STUDENT' ? whereElevesParClasse(filter.classId) : {}),
      ...(filter.search
        ? {
            OR: [
              { firstName: { contains: filter.search, mode: 'insensitive' } },
              { lastName: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rawUsers, roleGroups] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          studentProfile: {
            select: {
              id: true,
              dateOfBirth: true,
              gender: true,
              photoUrl: true,
              matricule: true,
              enrollmentsYearScoped: {
                where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                select: { classId: true, class: { select: { name: true } } },
                take: 1,
              },
            },
          },
          staffProfile: { select: { title: true } },
          teacherProfile: {
            select: {
              teacherSubjects: {
                select: { subjectId: true, subject: { select: { name: true } } },
              },
            },
          },
          classesProfessorPrincipal: { select: { id: true, name: true } },
        },
        orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
        skip: filter.skip,
        take: filter.take,
      }),
      filter.includeRoleCounts
        ? this.prisma.user.groupBy({ by: ['role'], where: { schoolId: filter.schoolId }, _count: { id: true } })
        : Promise.resolve(null),
    ]);

    const users: StaffDirectoryUserRecord[] = rawUsers.map((u) => {
      if (!u.studentProfile) {
        return u as unknown as StaffDirectoryUserRecord;
      }
      const enrollment = u.studentProfile.enrollmentsYearScoped?.[0];
      const { enrollmentsYearScoped: _enr, ...profileRest } = u.studentProfile;
      return {
        ...u,
        studentProfile: {
          ...profileRest,
          classId: enrollment?.classId ?? null,
          class: enrollment?.class ?? null,
        },
      } as unknown as StaffDirectoryUserRecord;
    });

    const roleCounts = roleGroups
      ? Object.fromEntries(roleGroups.map((g) => [g.role, g._count.id]))
      : undefined;

    return { total, users, roleCounts };
  }

  async findClassSummary(classId: string, schoolId: string): Promise<ClassDirectorySummary | null> {
    return this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true, level: true },
    });
  }

  async listClassStudentsDirectory(
    classId: string,
    schoolId: string,
  ): Promise<ClassStudentDirectoryUserRecord[]> {
    return this.prisma.user.findMany({
      where: {
        schoolId,
        role: 'STUDENT',
        isActive: true,
        ...whereElevesParClasse(classId),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
        studentProfile: {
          select: {
            id: true,
            matricule: true,
            numeroInterne: true,
            photoUrl: true,
            gender: true,
            dateOfBirth: true,
            healthScore: true,
            parents: {
              select: {
                parentProfile: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async findStudentForOfficialPhoto(
    studentUserId: string,
    schoolId: string,
  ): Promise<StudentForOfficialPhotoRecord | null> {
    return this.prisma.user.findFirst({
      where: { id: studentUserId, schoolId, role: 'STUDENT' },
      include: { studentProfile: { select: { id: true, photoUrl: true } } },
    });
  }

  async updateStudentOfficialPhoto(
    studentProfileId: string,
    photoUrl: string | null,
  ): Promise<UpdatedOfficialPhotoResult> {
    return this.prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: { photoUrl },
      select: { id: true, photoUrl: true, matricule: true },
    });
  }

  async logOfficialPhotoUpdate(params: {
    schoolId: string;
    actorUserId: string;
    description: string;
    studentUserId: string;
    hasPhoto: boolean;
  }): Promise<void> {
    await this.prisma.activitiesLog.create({
      data: {
        schoolId: params.schoolId,
        userId: params.actorUserId,
        action: 'STUDENT_OFFICIAL_PHOTO_UPDATE',
        description: params.description,
        metadata: { studentUserId: params.studentUserId, hasPhoto: params.hasPhoto },
      },
    });
  }

  async updateSchoolProfile(
    schoolId: string,
    input: SchoolProfileUpdateInput,
  ): Promise<SchoolProfileSummary> {
    return this.prisma.school.update({
      where: { id: schoolId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      },
      select: { id: true, name: true, city: true, phone: true, email: true, logoUrl: true, subdomain: true },
    });
  }

  async listFeePlans(schoolId: string, academicYearId?: string): Promise<FeePlanListRecord[]> {
    const plans = await this.prisma.feePlan.findMany({
      where: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
      include: { _count: { select: { invoices: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return plans as unknown as FeePlanListRecord[];
  }

  async getStaffPermissionsByUserId(userId: string): Promise<string[]> {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId },
      select: { permissions: { select: { permission: true } } },
    });
    return (staff?.permissions ?? []).map((perm) => String(perm.permission));
  }

  async listInvoices(filter: ListInvoicesDirectoryFilter): Promise<ListInvoicesDirectoryResult> {
    const where: Prisma.InvoiceWhereInput = {
      schoolId: filter.schoolId,
      ...(filter.status ? { status: filter.status as unknown as PrismaInvoiceStatus } : {}),
      ...(filter.feeType ? { feePlan: { feeType: filter.feeType as unknown as PrismaFeeType } } : {}),
    };

    const [total, invoices] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          feePlan: { select: { id: true, name: true, feeType: true, amount: true } },
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
          installments: { orderBy: { trancheNumber: 'asc' } },
          discounts: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: filter.skip,
        take: filter.take,
      }),
    ]);

    return {
      total,
      invoices: invoices as unknown as InvoiceDirectoryRecord[],
    };
  }
}
