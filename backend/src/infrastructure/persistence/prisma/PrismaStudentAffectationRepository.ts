import type { PrismaClient } from '@prisma/client';
import type {
  StudentAffectationRepository,
  StudentProfileRef,
  SubjectRef,
  EleveALevelRef,
} from '@domain/ports/repositories/StudentAffectationRepository';
import type { PebsFiliere } from '@domain/types/enums';

export class PrismaStudentAffectationRepository implements StudentAffectationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverProfilParUserId(userId: string, schoolId: string): Promise<StudentProfileRef | null> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId, user: { schoolId } },
      select: { id: true, userId: true },
    });
    return profile as StudentProfileRef | null;
  }

  async trouverProfilParId(profileId: string, schoolId: string): Promise<StudentProfileRef | null> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id: profileId },
      include: { user: { select: { schoolId: true } } },
    });
    if (!profile || profile.user.schoolId !== schoolId) return null;
    return { id: profile.id, userId: profile.userId };
  }

  async trouverProfilParUserIdAvecClasse(userId: string, schoolId: string): Promise<{ id: string; classId: string | null } | null> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { user: { id: userId, schoolId } },
      include: {
        user: { select: { schoolId: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { classId: true },
          take: 1,
        },
      },
    });
    if (!profile) return null;
    return { id: profile.id, classId: profile.enrollmentsYearScoped[0]?.classId ?? null };
  }

  async listerProfilsParUserIds(userIds: string[], schoolId: string): Promise<StudentProfileRef[]> {
    const profiles = await this.prisma.studentProfile.findMany({
      where: { userId: { in: userIds }, user: { schoolId } },
      select: { id: true, userId: true },
    });
    return profiles as StudentProfileRef[];
  }

  async trouverMatiere(matiereId: string, schoolId: string): Promise<SubjectRef | null> {
    return this.prisma.subject.findFirst({
      where: { id: matiereId, schoolId },
      select: { id: true, name: true },
    });
  }

  async listerMatieresParIds(ids: string[], schoolId: string): Promise<SubjectRef[]> {
    return this.prisma.subject.findMany({
      where: { id: { in: ids }, schoolId },
      select: { id: true, name: true },
    });
  }

  async listerMatieresParNoms(noms: string[], schoolId: string): Promise<SubjectRef[]> {
    return this.prisma.subject.findMany({
      where: { schoolId, name: { in: noms } },
      select: { id: true, name: true },
    });
  }

  async listerNomsMatieresALevelOfficielles(): Promise<string[]> {
    const rows = await this.prisma.aLevelSubject.findMany({ select: { subjectName: true } });
    return rows.map((a) => a.subjectName);
  }

  async trouverCombinaisonAnglophone(code: string): Promise<{ coreSubjects: string[] } | null> {
    const combo = await this.prisma.anglophoneStreamCombination.findUnique({ where: { filiere: code } });
    if (!combo) return null;
    return { coreSubjects: Array.isArray(combo.coreSubjects) ? (combo.coreSubjects as string[]) : [] };
  }

  async mettreAJourLV2(profileId: string, lv2SubjectId: string | null): Promise<void> {
    await this.prisma.studentProfile.update({
      where: { id: profileId },
      data: { lv2SubjectId },
    });
  }

  async mettreAJourLV2EnMasse(profileIds: string[], lv2SubjectId: string | null): Promise<number> {
    const result = await this.prisma.studentProfile.updateMany({
      where: { id: { in: profileIds } },
      data: { lv2SubjectId },
    });
    return result.count;
  }

  async mettreAJourPEBS(profileId: string, pebsFiliere: PebsFiliere | null): Promise<void> {
    await this.prisma.studentProfile.update({
      where: { id: profileId },
      data: { pebsFiliere },
    });
  }

  async mettreAJourPEBSEnMasse(profileIds: string[], pebsFiliere: PebsFiliere | null): Promise<number> {
    const result = await this.prisma.studentProfile.updateMany({
      where: { id: { in: profileIds } },
      data: { pebsFiliere },
    });
    return result.count;
  }

  async remplacerMatieresALevel(profileId: string, subjectIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.studentALevelSubject.deleteMany({ where: { studentId: profileId } });
      if (subjectIds.length > 0) {
        await tx.studentALevelSubject.createMany({
          data: subjectIds.map((subjectId) => ({ studentId: profileId, subjectId })),
        });
      }
    });
  }

  async listerElevesParMatiereALevel(subjectId: string, schoolId: string, classId?: string): Promise<EleveALevelRef[]> {
    const links = await this.prisma.studentALevelSubject.findMany({
      where: {
        subjectId,
        student: {
          user: { schoolId, isActive: true },
          ...(classId
            ? {
                enrollmentsYearScoped: {
                  some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
                },
              }
            : {}),
        },
      },
      select: {
        student: {
          select: {
            enrollmentsYearScoped: {
              where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
              select: { class: { select: { name: true } } },
              take: 1,
            },
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    const eleves: EleveALevelRef[] = links
      .map((l) => ({
        id: l.student.user.id,
        firstName: l.student.user.firstName,
        lastName: l.student.user.lastName,
        className: l.student.enrollmentsYearScoped?.[0]?.class?.name ?? null,
      }))
      .sort((a: EleveALevelRef, b: EleveALevelRef) =>
        a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

    return eleves;
  }

  async listerMatieresDuProfile(profileId: string): Promise<string[]> {
    const links = await this.prisma.studentALevelSubject.findMany({
      where: { studentId: profileId },
      select: { subjectId: true },
    });
    return links.map((l) => l.subjectId);
  }

  async trouverClasseNiveau(classId: string): Promise<string | null> {
    const classe = await this.prisma.class.findUnique({ where: { id: classId }, select: { level: true } });
    return classe?.level ?? null;
  }
}