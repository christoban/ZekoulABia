import type { Prisma, PrismaClient } from '@prisma/client';
import { Bulletin } from '@domain/entities/Bulletin';
import type { BulletinExportData } from '@domain/ports/repositories/BulletinRepository';
import type { BulletinTemplate, BulletinValidationStatus, ReportCardStatus } from '@domain/types/enums';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';

export type ReportCardAvecLignes = Prisma.ReportCardGetPayload<{ include: { subjectLines: true } }>;

export const EXPORT_BULLETIN_INCLUDE = {
  academicYear: true,
  academicPeriod: true,
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      studentProfile: {
        select: {
          enrollmentsYearScoped: {
            where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
            select: { class: { select: { name: true, section: { select: { code: true } } } } },
            take: 1,
          },
        },
      },
    },
  },
  subjectLines: { orderBy: { subjectName: 'asc' } },
  school: { include: { schoolConfig: true, schoolSettings: true } },
  section: { select: { code: true } },
} as const;

export function toBulletinDomain(data: ReportCardAvecLignes): Bulletin {
  return Bulletin.reconstituer({
    id: data.id,
    schoolId: data.schoolId,
    studentId: data.studentId,
    academicYearId: data.academicYearId,
    academicPeriodId: data.academicPeriodId,
    sectionId: data.sectionId ?? undefined,
    template: data.template as BulletinTemplate,
    validationStatus: data.validationStatus as ReportCardStatus,
    generalAverage: data.generalAverage ?? undefined,
    rank: data.rank ?? undefined,
    rankTrimestre1: data.rankTrimestre1 ?? undefined,
    rankTrimestre2: data.rankTrimestre2 ?? undefined,
    rankTrimestre3: data.rankTrimestre3 ?? undefined,
    totalStudents: data.totalStudents ?? undefined,
    mention: data.mention ?? undefined,
    absenceCount: data.absenceCount,
    classMasterComment: data.classMasterComment ?? undefined,
    conductGrade: data.conductGrade ?? undefined,
    aiComment: data.aiComment ?? undefined,
    isGenerated: data.isGenerated,
    pdfUrl: data.pdfUrl ?? undefined,
    createdAt: data.createdAt,
    lignesMatiere: (data.subjectLines ?? []).map((l) => ({
      id: l.id,
      subjectId: l.subjectId,
      subjectName: l.subjectName,
      coefficient: l.coefficient,
      seq1Score: l.seq1Score ?? undefined,
      seq2Score: l.seq2Score ?? undefined,
      compositionScore: l.compositionScore ?? undefined,
      seq3Score: l.seq3Score ?? undefined,
      seq4Score: l.seq4Score ?? undefined,
      seq5Score: l.seq5Score ?? undefined,
      seq6Score: l.seq6Score ?? undefined,
      classTestScore: l.classTestScore ?? undefined,
      terminalExamScore: l.terminalExamScore ?? undefined,
      theoreticalScore: l.theoreticalScore ?? undefined,
      practicalScore: l.practicalScore ?? undefined,
      professionalAttitude: l.professionalAttitude ?? undefined,
      oralScore: l.oralScore ?? undefined,
      selfDevelopmentScore: l.selfDevelopmentScore ?? undefined,
      subjectAverage: l.subjectAverage ?? undefined,
      weightedScore: l.weightedScore ?? undefined,
      subjectRank: l.subjectRank ?? undefined,
      teacherComment: l.teacherComment ?? undefined,
      competenceLabel: l.competenceLabel ?? undefined,
    })),
  });
}

export function buildBulletinCreateData(bulletin: Bulletin): Prisma.ReportCardUncheckedCreateInput {
  const data = bulletin.toObject();
  return {
    id: data.id,
    schoolId: data.schoolId,
    studentId: data.studentId,
    academicYearId: data.academicYearId,
    academicPeriodId: data.academicPeriodId,
    sectionId: data.sectionId,
    template: data.template,
    validationStatus: data.validationStatus,
    generalAverage: data.generalAverage,
    rank: data.rank,
    rankTrimestre1: data.rankTrimestre1,
    rankTrimestre2: data.rankTrimestre2,
    rankTrimestre3: data.rankTrimestre3,
    totalStudents: data.totalStudents,
    mention: data.mention,
    absenceCount: data.absenceCount,
    classMasterComment: data.classMasterComment,
    conductGrade: data.conductGrade,
    aiComment: data.aiComment,
    isGenerated: data.isGenerated,
    pdfUrl: data.pdfUrl,
    createdAt: data.createdAt,
    subjectLines: {
      create: data.lignesMatiere.map((l) => ({
        id: l.id,
        subjectId: l.subjectId,
        subjectName: l.subjectName,
        coefficient: l.coefficient,
        seq1Score: l.seq1Score,
        seq2Score: l.seq2Score,
        compositionScore: l.compositionScore,
        classTestScore: l.classTestScore,
        terminalExamScore: l.terminalExamScore,
        theoreticalScore: l.theoreticalScore,
        practicalScore: l.practicalScore,
        professionalAttitude: l.professionalAttitude,
        oralScore: l.oralScore,
        selfDevelopmentScore: l.selfDevelopmentScore,
        subjectAverage: l.subjectAverage,
        weightedScore: l.weightedScore,
        subjectRank: l.subjectRank,
        teacherComment: l.teacherComment,
        competenceLabel: l.competenceLabel,
      })),
    },
  };
}

export async function findPaginatedBulletinsOp(
  prisma: PrismaClient,
  params: {
    schoolId: string;
    academicYearId?: string;
    academicPeriodId?: string;
    studentId?: string | { in: string[] };
    classId?: string;
    classWorkflowStatusIn?: string[];
    page: number;
    limit: number;
  },
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const where: Prisma.ReportCardWhereInput = {
    schoolId: params.schoolId,
    ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
    ...(params.academicPeriodId ? { academicPeriodId: params.academicPeriodId } : {}),
    ...(params.classId ? { student: whereElevesParClasse(params.classId) } : {}),
    ...(params.studentId !== undefined ? { studentId: params.studentId } : {}),
    ...(params.classWorkflowStatusIn
      ? { classWorkflowStatus: { in: params.classWorkflowStatusIn as BulletinValidationStatus[] } }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.reportCard.count({ where }),
    prisma.reportCard.findMany({
      where,
      include: {
        academicYear: true,
        academicPeriod: true,
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
  ]);
  return { items: items as unknown as Record<string, unknown>[], total };
}

export async function getStatsValidationParClasseOp(
  prisma: PrismaClient,
  params: { classId: string; schoolId: string; sequenceIds: string[] },
): Promise<{ total: number; DRAFT: number; LOCKED: number }> {
  const where: Prisma.GradeWhereInput = {
    schoolId: params.schoolId,
    classId: params.classId,
    ...(params.sequenceIds.length > 0 ? { sequenceId: { in: params.sequenceIds } } : {}),
  };
  const grades = await prisma.grade.findMany({ where, select: { validationStatus: true } });
  const stats = { total: grades.length, DRAFT: 0, LOCKED: 0 };
  for (const g of grades) {
    if (g.validationStatus === 'DRAFT') stats.DRAFT++;
    else if (g.validationStatus === 'LOCKED') stats.LOCKED++;
  }
  return stats;
}

export async function getMoyennesClasseOp(
  prisma: PrismaClient,
  classId: string,
  academicPeriodId: string,
): Promise<{ studentId: string; generalAverage: number }[]> {
  const eleves = await prisma.studentProfile.findMany({
    where: { enrollmentsYearScoped: { some: { classId, status: 'ACTIVE' as const, academicYear: { isCurrent: true } } } },
    select: { userId: true },
  });
  const studentIds = eleves.map((e) => e.userId);

  const bulletins = await prisma.reportCard.findMany({
    where: { studentId: { in: studentIds }, academicPeriodId },
    select: { studentId: true, generalAverage: true },
  });

  return bulletins
    .filter((b) => b.generalAverage !== null)
    .map((b) => ({ studentId: b.studentId, generalAverage: b.generalAverage! }));
}

export async function findForExportBulletinsOp(
  prisma: PrismaClient,
  schoolId: string,
  academicPeriodId: string,
  classId?: string,
): Promise<BulletinExportData[]> {
  let studentIdFilter: { in: string[] } | undefined;
  if (classId) {
    const eleves = await prisma.studentProfile.findMany({
      where: { enrollmentsYearScoped: { some: { classId, status: 'ACTIVE' as const, academicYear: { isCurrent: true } } } },
      select: { userId: true },
    });
    studentIdFilter = { in: eleves.map((e) => e.userId) };
  }

  const rows = await prisma.reportCard.findMany({
    where: {
      schoolId,
      academicPeriodId,
      ...(studentIdFilter ? { studentId: studentIdFilter } : {}),
    },
    include: EXPORT_BULLETIN_INCLUDE,
  });
  return rows as unknown as BulletinExportData[];
}

export async function findForPdfBulletinOp(
  prisma: PrismaClient,
  bulletinId: string,
  schoolId: string,
): Promise<BulletinExportData | null> {
  const row = await prisma.reportCard.findFirst({
    where: { id: bulletinId, schoolId },
    include: EXPORT_BULLETIN_INCLUDE,
  });
  return row as unknown as BulletinExportData | null;
}
