import type { PrismaClient } from '@prisma/client';
import { Bulletin } from '@domain/entities/Bulletin';
import type { BulletinValidationStatus } from '@domain/types/enums';
import type { BulletinRepository, BulletinAvecContexteClasse, BulletinEnrichi, BulletinExportData } from '@domain/ports/repositories/BulletinRepository';
import type { BulletinTemplate, ReportCardStatus } from '@domain/types/enums';

export class PrismaBulletinRepository implements BulletinRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Bulletin | null> {
    const data = await this.prisma.reportCard.findUnique({
      where: { id },
      include: { subjectLines: true },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByEleve(studentId: string, academicYearId: string): Promise<Bulletin[]> {
    const data = await this.prisma.reportCard.findMany({
      where: { studentId, academicYearId },
      include: { subjectLines: true },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByEleveEtPeriode(
    studentId: string,
    academicPeriodId: string
  ): Promise<Bulletin | null> {
    const data = await this.prisma.reportCard.findUnique({
      where: { studentId_academicPeriodId: { studentId, academicPeriodId } },
      include: { subjectLines: true },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByClasse(classId: string, academicPeriodId: string): Promise<Bulletin[]> {
    const eleves = await this.prisma.studentProfile.findMany({
      where: { enrollmentsYearScoped: { some: { classId, status: 'ACTIVE' as const, academicYear: { isCurrent: true } } } },
      select: { userId: true },
    });
    const studentIds = eleves.map(e => e.userId);

    const data = await this.prisma.reportCard.findMany({
      where: { studentId: { in: studentIds }, academicPeriodId },
      include: { subjectLines: true },
    });
    return data.map(d => this.toDomain(d));
  }

  async findBySchool(schoolId: string, academicYearId: string): Promise<Bulletin[]> {
    const data = await this.prisma.reportCard.findMany({
      where: { schoolId, academicYearId },
      include: { subjectLines: true },
    });
    return data.map(d => this.toDomain(d));
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
    }) as any;
    if (!data) return null;
    const bulletin = this.toDomain(data);
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
    }) as any;
    if (!data) return null;
    const bulletin = this.toDomain(data);
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
    }) as any;
    if (!data) return null;
    return { generalAverage: data.generalAverage ?? null };
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
    const { whereElevesParClasse } = await import('@application/shared/studentEnrollment');
    const where: Record<string, unknown> = { schoolId: params.schoolId };
    if (params.academicYearId) where.academicYearId = params.academicYearId;
    if (params.academicPeriodId) where.academicPeriodId = params.academicPeriodId;
    if (params.classId) (where as Record<string, unknown>).student = whereElevesParClasse(params.classId);
    if (params.studentId !== undefined) where.studentId = params.studentId;
    if (params.classWorkflowStatusIn) where.classWorkflowStatus = { in: params.classWorkflowStatusIn };
    const [total, items] = await Promise.all([
      this.prisma.reportCard.count({ where: where as never }),
      this.prisma.reportCard.findMany({
        where: where as never,
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

  async getStatsValidationParClasse(params: { classId: string; schoolId: string; sequenceIds: string[] }): Promise<{ total: number; DRAFT: number; LOCKED: number }> {
    const where: Record<string, unknown> = { schoolId: params.schoolId, classId: params.classId };
    if (params.sequenceIds.length > 0) (where as Record<string, unknown>).sequenceId = { in: params.sequenceIds };
    const grades = await this.prisma.grade.findMany({ where: where as never, select: { validationStatus: true } });
    const stats: { total: number; DRAFT: number; LOCKED: number } = { total: grades.length, DRAFT: 0, LOCKED: 0 };
    for (const g of grades) {
      if (g.validationStatus === 'DRAFT') stats.DRAFT++;
      else if (g.validationStatus === 'LOCKED') stats.LOCKED++;
    }
    return stats;
  }

  async getMoyennesClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<{ studentId: string; generalAverage: number }[]> {
    const eleves = await this.prisma.studentProfile.findMany({
      where: { enrollmentsYearScoped: { some: { classId, status: 'ACTIVE' as const, academicYear: { isCurrent: true } } } },
      select: { userId: true },
    });
    const studentIds = eleves.map(e => e.userId);

    const bulletins = await this.prisma.reportCard.findMany({
      where: { studentId: { in: studentIds }, academicPeriodId },
      select: { studentId: true, generalAverage: true },
    });

    return bulletins
      .filter(b => b.generalAverage !== null)
      .map(b => ({ studentId: b.studentId, generalAverage: b.generalAverage! }));
  }

  async save(bulletin: Bulletin): Promise<void> {
    const data = bulletin.toObject();
    await this.prisma.reportCard.create({
      data: {
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
          create: data.lignesMatiere.map(l => ({
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
      },
    });
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
    status: BulletinValidationStatus | null
  ): Promise<number> {
    const result = await this.prisma.reportCard.updateMany({
      where: {
        schoolId,
        academicPeriodId,
        student: {
          studentProfile: {
            enrollmentsYearScoped: {
              some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
            },
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
    const { whereProfilesParClasse } = await import('@application/shared/studentEnrollment');
    const rows = await this.prisma.reportCard.findMany({
      where: {
        schoolId: params.schoolId,
        academicPeriodId: params.academicPeriodId,
        student: { studentProfile: whereProfilesParClasse(params.classId) as any },
        generalAverage: { not: null },
      },
      include: { student: { select: { firstName: true, lastName: true } } },
      orderBy: { generalAverage: 'desc' },
      take: params.top,
    });
    return rows.map((r: any) => ({ student: r.student, generalAverage: r.generalAverage!, mention: r.mention ?? null }));
  }

  async findForAnnual(params: { classId: string; schoolId: string; periodIds: string[] }): Promise<{ studentId: string; student: { firstName: string; lastName: string }; generalAverage: number | null }[]> {
    const { whereProfilesParClasse } = await import('@application/shared/studentEnrollment');
    const rows = await this.prisma.reportCard.findMany({
      where: {
        schoolId: params.schoolId,
        academicPeriodId: { in: params.periodIds },
        student: { studentProfile: whereProfilesParClasse(params.classId) as any },
      },
      include: { student: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((r: any) => ({ studentId: r.studentId, student: r.student, generalAverage: r.generalAverage ?? null }));
  }

  async findForExport(schoolId: string, academicPeriodId: string): Promise<BulletinExportData[]> {
    const rows = await this.prisma.reportCard.findMany({
      where: { schoolId, academicPeriodId },
      include: {
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
      },
    });
    return rows as unknown as BulletinExportData[];
  }

  async findExportDataByPeriode(schoolId: string, academicPeriodId: string): Promise<BulletinExportData[]> {
    return this.findForExport(schoolId, academicPeriodId);
  }

  async findForPdf(bulletinId: string, schoolId: string): Promise<BulletinExportData | null> {
    const row = await this.prisma.reportCard.findFirst({
      where: { id: bulletinId, schoolId },
      include: {
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
      },
    });
    return row as unknown as BulletinExportData | null;
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

  private toDomain(data: any): Bulletin {
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
      lignesMatiere: (data.subjectLines ?? []).map((l: any) => ({
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
}
