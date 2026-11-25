import type { PrismaClient, LiaisonCategory as PrismaLiaisonCategory } from '@prisma/client';
import type {
  CarnetLiaisonRepository,
  CreateLiaisonEntryInput,
  LiaisonEntryItem,
  LiaisonFilters,
  LiaisonResponseItem,
  ParentRecipientContact,
} from '@domain/ports/repositories/CarnetLiaisonRepository';
import type { LiaisonCategory } from '@domain/types/enums';
import { isNiveauPrimaireOuMaternelle } from '../../../lib/classSerieValidator';
import { getTemplateMeta } from '../../../application/school/schoolTemplateConfig';

const ENTRY_INCLUDE = {
  student: { select: { id: true, firstName: true, lastName: true } },
  author: { select: { id: true, firstName: true, lastName: true, role: true } },
  class: { select: { id: true, name: true } },
  readReceipts: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
    orderBy: { readAt: 'asc' as const },
  },
  responses: {
    include: {
      author: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

export class PrismaCarnetLiaisonRepository implements CarnetLiaisonRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async creer(input: CreateLiaisonEntryInput): Promise<LiaisonEntryItem> {
    let resolvedAcademicYearId = input.academicYearId ?? null;
    if (!resolvedAcademicYearId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { schoolId: input.schoolId, isCurrent: true },
        select: { id: true },
      });
      resolvedAcademicYearId = currentYear?.id ?? null;
    }

    let resolvedClassId = input.classId ?? null;
    if (!resolvedClassId) {
      const profile = await this.prisma.studentProfile.findFirst({
        where: { userId: input.studentId, schoolId: input.schoolId },
        select: {
          enrollmentsYearScoped: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { classId: true },
          },
        },
      });
      resolvedClassId = profile?.enrollmentsYearScoped?.[0]?.classId ?? null;
    }

    const row = await this.prisma.liaisonEntry.create({
      data: {
        schoolId: input.schoolId,
        academicYearId: resolvedAcademicYearId,
        studentId: input.studentId,
        classId: resolvedClassId,
        authorId: input.authorId,
        authorRole: input.authorRole,
        category: input.category as PrismaLiaisonCategory,
        title: input.title,
        content: input.content,
        requiresConfirmation: Boolean(input.requiresConfirmation),
        confirmationPrompt: input.confirmationPrompt ?? null,
        attendanceId: input.attendanceId ?? null,
        paymentId: input.paymentId ?? null,
        isUrgent: Boolean(input.isUrgent),
        clientRecordedAt: input.clientRecordedAt ?? null,
        clockSkewSeconds: input.clockSkewSeconds ?? null,
      },
      include: ENTRY_INCLUDE,
    });

    return this.toItem(row);
  }

  async trouverParId(id: string, schoolId: string): Promise<LiaisonEntryItem | null> {
    const row = await this.prisma.liaisonEntry.findFirst({
      where: { id, schoolId },
      include: ENTRY_INCLUDE,
    });
    return row ? this.toItem(row) : null;
  }

  async trouverParAttendanceId(attendanceId: string, schoolId: string): Promise<LiaisonEntryItem | null> {
    const row = await this.prisma.liaisonEntry.findFirst({
      where: { attendanceId, schoolId },
      include: ENTRY_INCLUDE,
    });
    return row ? this.toItem(row) : null;
  }

  async trouverParPaymentId(paymentId: string, schoolId: string): Promise<LiaisonEntryItem | null> {
    const row = await this.prisma.liaisonEntry.findFirst({
      where: { paymentId, schoolId },
      include: ENTRY_INCLUDE,
    });
    return row ? this.toItem(row) : null;
  }

  async listerParEleve(
    studentId: string,
    schoolId: string,
    filtres?: LiaisonFilters,
  ): Promise<LiaisonEntryItem[]> {
    return this.listerParEleves([studentId], schoolId, filtres);
  }

  async listerParEleves(
    studentIds: string[],
    schoolId: string,
    filtres?: LiaisonFilters,
  ): Promise<LiaisonEntryItem[]> {
    if (studentIds.length === 0) return [];
    const rows = await this.prisma.liaisonEntry.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        ...(filtres?.academicYearId ? { academicYearId: filtres.academicYearId } : {}),
        ...(filtres?.category ? { category: filtres.category as PrismaLiaisonCategory } : {}),
        ...(filtres?.unreadOnlyForUserId
          ? {
              readReceipts: {
                none: { userId: filtres.unreadOnlyForUserId },
              },
            }
          : {}),
      },
      include: ENTRY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: filtres?.limit ?? 100,
    });
    return rows.map((r) => this.toItem(r));
  }

  async listerParClasse(
    classId: string,
    schoolId: string,
    filtres?: LiaisonFilters,
  ): Promise<LiaisonEntryItem[]> {
    const rows = await this.prisma.liaisonEntry.findMany({
      where: {
        schoolId,
        classId,
        ...(filtres?.academicYearId ? { academicYearId: filtres.academicYearId } : {}),
        ...(filtres?.category ? { category: filtres.category as PrismaLiaisonCategory } : {}),
      },
      include: ENTRY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: filtres?.limit ?? 100,
    });
    return rows.map((r) => this.toItem(r));
  }

  async marquerLue(entryId: string, userId: string, schoolId: string): Promise<void> {
    await this.prisma.liaisonReadReceipt.upsert({
      where: {
        entryId_userId: { entryId, userId },
      },
      create: {
        schoolId,
        entryId,
        userId,
      },
      update: {
        readAt: new Date(),
      },
    });
  }

  async ajouterReponse(data: {
    schoolId: string;
    entryId: string;
    authorId: string;
    confirmed?: boolean | null;
    replyText?: string | null;
    clientRecordedAt?: Date | null;
    clockSkewSeconds?: number | null;
  }): Promise<LiaisonResponseItem> {
    const row = await this.prisma.liaisonResponse.create({
      data: {
        schoolId: data.schoolId,
        entryId: data.entryId,
        authorId: data.authorId,
        confirmed: data.confirmed ?? null,
        replyText: data.replyText ?? null,
        clientRecordedAt: data.clientRecordedAt ?? null,
        clockSkewSeconds: data.clockSkewSeconds ?? null,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
    return {
      id: row.id,
      authorId: row.authorId,
      authorName: `${row.author.firstName} ${row.author.lastName}`.trim(),
      authorRole: row.author.role,
      confirmed: row.confirmed,
      replyText: row.replyText,
      clientRecordedAt: row.clientRecordedAt,
      clockSkewSeconds: row.clockSkewSeconds,
      createdAt: row.createdAt,
    };
  }

  async trouverParentsEleve(studentId: string, schoolId: string): Promise<ParentRecipientContact[]> {
    const student = await this.prisma.studentProfile.findFirst({
      where: { userId: studentId, schoolId },
      select: {
        parents: {
          include: {
            parentProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    accessMode: true,
                    isActive: true,
                    deletedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student) return [];

    const out: ParentRecipientContact[] = [];
    for (const link of student.parents) {
      const u = link.parentProfile?.user;
      if (!u || !u.isActive || u.deletedAt) continue;
      out.push({
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone ?? null,
        accessMode: u.accessMode,
      });
    }
    return out;
  }

  async estNiveauPrimaire(schoolId: string, classId?: string | null): Promise<boolean> {
    if (classId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { level: true },
      });
      if (cls?.level && isNiveauPrimaireOuMaternelle(cls.level)) {
        return true;
      }
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { templateCode: true, type: true },
    });
    if (!school) return false;
    if (school.type === 'PRIMARY' || school.type === 'PRESCHOOL') return true;
    return getTemplateMeta(school.templateCode).isPrimaire;
  }

  private toItem(row: {
    id: string;
    schoolId: string;
    academicYearId: string | null;
    studentId: string;
    classId: string | null;
    authorId: string;
    authorRole: string;
    category: PrismaLiaisonCategory;
    title: string;
    content: string;
    requiresConfirmation: boolean;
    confirmationPrompt: string | null;
    attendanceId: string | null;
    paymentId: string | null;
    isUrgent: boolean;
    clientRecordedAt: Date | null;
    clockSkewSeconds: number | null;
    createdAt: Date;
    updatedAt: Date;
    student?: { id: string; firstName: string; lastName: string } | null;
    class?: { id: string; name: string } | null;
    author?: { id: string; firstName: string; lastName: string; role: string } | null;
    readReceipts: Array<{
      id: string;
      userId: string;
      readAt: Date;
      user?: { id: string; firstName: string; lastName: string; role: string } | null;
    }>;
    responses: Array<{
      id: string;
      authorId: string;
      confirmed: boolean | null;
      replyText: string | null;
      clientRecordedAt: Date | null;
      clockSkewSeconds: number | null;
      createdAt: Date;
      author?: { id: string; firstName: string; lastName: string; role: string } | null;
    }>;
  }): LiaisonEntryItem {
    return {
      id: row.id,
      schoolId: row.schoolId,
      academicYearId: row.academicYearId,
      studentId: row.studentId,
      studentName: row.student ? `${row.student.firstName} ${row.student.lastName}`.trim() : undefined,
      classId: row.classId,
      className: row.class?.name ?? null,
      authorId: row.authorId,
      authorRole: row.authorRole,
      authorName: row.author ? `${row.author.firstName} ${row.author.lastName}`.trim() : undefined,
      category: row.category as LiaisonCategory,
      title: row.title,
      content: row.content,
      requiresConfirmation: row.requiresConfirmation,
      confirmationPrompt: row.confirmationPrompt,
      attendanceId: row.attendanceId,
      paymentId: row.paymentId,
      isUrgent: row.isUrgent,
      clientRecordedAt: row.clientRecordedAt,
      clockSkewSeconds: row.clockSkewSeconds,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      readReceipts: row.readReceipts.map((rr) => ({
        id: rr.id,
        userId: rr.userId,
        userName: rr.user ? `${rr.user.firstName} ${rr.user.lastName}`.trim() : undefined,
        userRole: rr.user?.role,
        readAt: rr.readAt,
      })),
      responses: row.responses.map((res) => ({
        id: res.id,
        authorId: res.authorId,
        authorName: res.author ? `${res.author.firstName} ${res.author.lastName}`.trim() : undefined,
        authorRole: res.author?.role,
        confirmed: res.confirmed,
        replyText: res.replyText,
        clientRecordedAt: res.clientRecordedAt,
        clockSkewSeconds: res.clockSkewSeconds,
        createdAt: res.createdAt,
      })),
    };
  }
}
