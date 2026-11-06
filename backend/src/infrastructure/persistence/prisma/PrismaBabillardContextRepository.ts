import type { PrismaClient } from '@prisma/client';
import type { BabillardContextRepository, BabillardContextQuery } from '@domain/ports/repositories/BabillardContextRepository';
import type { UtilisateurContexte } from '@domain/rules/BabillardVisibilityRules';

export class PrismaBabillardContextRepository implements BabillardContextRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async chargerUtilisateurContexte(query: BabillardContextQuery): Promise<UtilisateurContexte> {
    const { userId, schoolId, role, permissions } = query;
    const roleUpper = role?.toUpperCase();
    let classeIds: string[] = [];
    let niveauIds: string[] = [];
    let enseigneDansClasseIds: string[] = [];
    let titre: string | null = null;

    if (roleUpper === 'STAFF') {
      const profile = await this.prisma.staffProfile.findUnique({
        where: { userId },
        select: { title: true },
      });
      titre = profile?.title ?? null;
    } else if (roleUpper === 'STUDENT') {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { student: { userId }, status: 'ACTIVE', schoolId },
        select: { classId: true, class: { select: { level: true } } },
      });
      if (enrollment) {
        classeIds = [enrollment.classId];
        if (enrollment.class?.level) niveauIds = [enrollment.class.level];
      }
    } else if (roleUpper === 'PARENT') {
      const parentProfile = await this.prisma.parentProfile.findUnique({
        where: { userId },
        include: {
          children: {
            include: {
              studentProfile: {
                include: {
                  enrollmentsYearScoped: {
                    where: { status: 'ACTIVE', schoolId },
                    include: { class: true },
                  },
                },
              },
            },
          },
        },
      });
      if (parentProfile) {
        for (const ch of parentProfile.children) {
          for (const en of ch.studentProfile.enrollmentsYearScoped) {
            classeIds.push(en.classId);
            if (en.class?.level) niveauIds.push(en.class.level);
          }
        }
      }
    } else if (roleUpper === 'TEACHER') {
      const assignments = await this.prisma.teachingAssignment.findMany({
        where: { teacherId: userId, schoolId },
        select: { classId: true },
      });
      enseigneDansClasseIds = assignments.map((a) => a.classId);
    }

    return {
      userId,
      schoolId,
      role,
      permissions,
      titre,
      classeIds,
      niveauIds,
      enseigneDansClasseIds,
    };
  }
}
