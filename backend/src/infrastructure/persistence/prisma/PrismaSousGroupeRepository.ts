import type { PrismaClient } from '@prisma/client';
import type {
  SousGroupeRepository,
  SousGroupeProps,
} from '@domain/ports/repositories/SousGroupeRepository';

export class PrismaSousGroupeRepository implements SousGroupeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<SousGroupeProps | null> {
    const data = await this.prisma.classSubGroup.findUnique({ where: { id } });
    if (!data) return null;
    return { id: data.id, classId: data.classId, name: data.name };
  }

  async findByClasse(classId: string): Promise<SousGroupeProps[]> {
    const data = await this.prisma.classSubGroup.findMany({ where: { classId } });
    return data.map(d => ({ id: d.id, classId: d.classId, name: d.name }));
  }

  async existsByName(classId: string, name: string): Promise<boolean> {
    const count = await this.prisma.classSubGroup.count({ where: { classId, name } });
    return count > 0;
  }

  async save(sousGroupe: SousGroupeProps): Promise<void> {
    await this.prisma.classSubGroup.create({
      data: {
        id: sousGroupe.id,
        classId: sousGroupe.classId,
        name: sousGroupe.name,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.classSubGroup.delete({ where: { id } });
  }

  async assignerEleves(
    subGroupId: string,
    studentProfileIds: string[],
    schoolId: string
  ): Promise<void> {
    const subGroup = await this.prisma.classSubGroup.findUnique({
      where: { id: subGroupId },
      include: { class: { select: { schoolId: true } } },
    });
    if (!subGroup || subGroup.class.schoolId !== schoolId) {
      throw new Error('Accès refusé : sous-groupe hors de votre établissement');
    }

    await this.prisma.studentSubGroupAssignment.createMany({
      data: studentProfileIds.map(id => ({
        studentProfileId: id,
        subGroupId,
      })),
      skipDuplicates: true,
    });
  }

  async getElevesAssignes(subGroupId: string): Promise<string[]> {
    const data = await this.prisma.studentSubGroupAssignment.findMany({
      where: { subGroupId },
      select: { studentProfileId: true },
    });
    return data.map(d => d.studentProfileId);
  }
}
