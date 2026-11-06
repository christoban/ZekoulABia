import type { PrismaClient } from '@prisma/client';
import type {
  EnrollmentRepository,
  ClasseActuelleInfo,
  ChangerClasseParams,
  InscrireEleveParams,
  CreerEleveAvecClasseParams,
} from '@domain/ports/repositories/EnrollmentRepository';

export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── Pattern A : élèves d'une classe ───

  async getStudentProfileIdsParClasse(classId: string): Promise<string[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
      select: { studentId: true },
    });
    return rows.map((r) => r.studentId);
  }

  async getEleveUserIdsParClasse(classId: string): Promise<string[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
      select: { student: { select: { userId: true } } },
    });
    return rows.map((r) => r.student.userId);
  }

  async getEleveUserIdsParClasseOrdonnes(classId: string): Promise<string[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
      select: { student: { select: { userId: true, user: { select: { lastName: true } } } } },
      orderBy: { student: { user: { lastName: 'asc' } } },
    });
    return rows.map((r) => r.student.userId);
  }

  async countElevesParClasse(classId: string): Promise<number> {
    return this.prisma.enrollment.count({
      where: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
    });
  }

  // ─── Pattern B : classe actuelle d'un élève ───

  async getClasseActuelleEleve(userId: string): Promise<ClasseActuelleInfo | null> {
    const row = await this.prisma.enrollment.findFirst({
      where: { student: { userId }, status: 'ACTIVE', academicYear: { isCurrent: true } },
      select: {
        class: {
          select: {
            id: true,
            name: true,
            level: true,
            serie: true,
            filiere: true,
            sectionId: true,
            section: { select: { code: true } },
            professorPrincipalId: true,
          },
        },
      },
    });
    if (!row) return null;
    return this.toClasseActuelleInfo(row.class);
  }

  async getClasseActuelleParStudentId(studentId: string): Promise<ClasseActuelleInfo | null> {
    const row = await this.prisma.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE', academicYear: { isCurrent: true } },
      select: {
        class: {
          select: {
            id: true,
            name: true,
            level: true,
            serie: true,
            filiere: true,
            sectionId: true,
            section: { select: { code: true } },
            professorPrincipalId: true,
          },
        },
      },
    });
    if (!row) return null;
    return this.toClasseActuelleInfo(row.class);
  }

  async getClassIdActuelEleve(userId: string): Promise<string | null> {
    const row = await this.prisma.enrollment.findFirst({
      where: { student: { userId }, status: 'ACTIVE', academicYear: { isCurrent: true } },
      select: { classId: true },
    });
    return row?.classId ?? null;
  }

  async getClassIdsActuelsParUserIds(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.prisma.enrollment.findMany({
      where: {
        student: { userId: { in: userIds } },
        status: 'ACTIVE',
        academicYear: { isCurrent: true },
      },
      select: { classId: true, student: { select: { userId: true } } },
    });
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.student.userId, r.classId);
    return map;
  }

  // ─── Pattern C : changer la classe (transactions atomiques) ───

  async changerClasseEleve(params: ChangerClasseParams): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: { studentId: params.studentId, status: 'ACTIVE' },
        data: { status: 'TRANSFERRED', exitedAt: new Date(), exitReason: params.exitReason ?? 'CHANGEMENT_CLASSE' },
      });
      await tx.enrollment.create({
        data: {
          studentId: params.studentId,
          classId: params.newClassId,
          academicYearId: params.academicYearId,
          schoolId: params.schoolId,
          enrolledById: params.enrolledById,
          status: 'ACTIVE',
        },
      });
    });
  }

  async changerClasseElevesEnMasse(params: {
    studentIds: string[];
    newClassId: string;
    academicYearId: string;
    schoolId: string;
    enrolledById: string;
    exitReason?: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: { studentId: { in: params.studentIds }, status: 'ACTIVE' },
        data: { status: 'TRANSFERRED', exitedAt: new Date(), exitReason: params.exitReason ?? 'CHANGEMENT_CLASSE_MASSE' },
      });
      await tx.enrollment.createMany({
        data: params.studentIds.map((studentId) => ({
          studentId,
          classId: params.newClassId,
          academicYearId: params.academicYearId,
          schoolId: params.schoolId,
          enrolledById: params.enrolledById,
          status: 'ACTIVE' as const,
        })),
      });
    });
  }

  // ─── Pattern D : inscription (création initiale) ───

  async inscrireEleve(params: InscrireEleveParams): Promise<void> {
    await this.prisma.enrollment.create({
      data: {
        studentId: params.studentId,
        classId: params.classId,
        academicYearId: params.academicYearId,
        schoolId: params.schoolId,
        enrolledById: params.enrolledById,
        status: params.status ?? 'ACTIVE',
      },
    });
  }

  async inscrireElevesEnMasse(inscriptions: InscrireEleveParams[]): Promise<void> {
    if (inscriptions.length === 0) return;
    await this.prisma.enrollment.createMany({
      data: inscriptions.map((p) => ({
        studentId: p.studentId,
        classId: p.classId,
        academicYearId: p.academicYearId,
        schoolId: p.schoolId,
        enrolledById: p.enrolledById,
        status: p.status ?? 'ACTIVE',
      })),
    });
  }

  async creerEleveAvecClasse(params: CreerEleveAvecClasseParams): Promise<{ id: string; userId: string }> {
    const cls = await this.prisma.class.findUniqueOrThrow({
      where: { id: params.classId },
      select: { schoolId: true, academicYearId: true },
    });
    const profile = await this.prisma.studentProfile.create({
      data: { userId: params.userId, schoolId: cls.schoolId, ...params.extraProfileData },
    });
    await this.prisma.enrollment.create({
      data: {
        studentId: profile.id,
        classId: params.classId,
        academicYearId: cls.academicYearId,
        schoolId: cls.schoolId,
        enrolledById: params.enrolledById,
        status: 'ACTIVE',
      },
    });
    return { id: profile.id, userId: profile.userId };
  }

  private toClasseActuelleInfo(cls: {
    id: string;
    name: string;
    level: string | null;
    serie: string | null;
    filiere: string | null;
    sectionId: string | null;
    section: { code: string } | null;
    professorPrincipalId: string | null;
  }): ClasseActuelleInfo {
    return {
      classId: cls.id,
      className: cls.name,
      level: cls.level,
      serie: cls.serie,
      filiere: cls.filiere,
      sectionId: cls.sectionId,
      sectionCode: cls.section?.code ?? null,
      professorPrincipalId: cls.professorPrincipalId,
    };
  }
}
