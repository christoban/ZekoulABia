import type { PrismaClient, StaffPermissionType } from '@prisma/client';
import type { SuiviRBACRepository } from '@domain/ports/repositories/SuiviRBACRepository';

const PERMISSIONS_CONSEILLER = ['MANAGE_ORIENTATION', 'MANAGE_PEDAGOGICAL_BRIEF'];

export class PrismaSuiviRBACRepository implements SuiviRBACRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverProfileEleve(userId: string, schoolId: string): Promise<{
    id: string;
    classId: string | null;
  } | null> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId, user: { schoolId } },
      select: {
        id: true,
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { classId: true },
          take: 1,
        },
      },
    });
    if (!profile) return null;
    return {
      id: profile.id,
      classId: profile.enrollmentsYearScoped?.[0]?.classId ?? null,
    };
  }

  async verifierEnseignantClasse(teacherId: string, classId: string): Promise<boolean> {
    const assignment = await this.prisma.teachingAssignment.findFirst({
      where: { teacherId, classId },
      select: { id: true },
    });
    return !!assignment;
  }

  async verifierProfPrincipal(classId: string, userId: string): Promise<boolean> {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, professorPrincipalId: userId },
      select: { id: true },
    });
    return !!cls;
  }

  async verifierDestinataireConseiller(userId: string, schoolId: string): Promise<boolean> {
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        userId,
        schoolId,
        permissions: { some: { permission: { in: [...PERMISSIONS_CONSEILLER] as StaffPermissionType[] } } },
      },
      select: { id: true },
    });
    return !!staff;
  }

  async verifierCasEscalade(studentProfileId: string, userId: string): Promise<boolean> {
    const signalement = await this.prisma.studentFollowUpAction.findFirst({
      where: {
        studentProfileId,
        type: 'SIGNALEMENT_CONSEILLER',
        assignedToId: userId,
        status: { in: ['OUVERT', 'EN_COURS'] },
      },
      select: { id: true },
    });
    return !!signalement;
  }

  async verifierEnseignantMatiere(teacherId: string, classId: string, subjectId: string): Promise<boolean> {
    const assignment = await this.prisma.teachingAssignment.findFirst({
      where: { teacherId, classId, subjectId },
      select: { id: true },
    });
    return !!assignment;
  }
}
