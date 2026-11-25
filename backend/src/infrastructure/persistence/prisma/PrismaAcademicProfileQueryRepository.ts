import type { PrismaClient } from '@prisma/client';
import type { AcademicProfileQueryPort, AcademicProfileData, BulletinProfil, LigneMatiereProfil } from '@domain/ports/repositories/AcademicProfileQueryPort';

export class PrismaAcademicProfileQueryRepository implements AcademicProfileQueryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async obtenirProfilAcademique(
    studentId: string,
    schoolId: string,
    academicYearId: string,
  ): Promise<AcademicProfileData | null> {
    const bulletins = await this.prisma.reportCard.findMany({
      where: { studentId, schoolId, academicYearId },
      include: {
        subjectLines: true,
        academicPeriod: { select: { name: true, orderIndex: true } },
        student: { select: { firstName: true, lastName: true } },
      },
      orderBy: { academicPeriod: { orderIndex: 'asc' } },
    });

    if (bulletins.length === 0) return null;

    const premier = bulletins[0];
    const data: BulletinProfil[] = bulletins.map((b) => ({
      academicPeriodId: b.academicPeriodId,
      academicPeriodName: b.academicPeriod.name,
      generalAverage: b.generalAverage,
      lignes: b.subjectLines.map((l): LigneMatiereProfil => ({
        subjectId: l.subjectId,
        subjectName: l.subjectName,
        coefficient: l.coefficient,
        subjectAverage: l.subjectAverage,
      })),
    }));

    return {
      studentFirstName: premier.student.firstName ?? '',
      studentLastName: premier.student.lastName ?? '',
      bulletins: data,
    };
  }
}
