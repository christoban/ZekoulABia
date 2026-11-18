import type { PrismaClient } from '@prisma/client';
import type { Bulletin } from '@domain/entities/Bulletin';
import type { BulletinValidationStatus } from '@domain/types/enums';
import type {
  BulletinRepository,
  BulletinAvecContexteClasse,
  BulletinEnrichi,
  BulletinExportData,
} from '@domain/ports/repositories/BulletinRepository';
import { whereProfilesParClasse } from '@application/shared/studentEnrollment';
import {
  buildBulletinCreateData,
  findForExportBulletinsOp,
  findForPdfBulletinOp,
  findPaginatedBulletinsOp,
  getMoyennesClasseOp,
  getStatsValidationParClasseOp,
  toBulletinDomain,
} from './helpers/bulletinMappingHelpers';

export class PrismaBulletinRepository implements BulletinRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Bulletin | null> {
    const data = await this.prisma.reportCard.findUnique({
      where: { id },
      include: { subjectLines: true },
    });
    return data ? toBulletinDomain(data) : null;
  }

  async findByEleve(studentId: string, academicYearId: string): Promise<Bulletin[]> {
    const data = await this.prisma.reportCard.findMany({
      where: { studentId, academicYearId },
      include: { subjectLines: true },
    });
    return data.map(toBulletinDomain);
  }

  async findByEleveEtPeriode(studentId: string, academicPeriodId: string): Promise<Bulletin | null> {
    const data = await this.prisma.reportCard.findUnique({
      where: { studentId_academicPeriodId: { studentId, academicPeriodId } },
      include: { subjectLines: true },
    });
    return data ? toBulletinDomain(data) : null;
  }

  async findByClasse(classId: string, academicPeriodId: string): Promise<Bulletin[]> {
    const eleves = await this.prisma.studentProfile.findMany({
      where: { enrollmentsYearScoped: { some: { classId, status: 'ACTIVE' as const, academicYear: { isCurrent: true } } } },
      select: { userId: true },
    });
    const studentIds = eleves.map((e) => e.userId);

    const data = await this.prisma.reportCard.findMany({
      where: { studentId: { in: studentIds }, academicPeriodId },
      include: { subjectLines: true },
    });
    return data.map(toBulletinDomain);
  }

  async findBySchool(schoolId: string, academicYearId: string): Promise<Bulletin[]> {
    const data = await this.prisma.reportCard.findMany({
      where: { schoolId, academicYearId },
      include: { subjectLines: true },
    });
    return data.map(toBulletinDomain);
  }

  async findWithClasseContext(bulletinId: string, schoolId: string): Promise<BulletinAvecContexteClasse | null> {
    const data = await this.prisma.reportCard.findFirst({
      where: { id: bulletinId, schoolId },
      include: {
        subjectLines: true,
        student: {
          include: {
            studentProfile: {
              include: {
                enrollmentsYearScoped: {
                  where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                  select: { class: { select: { professorPrincipalId: true } } },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!data) return null;
    const bulletin = toBulletinDomain(data);
    const professorPrincipalId = data.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class?.professorPrincipalId ?? null;
    return { bulletin, professorPrincipalId };
  }

  async findEnrichedById(bulletinId: string, schoolId: string): Promise<BulletinEnrichi | null> {
    const data = await this.prisma.reportCard.findFirst({
      where: { id: bulletinId, schoolId },
      include: {
        subjectLines: true,
        school: { select: { subsystem: true } },
        student: {
          select: {
            firstName: true,
            lastName: true,
            studentProfile: {
              select: {
                enrollmentsYearScoped: {
                  where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                  select: { class: { select: { professorPrincipalId: true, section: { select: { code: true } } } } },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!data) return null;
    const bulletin = toBulletinDomain(data);
    const professorPrincipalId = data.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class?.professorPrincipalId ?? null;
    const sectionCode = data.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class?.section?.code ?? null;
    return {
      bulletin,
      schoolSubsystem: data.school?.subsystem ?? null,
      sectionCode,
      studentFirstName: data.student?.firstName ?? '',
      studentLastName: data.student?.lastName ?? '',
      professorPrincipalId,
    };
  }

  async findPreviousByStudent(studentId: string, schoolId: string, excludeBulletinId?: string): Promise<{ generalAverage: number | null } | null> {
    const data = await this.prisma.reportCard.findFirst({
      where: { studentId, schoolId, ...(excludeBulletinId ? { id: { not: excludeBulletinId } } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { generalAverage: true },
    });
    return data ? { generalAverage: data.generalAverage ?? null } : null;
  }

  async findByEleveFiltre(params: { schoolId: string; studentId: string; academicYearId?: string; classWorkflowStatusIn?: string[] }): Promise<Record<string, unknown>[]> {
    return this.prisma.reportCard.findMany({
      where: {
        schoolId: params.schoolId,
        studentId: params.studentId,
        ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
        ...(params.classWorkflowStatusIn ? { classWorkflowStatus: { in: params.classWorkflowStatusIn as BulletinValidationStatus[] } } : {}),
      },
      include: { academicYear: true, academicPeriod: true, subjectLines: true },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Record<string, unknown>[];
  }

  async findPaginated(params: {
    schoolId: string;
    academicYearId?: string;
    academicPeriodId?: string;
    studentId?: string | { in: string[] };
    classId?: string;
    classWorkflowStatusIn?: string[];
    page: number;
    limit: number;
  }): Promise<{ items: Record<string, unknown>[]; total: number }> {
    return findPaginatedBulletinsOp(this.prisma, params);
  }

  async getStatsValidationParClasse(params: { classId: string; schoolId: string; sequenceIds: string[] }): Promise<{ total: number; DRAFT: number; LOCKED: number }> {
    return getStatsValidationParClasseOp(this.prisma, params);
  }

  async getMoyennesClasse(classId: string, academicPeriodId: string): Promise<{ studentId: string; generalAverage: number }[]> {
    return getMoyennesClasseOp(this.prisma, classId, academicPeriodId);
  }

  async save(bulletin: Bulletin): Promise<void> {
    await this.prisma.reportCard.create({ data: buildBulletinCreateData(bulletin) });
  }

  async update(bulletin: Bulletin): Promise<void> {
    const data = bulletin.toObject();
    await this.prisma.reportCard.update({
      where: { id: data.id },
      data: {
        validationStatus: data.validationStatus,
        generalAverage: data.generalAverage,
        rank: data.rank,
        mention: data.mention,
        absenceCount: data.absenceCount,
        classMasterComment: data.classMasterComment,
        conductGrade: data.conductGrade,
        aiComment: data.aiComment,
        isGenerated: data.isGenerated,
        pdfUrl: data.pdfUrl,
      },
    });
  }

  async updatePdfUrl(bulletinId: string, pdfUrl: string): Promise<void> {
    await this.prisma.reportCard.update({
      where: { id: bulletinId },
      data: { pdfUrl, isGenerated: true },
    });
  }

  async updateClassMasterComment(bulletinId: string, comment: string): Promise<void> {
    await this.prisma.reportCard.update({ where: { id: bulletinId }, data: { classMasterComment: comment } });
  }

  async updateAiComment(bulletinId: string, comment: string): Promise<void> {
    await this.prisma.reportCard.update({ where: { id: bulletinId }, data: { aiComment: comment } });
  }

  async majStatutWorkflowParClasse(
    classId: string,
    academicPeriodId: string,
    schoolId: string,
    status: BulletinValidationStatus | null,
  ): Promise<number> {
    const result = await this.prisma.reportCard.updateMany({
      where: {
        schoolId,
        academicPeriodId,
        student: {
          studentProfile: {
            enrollmentsYearScoped: { some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } } },
          },
        },
      },
      data: { classWorkflowStatus: status },
    });
    return result.count;
  }

  async findRecentSince(schoolId: string, academicPeriodId: string, since: Date): Promise<Array<{ studentId: string; student: { id: string; firstName: string | null; lastName: string | null } }>> {
    return this.prisma.reportCard.findMany({
      where: { schoolId, academicPeriodId, createdAt: { gte: since } },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    }) as unknown as Array<{ studentId: string; student: { id: string; firstName: string | null; lastName: string | null } }>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.reportCard.delete({ where: { id } });
  }

  async findTableauHonneur(params: { classId: string; schoolId: string; academicPeriodId: string; top: number }): Promise<{ student: { firstName: string; lastName: string }; generalAverage: number; mention: string | null }[]> {
    const rows = await this.prisma.reportCard.findMany({
      where: {
        schoolId: params.schoolId,
        academicPeriodId: params.academicPeriodId,
        student: { studentProfile: whereProfilesParClasse(params.classId) },
        generalAverage: { not: null },
      },
      include: { student: { select: { firstName: true, lastName: true } } },
      orderBy: { generalAverage: 'desc' },
      take: params.top,
    });
    return rows.map((r) => ({ student: r.student, generalAverage: r.generalAverage!, mention: r.mention ?? null }));
  }

  async findForAnnual(params: { classId: string; schoolId: string; periodIds: string[] }): Promise<{ studentId: string; student: { firstName: string; lastName: string }; generalAverage: number | null }[]> {
    const rows = await this.prisma.reportCard.findMany({
      where: {
        schoolId: params.schoolId,
        academicPeriodId: { in: params.periodIds },
        student: { studentProfile: whereProfilesParClasse(params.classId) },
      },
      include: { student: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((r) => ({ studentId: r.studentId, student: r.student, generalAverage: r.generalAverage ?? null }));
  }

  async findForExport(schoolId: string, academicPeriodId: string, classId?: string): Promise<BulletinExportData[]> {
    return findForExportBulletinsOp(this.prisma, schoolId, academicPeriodId, classId);
  }

  async findExportDataByPeriode(schoolId: string, academicPeriodId: string, classId?: string): Promise<BulletinExportData[]> {
    return findForExportBulletinsOp(this.prisma, schoolId, academicPeriodId, classId);
  }

  async findForPdf(bulletinId: string, schoolId: string): Promise<BulletinExportData | null> {
    return findForPdfBulletinOp(this.prisma, bulletinId, schoolId);
  }

  async upsertBulletin(data: { schoolId: string; studentId: string; academicYearId: string; academicPeriodId: string; generalAverage: number; rank: number | null; mention: string; absenceCount: number }): Promise<{ id: string }> {
    const reportCard = await this.prisma.reportCard.upsert({
      where: { studentId_academicPeriodId: { studentId: data.studentId, academicPeriodId: data.academicPeriodId } },
      create: {
        schoolId: data.schoolId,
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        academicPeriodId: data.academicPeriodId,
        generalAverage: Math.round(data.generalAverage * 100) / 100,
        rank: data.rank,
        mention: data.mention,
        absenceCount: data.absenceCount,
        isGenerated: true,
      },
      update: {
        generalAverage: Math.round(data.generalAverage * 100) / 100,
        rank: data.rank,
        mention: data.mention,
        absenceCount: data.absenceCount,
        isGenerated: true,
      },
    });
    return { id: reportCard.id };
  }

  async upsertLigneMatiere(reportCardId: string, ligne: { subjectId: string; subjectName: string; coefficient: number; seq1Score: number | null; seq2Score: number | null; subjectAverage: number }): Promise<void> {
    await this.prisma.reportCardSubjectLine.upsert({
      where: { reportCardId_subjectId: { reportCardId, subjectId: ligne.subjectId } },
      create: {
        reportCardId,
        subjectId: ligne.subjectId,
        subjectName: ligne.subjectName,
        coefficient: ligne.coefficient,
        seq1Score: ligne.seq1Score,
        seq2Score: ligne.seq2Score,
        subjectAverage: Math.round(ligne.subjectAverage * 100) / 100,
      },
      update: {
        subjectName: ligne.subjectName,
        coefficient: ligne.coefficient,
        seq1Score: ligne.seq1Score,
        seq2Score: ligne.seq2Score,
        subjectAverage: Math.round(ligne.subjectAverage * 100) / 100,
      },
    });
  }
}
