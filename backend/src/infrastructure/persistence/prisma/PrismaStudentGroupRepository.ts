import type { PrismaClient } from '@prisma/client';
import type {
  StudentGroupRepository,
  StudentGroupProps,
} from '@domain/ports/repositories/StudentGroupRepository';

export class PrismaStudentGroupRepository implements StudentGroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<StudentGroupProps | null> {
    const data = await this.prisma.studentGroup.findUnique({ where: { id } });
    return data ? this.toProps(data) : null;
  }

  async findByGroupSet(groupSetId: string): Promise<StudentGroupProps[]> {
    const data = await this.prisma.studentGroup.findMany({ where: { groupSetId } });
    return data.map(d => this.toProps(d));
  }

  async existsByName(groupSetId: string, name: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.studentGroup.findFirst({
      where: { groupSetId, name, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return existing !== null;
  }

  async save(group: StudentGroupProps): Promise<void> {
    await this.prisma.studentGroup.create({
      data: { id: group.id, groupSetId: group.groupSetId, name: group.name, subjectId: group.subjectId },
    });
  }

  async update(group: StudentGroupProps): Promise<void> {
    await this.prisma.studentGroup.update({
      where: { id: group.id },
      data: { name: group.name, subjectId: group.subjectId ?? null },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.studentGroup.delete({ where: { id } });
  }

  private toProps(data: { id: string; groupSetId: string; name: string; subjectId: string | null }): StudentGroupProps {
    return { id: data.id, groupSetId: data.groupSetId, name: data.name, subjectId: data.subjectId ?? undefined };
  }
}
