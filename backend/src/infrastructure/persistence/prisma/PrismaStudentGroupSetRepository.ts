import type { PrismaClient } from '@prisma/client';
import type {
  StudentGroupSetRepository,
  StudentGroupSetProps,
} from '@domain/ports/repositories/StudentGroupSetRepository';

export class PrismaStudentGroupSetRepository implements StudentGroupSetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<StudentGroupSetProps | null> {
    const data = await this.prisma.studentGroupSet.findUnique({ where: { id } });
    return data ? this.toProps(data) : null;
  }

  async findBySchool(schoolId: string): Promise<StudentGroupSetProps[]> {
    const data = await this.prisma.studentGroupSet.findMany({ where: { schoolId } });
    return data.map(d => this.toProps(d));
  }

  async findByCode(schoolId: string, code: string): Promise<StudentGroupSetProps | null> {
    const data = await this.prisma.studentGroupSet.findFirst({ where: { schoolId, code } });
    return data ? this.toProps(data) : null;
  }

  async existsByCode(schoolId: string, code: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.studentGroupSet.findFirst({
      where: { schoolId, code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return existing !== null;
  }

  async save(groupSet: StudentGroupSetProps): Promise<void> {
    await this.prisma.studentGroupSet.create({ data: groupSet });
  }

  async update(groupSet: StudentGroupSetProps): Promise<void> {
    await this.prisma.studentGroupSet.update({
      where: { id: groupSet.id },
      data: { code: groupSet.code, name: groupSet.name },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.studentGroupSet.delete({ where: { id } });
  }

  private toProps(data: { id: string; schoolId: string; code: string; name: string }): StudentGroupSetProps {
    return { id: data.id, schoolId: data.schoolId, code: data.code, name: data.name };
  }
}
