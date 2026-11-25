import type { PrismaClient } from '@prisma/client';
import type {
  ClassRoomAssignmentRepository,
  ClassRoomAssignmentProps,
} from '@domain/ports/repositories/ClassRoomAssignmentRepository';

export class PrismaClassRoomAssignmentRepository implements ClassRoomAssignmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByClasseAndAnnee(classId: string, academicYearId: string): Promise<ClassRoomAssignmentProps | null> {
    const data = await this.prisma.classRoomAssignment.findUnique({
      where: { classId_academicYearId: { classId, academicYearId } },
    });
    return data ? this.toProps(data) : null;
  }

  async findBySchool(schoolId: string, academicYearId: string): Promise<ClassRoomAssignmentProps[]> {
    const data = await this.prisma.classRoomAssignment.findMany({ where: { schoolId, academicYearId } });
    return data.map(d => this.toProps(d));
  }

  async upsert(props: ClassRoomAssignmentProps): Promise<void> {
    await this.prisma.classRoomAssignment.upsert({
      where: { classId_academicYearId: { classId: props.classId, academicYearId: props.academicYearId } },
      create: {
        id: props.id,
        schoolId: props.schoolId,
        classId: props.classId,
        roomId: props.roomId,
        academicYearId: props.academicYearId,
      },
      update: { roomId: props.roomId },
    });
  }

  async delete(classId: string, academicYearId: string): Promise<void> {
    await this.prisma.classRoomAssignment.deleteMany({ where: { classId, academicYearId } });
  }

  private toProps(data: {
    id: string; schoolId: string; classId: string; roomId: string; academicYearId: string;
  }): ClassRoomAssignmentProps {
    return {
      id: data.id, schoolId: data.schoolId, classId: data.classId,
      roomId: data.roomId, academicYearId: data.academicYearId,
    };
  }
}
