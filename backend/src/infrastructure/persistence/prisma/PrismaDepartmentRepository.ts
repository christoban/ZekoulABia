import type { PrismaClient } from '@prisma/client';
import type { DepartmentRepository, DepartmentProps, DepartmentWithHead, DepartmentWithSubjects } from '@domain/ports/repositories/DepartmentRepository';

export class PrismaDepartmentRepository implements DepartmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<DepartmentProps | null> {
    return this.prisma.department.findUnique({ where: { id }, include: { subjects: { select: { id: true, name: true } } } });
  }

  async findByIdAndSchool(id: string, schoolId: string): Promise<DepartmentProps | null> {
    return this.prisma.department.findFirst({ where: { id, schoolId }, include: { subjects: { select: { id: true, name: true } } } });
  }

  async findBySchool(schoolId: string): Promise<DepartmentWithHead[]> {
    return this.prisma.department.findMany({
      where: { schoolId },
      include: { head: { select: { id: true, firstName: true, lastName: true } }, subjects: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { schoolId: string; name: string; color?: string; headId?: string | null }): Promise<DepartmentProps> {
    return this.prisma.department.create({ data: { schoolId: data.schoolId, name: data.name, color: data.color ?? '#6b7280', headId: data.headId ?? null } });
  }

  async updateWithHead(id: string, data: { name?: string; color?: string; headId?: string | null }): Promise<DepartmentWithHead> {
    return this.prisma.department.update({
      where: { id },
      data: { ...(data.name && { name: data.name }), ...(data.color && { color: data.color }), ...(data.headId !== undefined && { headId: data.headId }) },
      include: { head: { select: { id: true, firstName: true, lastName: true } }, subjects: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.department.delete({ where: { id } });
  }

  async findAssignmentsForSubjectIds(schoolId: string, subjectIds: string[]) {
    return this.prisma.teachingAssignment.findMany({
      where: { subjectId: { in: subjectIds }, schoolId },
      select: {
        teacherId: true, subjectId: true, classId: true,
        teacher: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
        class: { select: { name: true } },
      },
    });
  }

  async findGradesForSubjectIds(schoolId: string, subjectIds: string[]) {
    return this.prisma.grade.findMany({
      where: { schoolId, subjectId: { in: subjectIds }, validationStatus: { in: ['LOCKED'] } },
      select: { subjectId: true, classId: true, sequenceAverage: true },
    });
  }

  async findByName(schoolId: string, name: string): Promise<DepartmentProps | null> {
    return this.prisma.department.findFirst({ where: { schoolId, name } });
  }

  async findHeadIdAndSubjects(id: string): Promise<{ id: string; headId: string | null; subjects: { id: string }[] } | null> {
    return this.prisma.department.findFirst({ where: { id }, select: { id: true, headId: true, subjects: { select: { id: true } } } });
  }

  async findDepartmentHeadingByHead(headId: string, excludeId?: string): Promise<DepartmentProps | null> {
    return this.prisma.department.findFirst({ where: { headId, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  }

  async associerChef(departmentId: string, headId: string | null): Promise<void> {
    await this.prisma.department.update({ where: { id: departmentId }, data: { headId } });
  }

  async rattacherMatieres(departmentId: string, subjectIds: string[]): Promise<void> {
    await this.prisma.subject.updateMany({ where: { id: { in: subjectIds }, departmentId: null }, data: { departmentId } });
  }

  async detacherMatieres(departmentId: string): Promise<void> {
    await this.prisma.subject.updateMany({ where: { departmentId }, data: { departmentId: null } });
  }
}
