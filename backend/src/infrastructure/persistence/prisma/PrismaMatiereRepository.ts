import type { PrismaClient, Subject } from '@prisma/client';
import type { MatiereRepository, MatiereProps, CoefficientMatiere } from '@domain/ports/repositories/MatiereRepository';

export class PrismaMatiereRepository implements MatiereRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<MatiereProps | null> {
    const data = await this.prisma.subject.findUnique({ where: { id } });
    if (!data) return null;
    return this.toProps(data);
  }

  async findBySchool(schoolId: string): Promise<MatiereProps[]> {
    const data = await this.prisma.subject.findMany({ where: { schoolId } });
    return data.map(d => this.toProps(d));
  }

  async findByEnseignant(teacherProfileId: string): Promise<MatiereProps[]> {
    const data = await this.prisma.teacherSubject.findMany({
      where: { teacherProfileId },
      include: { subject: true },
    });
    return data.map(d => this.toProps(d.subject));
  }

  async findIdsLV2BySchool(schoolId: string): Promise<string[]> {
    const subjects = await this.prisma.subject.findMany({
      where: { schoolId, isLV2: true },
      select: { id: true },
    });
    return subjects.map(subject => subject.id);
  }

  async findLV2BySchool(schoolId: string): Promise<MatiereProps[]> {
    const data = await this.prisma.subject.findMany({
      where: { schoolId, isLV2: true },
      orderBy: { name: 'asc' },
    });
    return data.map(d => this.toProps(d));
  }

  async getCoefficientPourClasse(
    subjectId: string,
    classLevel: string,
    serieCode?: string
  ): Promise<number> {
    const coeff = await this.prisma.subjectCoefficient.findFirst({
      where: { subjectId, classLevel, serieCode: serieCode ?? null },
    });
    if (coeff) return coeff.coefficient;

    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    return subject?.coefficient ?? 1;
  }

  async getCoefficientsBACParSerie(
    serieCode: string
  ): Promise<{ subjectName: string; coefficient: number }[]> {
    const coeffs = await this.prisma.bacCoefficient.findMany({
      where: { serie: serieCode },
    });
    return coeffs.map(c => ({ subjectName: c.subjectName, coefficient: c.coefficient }));
  }

  async estEnseignantAssigne(
    teacherProfileId: string,
    subjectId: string
  ): Promise<boolean> {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherProfileId },
    });
    if (!teacher) return false;

    const lien = await this.prisma.teacherSubject.findFirst({
      where: { teacherProfileId: teacher.id, subjectId },
    });
    return lien !== null;
  }

  async save(matiere: MatiereProps): Promise<void> {
    await this.prisma.subject.create({ data: matiere });
  }

  async update(matiere: MatiereProps): Promise<void> {
    await this.prisma.subject.update({
      where: { id: matiere.id },
      data: {
        name: matiere.name,
        code: matiere.code,
        coefficient: matiere.coefficient,
        hoursPerWeek: matiere.hoursPerWeek,
        subjectType: matiere.subjectType,
      },
    });
  }

  /**
   * Suppression douce (Couche 1, PLAN_IMPLEMENTATION_BACKUP.md) — pose deletedAt sur la matière
   * elle-même, ne supprime plus rien : les notes/présences/emplois du temps qui la référencent
   * restent intacts (l'ancienne cascade effaçait `grade`/`reportCardSubjectLine`, donc perdait
   * réellement des notes d'élèves — ce n'est plus le cas). Restauration = tout redevient visible
   * sans rien à reconstruire.
   */
  async delete(id: string, deletedById?: string): Promise<void> {
    await this.prisma.subject.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: deletedById ?? null },
    });
  }

  async restaurer(id: string): Promise<void> {
    await this.prisma.subject.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null, deletedById: null },
    });
  }

  async listerSupprimes(schoolId: string) {
    return this.prisma.subject.findMany({
      where: { schoolId, deletedAt: { not: null } },
      select: { id: true, name: true, code: true, deletedAt: true, deletedById: true },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async trouverSupprime(id: string, schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.subject.findFirst({ where: { id, schoolId, deletedAt: { not: null } }, select: { id: true } });
  }

  async assignerEnseignant(teacherProfileId: string, subjectId: string): Promise<void> {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherProfileId },
    });
    const profileId = profile?.id ?? teacherProfileId;
    await this.prisma.teacherSubject.upsert({
      where: { teacherProfileId_subjectId: { teacherProfileId: profileId, subjectId } },
      create: { teacherProfileId: profileId, subjectId },
      update: {},
    });
  }

  async existsByCode(schoolId: string, code: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.subject.findFirst({
      where: {
        schoolId,
        code,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return existing !== null;
  }

  async getCoefficients(schoolId: string, subjectId: string): Promise<CoefficientMatiere[]> {
    const rows = await this.prisma.subjectCoefficient.findMany({
      where: { schoolId, subjectId },
      orderBy: [{ classLevel: 'asc' }, { serieCode: 'asc' }],
    });
    return rows.map(r => ({
      subjectId: r.subjectId,
      classLevel: r.classLevel,
      serieCode: r.serieCode ?? undefined,
      coefficient: r.coefficient,
    }));
  }

  async upsertCoefficients(schoolId: string, coefficients: CoefficientMatiere[]): Promise<void> {
    await Promise.all(
      coefficients.map(c =>
        this.prisma.subjectCoefficient.upsert({
          where: {
            schoolId_subjectId_classLevel_serieCode: {
              schoolId,
              subjectId: c.subjectId,
              classLevel: c.classLevel,
              serieCode: c.serieCode ?? '',
            },
          },
          create: {
            schoolId,
            subjectId: c.subjectId,
            classLevel: c.classLevel,
            serieCode: c.serieCode,
            coefficient: c.coefficient,
          },
          update: { coefficient: c.coefficient },
        })
      )
    );
  }

  async retirerEnseignant(teacherProfileId: string, subjectId: string): Promise<void> {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherProfileId },
    });
    const profileId = profile?.id ?? teacherProfileId;

    await this.prisma.teacherSubject.deleteMany({
      where: { teacherProfileId: profileId, subjectId },
    });
  }

  async syncEnseignants(subjectId: string, teacherUserIds: string[]): Promise<void> {
    await this.prisma.teacherSubject.deleteMany({ where: { subjectId } });
    if (!teacherUserIds.length) return;

    const profiles = await this.prisma.teacherProfile.findMany({
      where: { userId: { in: teacherUserIds } },
      select: { id: true },
    });

    await this.prisma.teacherSubject.createMany({
      data: profiles.map(p => ({ teacherProfileId: p.id, subjectId })),
      skipDuplicates: true,
    });
  }

  private toProps(data: Subject): MatiereProps {
    return {
      id: data.id,
      schoolId: data.schoolId,
      name: data.name,
      code: data.code ?? undefined,
      coefficient: data.coefficient,
      hoursPerWeek: data.hoursPerWeek,
      subjectType: data.subjectType,
    };
  }
}
