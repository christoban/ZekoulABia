import type { PrismaClient } from '@prisma/client';
import type {
  TeachingAssignmentRepository,
  TeachingAssignmentWithTeacher,
} from '@domain/ports/repositories/TeachingAssignmentRepository';

export class PrismaTeachingAssignmentRepository implements TeachingAssignmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByClassSubjectAndSchool(classId: string, subjectId: string, schoolId: string) {
    return this.prisma.teachingAssignment.findFirst({
      where: { classId, subjectId, schoolId },
      include: { subject: { select: { id: true, name: true } } },
    });
  }

  async findUnique(classId: string, subjectId: string, schoolId?: string) {
    const assignment = await this.prisma.teachingAssignment.findUnique({
      where: {
        classId_subjectId: { classId, subjectId },
      },
      include: { subject: { select: { name: true } } },
    });
    if (assignment && schoolId && assignment.schoolId !== schoolId) {
      return null;
    }
    return assignment;
  }

  async findByClassAndSchool(classId: string, schoolId: string): Promise<TeachingAssignmentWithTeacher[]> {
    const rows = await this.prisma.teachingAssignment.findMany({
      where: { classId, schoolId },
      include: { teacher: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      classId: r.classId,
      subjectId: r.subjectId,
      teacherId: r.teacherId,
      schoolId: r.schoolId,
      academicYearId: r.academicYearId,
      teacherName: `${r.teacher.firstName} ${r.teacher.lastName}`.trim(),
    }));
  }
}
