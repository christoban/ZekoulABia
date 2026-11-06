import type { PrismaClient, MatriculeSource } from '@prisma/client';
import type {
  MatriculeImportRepository,
  MatriculeImportJobData,
  StudentProfileMatriculeData,
} from '@domain/ports/repositories/MatriculeImportRepository';
import { validateNationalId } from '@application/matricule/normalizeNationalId';

export class PrismaMatriculeImportRepository implements MatriculeImportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async creerJob(data: { schoolId: string; uploadedBy: string; fileName: string; totalRows: number }): Promise<MatriculeImportJobData> {
    return this.prisma.matriculeImportJob.create({
      data: { ...data, status: 'PROCESSING' },
    }) as Promise<MatriculeImportJobData>;
  }

  async trouverJob(jobId: string): Promise<MatriculeImportJobData | null> {
    return this.prisma.matriculeImportJob.findUnique({ where: { id: jobId } }) as Promise<MatriculeImportJobData | null>;
  }

  async listerJobs(schoolId: string, limit = 20): Promise<MatriculeImportJobData[]> {
    return this.prisma.matriculeImportJob.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' }, take: limit }) as Promise<MatriculeImportJobData[]>;
  }

  async trouverJobPourEcole(jobId: string, schoolId: string): Promise<MatriculeImportJobData | null> {
    return this.prisma.matriculeImportJob.findFirst({ where: { id: jobId, schoolId } }) as Promise<MatriculeImportJobData | null>;
  }

  async mettreAJourJob(jobId: string, data: Record<string, unknown>): Promise<void> {
    await this.prisma.matriculeImportJob.update({
      where: { id: jobId },
      data,
    });
  }

  async listerProfilsEcole(schoolId: string): Promise<StudentProfileMatriculeData[]> {
    return this.prisma.studentProfile.findMany({
      where: { user: { schoolId } },
      include: { user: { select: { firstName: true, lastName: true } } },
    }) as Promise<StudentProfileMatriculeData[]>;
  }

  async trouverProfilParId(profileId: string, schoolId: string): Promise<StudentProfileMatriculeData | null> {
    return this.prisma.studentProfile.findFirst({
      where: { id: profileId, user: { schoolId } },
    }) as Promise<StudentProfileMatriculeData | null>;
  }

  async trouverProfilMatricule(userId: string, schoolId: string): Promise<StudentProfileMatriculeData | null> {
    return this.prisma.studentProfile.findFirst({
      where: { user: { id: userId, schoolId } },
      include: { user: { select: { firstName: true, lastName: true } } },
    }) as Promise<StudentProfileMatriculeData | null>;
  }

  async mettreAJourMatricule(profileId: string, data: { matricule: string; matriculeSource: string; matriculeMatchType: string }): Promise<void> {
    const matricule = validateNationalId(data.matricule);
    await this.prisma.$transaction(async (tx) => {
      await tx.studentIdentity.createMany({ data: [{ nationalId: matricule }], skipDuplicates: true });
      const identity = await tx.studentIdentity.findUniqueOrThrow({ where: { nationalId: matricule } });
      await tx.studentProfile.update({
        where: { id: profileId },
        data: {
          matricule,
          identityId: identity.id,
          matriculeSource: data.matriculeSource as MatriculeSource,
          matriculeMatchType: data.matriculeMatchType,
        },
      });
    });
  }

  async listerProfilsActifsAvecMatricule(schoolId: string): Promise<{ id: string; matricule: string }[]> {
    return this.prisma.studentProfile.findMany({
      where: { user: { schoolId }, matricule: { not: null }, studentStatus: 'ACTIVE' },
      select: { id: true, matricule: true },
    }) as Promise<{ id: string; matricule: string }[]>;
  }

  async findByMatricules(schoolId: string, matricules: string[], classId: string): Promise<{ matricule: string; userId: string }[]> {
    const normalizedMatricules = matricules.map(validateNationalId);
    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        user: { schoolId },
        matricule: { in: normalizedMatricules },
        enrollmentsYearScoped: { some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } } },
      },
      select: { matricule: true, userId: true },
    });
    return profiles.filter((p): p is { matricule: string; userId: string } => p.matricule !== null);
  }

  async compterProfilsActifs(schoolId: string): Promise<number> {
    return this.prisma.studentProfile.count({
      where: { user: { schoolId }, studentStatus: 'ACTIVE' },
    });
  }

  async trouverEcoleCodeMinesec(schoolId: string): Promise<{ minesecSchoolCode: string | null } | null> {
    return this.prisma.school.findUnique({ where: { id: schoolId }, select: { minesecSchoolCode: true } });
  }
}
