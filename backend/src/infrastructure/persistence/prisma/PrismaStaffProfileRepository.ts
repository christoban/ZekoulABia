import type { PrismaClient } from '@prisma/client';
import type { StaffProfileRepository, UserPourDesignationAP } from '@domain/ports/repositories/StaffProfileRepository';
import type { StaffPermissionType } from '@domain/types/enums';

export class PrismaStaffProfileRepository implements StaffProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserPourDesignationAP(userId: string): Promise<UserPourDesignationAP | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, schoolId: true, firstName: true, lastName: true },
    });
    return user;
  }

  async assignerAP(userId: string, schoolId: string, permissions: StaffPermissionType[], departmentSubjectIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existingProfile = await tx.staffProfile.findUnique({ where: { userId } });

      if (existingProfile) {
        const existingPerms = await tx.staffPermission.findMany({
          where: { staffProfileId: existingProfile.id },
          select: { permission: true },
        });
        const existingPermSet = new Set(existingPerms.map(p => p.permission));
        const toAdd = permissions.filter(p => !existingPermSet.has(p));

        if (toAdd.length > 0) {
          await tx.staffPermission.createMany({
            data: toAdd.map(permission => ({ staffProfileId: existingProfile.id, permission })),
            skipDuplicates: true,
          });
        }
      } else {
        const profile = await tx.staffProfile.create({
          data: { schoolId, userId, title: 'Animateur Pédagogique' },
        });
        await tx.staffPermission.createMany({
          data: permissions.map(permission => ({ staffProfileId: profile.id, permission })),
          skipDuplicates: true,
        });
      }

      await tx.teacherProfile.update({
        where: { userId },
        data: { supervisedSubjectIds: departmentSubjectIds },
      });
    });
  }

  async retirerAP(userId: string, permissions: StaffPermissionType[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.staffProfile.findUnique({
        where: { userId },
        include: { permissions: true },
      });

      if (profile) {
        await tx.staffPermission.deleteMany({
          where: { staffProfileId: profile.id, permission: { in: permissions } },
        });

        const remaining = await tx.staffPermission.count({ where: { staffProfileId: profile.id } });
        if (remaining === 0) {
          await tx.staffProfile.delete({ where: { id: profile.id } });
        }
      }

      await tx.teacherProfile.update({
        where: { userId },
        data: { supervisedSubjectIds: [] },
      });
    });
  }

  async findConseillersOrientation(schoolId: string): Promise<string[]> {
    const conseillers = await this.prisma.staffProfile.findMany({
      where: { schoolId, permissions: { some: { permission: "MANAGE_ORIENTATION" } } },
      select: { userId: true },
    }).catch(() => []);
    return conseillers.map((c) => c.userId);
  }

  async findCenseurs(schoolId: string): Promise<Array<{ userId: string; email: string | null; firstName: string }>> {
    const censeurs = await this.prisma.staffProfile.findMany({
      where: { schoolId, permissions: { some: { permission: "VALIDATE_GRADES" } } },
      include: { user: { select: { id: true, email: true, firstName: true } } },
    });
    return censeurs.map(c => ({ userId: c.user.id, email: c.user.email ?? null, firstName: c.user.firstName }));
  }

  async findSectionIdByUserId(userId: string): Promise<string | null> {
    const staff = await this.prisma.staffProfile.findUnique({ where: { userId }, select: { sectionId: true } });
    return staff?.sectionId ?? null;
  }
}
