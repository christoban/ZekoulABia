import type { PrismaClient } from '@prisma/client';
import type {
  BulletinTemplateAssignmentRepository,
  SaveBulletinTemplateAssignmentInput,
} from '@domain/ports/repositories/BulletinTemplateAssignmentRepository';
import {
  assertValidClassLevel,
  type BulletinTemplateAssignmentRule,
} from '@domain/policies/BulletinTemplatePolicy';

export class PrismaBulletinTemplateAssignmentRepository implements BulletinTemplateAssignmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySchool(schoolId: string): Promise<BulletinTemplateAssignmentRule[]> {
    const rows = await this.prisma.bulletinTemplateAssignment.findMany({
      where: { schoolId },
      orderBy: [{ periodKind: 'asc' }, { classLevel: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      schoolId: r.schoolId,
      classLevel: r.classLevel,
      classId: r.classId,
      periodKind: r.periodKind,
      template: r.template,
      templateSpecId: r.templateSpecId,
      templateVersion: r.templateVersion,
      groupingScheme: r.groupingScheme,
      isActive: r.isActive,
    }));
  }

  async save(input: SaveBulletinTemplateAssignmentInput): Promise<BulletinTemplateAssignmentRule> {
    let resolvedLevel = assertValidClassLevel(input.classLevel);
    if (input.classId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: input.classId, schoolId: input.schoolId },
        select: { level: true },
      });
      if (!cls) throw new Error(`Classe introuvable pour l'affectation : ${input.classId}`);
      if (cls.level) {
        resolvedLevel = assertValidClassLevel(cls.level);
      }
    }

    const row = await this.prisma.bulletinTemplateAssignment.create({
      data: {
        schoolId: input.schoolId,
        classLevel: resolvedLevel,
        classId: input.classId ?? null,
        periodKind: input.periodKind,
        template: input.template,
        templateSpecId: input.templateSpecId,
        templateVersion: input.templateVersion ?? 1,
        groupingScheme: input.groupingScheme ?? null,
        isActive: input.isActive ?? true,
      },
    });
    return {
      id: row.id,
      schoolId: row.schoolId,
      classLevel: row.classLevel,
      classId: row.classId,
      periodKind: row.periodKind,
      template: row.template,
      templateSpecId: row.templateSpecId,
      templateVersion: row.templateVersion,
      groupingScheme: row.groupingScheme,
      isActive: row.isActive,
    };
  }

  async delete(id: string, schoolId: string): Promise<void> {
    await this.prisma.bulletinTemplateAssignment.deleteMany({
      where: { id, schoolId },
    });
  }
}
