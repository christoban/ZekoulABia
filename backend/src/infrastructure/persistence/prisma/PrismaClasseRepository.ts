import type { PrismaClient, Class } from '@prisma/client';
import { Classe } from '@domain/entities/Classe';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export class PrismaClasseRepository implements ClasseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Classe | null> {
    const data = await this.prisma.class.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findBySchool(schoolId: string): Promise<Classe[]> {
    const data = await this.prisma.class.findMany({ where: { schoolId } });
    return data.map(d => this.toDomain(d));
  }

  async findBySection(sectionId: string): Promise<Classe[]> {
    const data = await this.prisma.class.findMany({ where: { sectionId } });
    return data.map(d => this.toDomain(d));
  }

  async findByLevel(schoolId: string, level: string): Promise<Classe[]> {
    const data = await this.prisma.class.findMany({ where: { schoolId, level } });
    return data.map(d => this.toDomain(d));
  }

  async findBySchoolAndYear(schoolId: string, academicYearId: string): Promise<Classe[]> {
    const data = await this.prisma.class.findMany({ where: { schoolId, academicYearId } });
    return data.map(d => this.toDomain(d));
  }

  async activerToutesDraft(schoolId: string, academicYearId: string): Promise<number> {
    const { count } = await this.prisma.class.updateMany({
      where: { schoolId, academicYearId, status: 'DRAFT' },
      data: { status: 'ACTIVE' },
    });
    return count;
  }

  async annulerPropositionAnnee(schoolId: string, academicYearId: string): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      const draftClasses = await tx.class.findMany({
        where: { schoolId, academicYearId, status: 'DRAFT' },
        select: { id: true },
      });
      const ids = draftClasses.map(c => c.id);
      if (ids.length > 0) {
        // Purge les mappings AVANT les classes : ClassPromotion.toClassId référence Class en
        // RESTRICT, la suppression des classes échouerait sinon.
        await tx.classPromotion.deleteMany({ where: { toClassId: { in: ids } } });
        await tx.class.deleteMany({ where: { id: { in: ids } } });
      }
      return ids;
    });
  }

  async countEleves(classeId: string): Promise<number> {
    return this.prisma.enrollment.count({
      where: { classId: classeId, status: 'ACTIVE', academicYear: { isCurrent: true } },
    });
  }

  async save(classe: Classe): Promise<void> {
    const data = classe.toObject();
    await this.prisma.class.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        academicYearId: data.academicYearId,
        name: data.name,
        level: data.level,
        serie: data.serie,
        filiere: data.filiere,
        sectionId: data.sectionId,
        capacity: data.capacity,
        professorPrincipalId: data.professorPrincipalId,
        status: data.status,
        createdAt: data.createdAt,
      },
    });
  }

  async update(classe: Classe): Promise<void> {
    const data = classe.toObject();
    await this.prisma.class.update({
      where: { id: data.id },
      data: {
        name: data.name,
        level: data.level,
        serie: data.serie,
        filiere: data.filiere,
        sectionId: data.sectionId,
        capacity: data.capacity,
        professorPrincipalId: data.professorPrincipalId ?? null,
        status: data.status,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.class.delete({ where: { id } });
  }

  async existsByName(schoolId: string, name: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.class.findFirst({
      where: {
        schoolId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return existing !== null;
  }

  async findClasseDeProfPrincipal(teacherUserId: string): Promise<Classe | null> {
    const data = await this.prisma.class.findFirst({
      where: { professorPrincipalId: teacherUserId },
    });
    return data ? this.toDomain(data) : null;
  }

  async findByNameContient(schoolId: string, name: string): Promise<{ id: string; name: string } | null> {
    const data = await this.prisma.class.findFirst({
      where: { schoolId, name: { contains: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    return data;
  }

  /**
   * Nom historique conservé ("avecCascade"), comportement changé (Couche 1,
   * PLAN_IMPLEMENTATION_BACKUP.md) : pose deletedAt sur la classe elle-même, ne supprime plus
   * rien — élèves rattachés, notes, présences, emploi du temps, conseils de classe restent
   * intacts. Une restauration remet tout en état sans rien à reconstruire. Limite connue et
   * acceptée : une classe supprimée reste visible via un `include: { class: true }` depuis un
   * autre modèle (le filtre automatique de softDeleteExtension.ts ne s'applique qu'aux lectures
   * directes sur `class`, pas aux relations imbriquées) — sans conséquence pratique tant que
   * l'écran qui liste les classes elles-mêmes (l'usage principal concerné) est bien filtré.
   */
  async supprimerAvecCascade(classeId: string, deletedById?: string): Promise<void> {
    const classe = await this.prisma.class.findUnique({ where: { id: classeId }, select: { id: true } });
    if (!classe) return;
    await this.prisma.class.update({
      where: { id: classeId },
      data: { deletedAt: new Date(), deletedById: deletedById ?? null },
    });
  }

  async restaurer(classeId: string): Promise<void> {
    await this.prisma.class.update({
      where: { id: classeId, deletedAt: { not: null } },
      data: { deletedAt: null, deletedById: null },
    });
  }

  async listerSupprimes(schoolId: string) {
    return this.prisma.class.findMany({
      where: { schoolId, deletedAt: { not: null } },
      select: { id: true, name: true, level: true, deletedAt: true, deletedById: true },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async trouverSupprime(id: string, schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.class.findFirst({ where: { id, schoolId, deletedAt: { not: null } }, select: { id: true } });
  }

  private toDomain(data: Class): Classe {
    return Classe.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      academicYearId: data.academicYearId,
      name: data.name,
      level: data.level ?? undefined,
      serie: data.serie ?? undefined,
      filiere: data.filiere ?? undefined,
      sectionId: data.sectionId ?? undefined,
      capacity: data.capacity,
      professorPrincipalId: data.professorPrincipalId ?? undefined,
      status: data.status,
      createdAt: data.createdAt,
    });
  }
}
