import type { PrismaClient } from '@prisma/client';
import type {
  GroupeScolaireQueryRepository,
  SchoolKpis,
  SourceUserInfo,
} from '@domain/ports/repositories/GroupeScolaireQueryRepository';

export class PrismaGroupeScolaireQueryRepository implements GroupeScolaireQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listerEcolesDuGroupe(groupId: string): Promise<{ id: string; name: string; city?: string | null; region?: string | null; type?: string | null; plan?: string | null; status?: string | null }[]> {
    return this.prisma.school.findMany({
      where: { groupId },
      select: { id: true, name: true, city: true, region: true, type: true, plan: true, status: true },
      orderBy: { name: 'asc' },
    }) as Promise<{ id: string; name: string; city?: string | null; region?: string | null; type?: string | null; plan?: string | null; status?: string | null }[]>;
  }

  async listerEcolesDuGroupeIds(groupId: string): Promise<{ id: string }[]> {
    return this.prisma.school.findMany({ where: { groupId }, select: { id: true } });
  }

  async ecoleAppartientAuGroupe(groupId: string, schoolId: string): Promise<boolean> {
    const school = await this.prisma.school.findFirst({ where: { id: schoolId, groupId } });
    return !!school;
  }

  async trouverSourceUserAvecProfil(userId: string): Promise<SourceUserInfo | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true, schoolId: true, role: true,
        studentProfile: {
          select: {
            id: true,
            enrollmentsYearScoped: {
              where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
              select: { class: { select: { level: true } } },
              take: 1,
            },
            parents: { select: { parentProfile: { select: { user: { select: { email: true, phone: true } } } } } },
          },
        },
      },
    });
    if (!user) return null;
    const profil = user.studentProfile;
    return {
      id: user.id,
      schoolId: user.schoolId,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      studentProfile: profil
        ? {
            id: profil.id,
            niveau: profil.enrollmentsYearScoped?.[0]?.class?.level ?? null,
            parentContacts: profil.parents.map((p) => ({
              email: p.parentProfile.user.email,
              phone: p.parentProfile.user.phone,
            })),
          }
        : null,
    };
  }

  async trouverSourceEnseignant(userId: string): Promise<{ firstName: string; lastName: string; email: string | null; phone: string | null } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    });
    return user as { firstName: string; lastName: string; email: string | null; phone: string | null } | null;
  }

  async trouverClasseParNiveau(schoolId: string, niveau: string): Promise<{ id: string } | null> {
    return this.prisma.class.findFirst({
      where: { schoolId, level: niveau },
      orderBy: { name: 'asc' },
      select: { id: true },
    });
  }

  async trouverEcoleDetail(schoolId: string): Promise<{ id: string; name: string; city?: string | null; region?: string | null; type?: string | null; plan?: string | null; status?: string | null } | null> {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, city: true, region: true, type: true, plan: true, status: true },
    }) as Promise<{ id: string; name: string; city?: string | null; region?: string | null; type?: string | null; plan?: string | null; status?: string | null } | null>;
  }

  async rechercherPersonne(cmd: { schoolId: string; role: 'STUDENT' | 'TEACHER'; recherche: string }): Promise<{ id: string; name: string }[]> {
    const users = await this.prisma.user.findMany({
      where: {
        schoolId: cmd.schoolId,
        role: cmd.role,
        OR: [
          { firstName: { contains: cmd.recherche, mode: 'insensitive' } },
          { lastName: { contains: cmd.recherche, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true },
      take: 20,
    });
    return users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));
  }

  async calculerKpisEcole(schoolId: string): Promise<SchoolKpis> {
    const effectifs = await this.prisma.studentProfile.count({
      where: { studentStatus: 'ACTIVE', user: { schoolId } },
    });

    const anneeCourante = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });

    let tauxReussite = 0;
    if (anneeCourante) {
      const bulletins = await this.prisma.reportCard.findMany({
        where: { schoolId, academicYearId: anneeCourante.id, generalAverage: { not: null } },
        select: { generalAverage: true },
      });
      if (bulletins.length > 0) {
        const reussis = bulletins.filter((b) => (b.generalAverage ?? 0) >= 10).length;
        tauxReussite = Math.round((reussis / bulletins.length) * 100);
      }
    }

    const paiements = await this.prisma.payment.aggregate({
      where: { schoolId, status: 'SUCCESS' },
      _sum: { amount: true },
    });
    const revenus = paiements._sum.amount ?? 0;

    const totalPresences = await this.prisma.attendance.count({ where: { schoolId } });
    let tauxAbsenteisme = 0;
    if (totalPresences > 0) {
      const absences = await this.prisma.attendance.count({ where: { schoolId, status: 'ABSENT' } });
      tauxAbsenteisme = Math.round((absences / totalPresences) * 100);
    }

    return { effectifs, tauxReussite, revenus, tauxAbsenteisme };
  }

  async listerNomsEcoles(ids: string[]): Promise<{ id: string; name: string }[]> {
    return this.prisma.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  }

  async listerNomsUsers(ids: string[]): Promise<{ id: string; firstName: string; lastName: string; role?: string }[]> {
    return this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, role: true } });
  }
}