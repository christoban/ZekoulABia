import type { PrismaClient } from '@prisma/client';
import type { ParentRepository, EnfantAvecStats } from '@domain/ports/repositories/ParentRepository';

export class PrismaParentRepository implements ParentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async verifierRelationEnfant(parentUserId: string, studentId: string): Promise<void> {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId: parentUserId },
      include: {
        children: {
          include: { studentProfile: { select: { userId: true } } },
        },
      },
    });

    if (!parent) throw new Error('Profil parent introuvable');

    const aAcces = parent.children.some(c => c.studentProfile.userId === studentId);
    if (!aAcces) {
      throw new Error('Accès non autorisé : cet élève ne fait pas partie de vos enfants');
    }
  }

  async aAccesEleve(parentUserId: string, studentId: string): Promise<boolean> {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId: parentUserId },
      include: {
        children: {
          include: { studentProfile: { select: { userId: true } } },
        },
      },
    });
    if (!parent) return false;
    return parent.children.some(c => c.studentProfile.userId === studentId);
  }

  async findEnfantsAvecStats(
    parentUserId: string,
    schoolId: string
  ): Promise<EnfantAvecStats[]> {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId: parentUserId },
      include: {
        children: {
          include: {
            studentProfile: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                 enrollmentsYearScoped: {
                   where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                   select: { class: { select: { id: true, name: true, serie: true } } },
                   take: 1,
                 },
                 groupMemberships: {
                   where: { academicYear: { isCurrent: true } },
                   select: { groupId: true },
                 },
              },
            },
          },
        },
      },
    });

    if (!parent) return [];

    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - 30);

    const resultats = await Promise.all(
      parent.children.map(async (lien) => {
        const profil = lien.studentProfile;
        const studentId = profil.userId;
        const classeActuelle = profil.enrollmentsYearScoped[0]?.class ?? null;

        const [nbPresent, nbRetard, nbAbsent, total] = await Promise.all([
          this.prisma.attendance.count({
            where: { studentId, schoolId, status: 'PRESENT', date: { gte: dateDebut } },
          }),
          this.prisma.attendance.count({
            where: { studentId, schoolId, status: 'LATE', date: { gte: dateDebut } },
          }),
          this.prisma.attendance.count({
            where: { studentId, schoolId, status: 'ABSENT', date: { gte: dateDebut } },
          }),
          this.prisma.attendance.count({
            where: { studentId, schoolId, date: { gte: dateDebut } },
          }),
        ]);

        // Retard ≠ absence au Cameroun : tauxPresence inclut les retards, tauxPonctualite non
        const tauxPresence = total > 0
          ? Math.round(((nbPresent + nbRetard) / total) * 100)
          : 100;
        const tauxPonctualite = total > 0
          ? Math.round((nbPresent / total) * 100)
          : 100;

        const dernierBulletin = await this.prisma.reportCard.findFirst({
          where: { studentId, schoolId },
          orderBy: { createdAt: 'desc' },
          select: { mention: true, generalAverage: true },
        });

        return {
          studentId,
          prenom: profil.user.firstName,
          nom: profil.user.lastName,
           classeId: classeActuelle?.id,
           groupIds: profil.groupMemberships.map(membership => membership.groupId),
           classeNom: classeActuelle
            ? `${classeActuelle.name}${classeActuelle.serie ? ' ' + classeActuelle.serie : ''}`
            : undefined,
          tauxPresence,
          tauxPonctualite,
          joursAbsent: nbAbsent,
          derniereeMention: dernierBulletin?.mention ?? undefined,
          dernieereMoyenne: dernierBulletin?.generalAverage ?? undefined,
          indiceSante: profil.healthScore ?? undefined,
        } satisfies EnfantAvecStats;
      })
    );

    return resultats;
  }

  async findStudentIdsByParent(parentUserId: string): Promise<string[]> {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId: parentUserId },
      include: {
        children: {
          include: { studentProfile: { select: { userId: true } } },
        },
      },
    });
    if (!parent) return [];
    return parent.children
      .map(c => c.studentProfile?.userId)
      .filter((id): id is string => Boolean(id));
  }
}
