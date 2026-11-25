import type { PrismaClient } from '@prisma/client';
import type {
  StudentGroupMembershipRepository,
  MembreCompteParGroupe,
} from '@domain/ports/repositories/StudentGroupMembershipRepository';
import { whereProfilesParClasse } from '@application/shared/studentEnrollment';

export class PrismaStudentGroupMembershipRepository implements StudentGroupMembershipRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByStudentAndGroupSet(
    studentProfileId: string,
    groupSetId: string,
    academicYearId: string
  ): Promise<{ groupId: string } | null> {
    const membership = await this.prisma.studentGroupMembership.findUnique({
      where: { studentProfileId_groupSetId_academicYearId: { studentProfileId, groupSetId, academicYearId } },
      select: { groupId: true },
    });
    return membership ? { groupId: membership.groupId } : null;
  }

  async findStudentIdsByGroup(groupId: string, academicYearId: string): Promise<string[]> {
    const memberships = await this.prisma.studentGroupMembership.findMany({
      where: { groupId, academicYearId },
      select: { studentProfileId: true },
    });
    return memberships.map(m => m.studentProfileId);
  }

  async countMembersByGroupForClass(
    groupSetId: string,
    classId: string,
    academicYearId: string
  ): Promise<MembreCompteParGroupe[]> {
    const studentsInClass = await this.prisma.studentProfile.findMany({
      where: { ...whereProfilesParClasse(classId) },
      select: { id: true },
    });
    const studentIds = studentsInClass.map(s => s.id);
    if (studentIds.length === 0) return [];

    const groupes = await this.prisma.studentGroupMembership.groupBy({
      by: ['groupId'],
      where: { groupSetId, academicYearId, studentProfileId: { in: studentIds } },
      _count: { _all: true },
    });
    return groupes.map(g => ({ groupId: g.groupId, count: g._count._all }));
  }

  async upsert(
    studentProfileId: string,
    groupId: string,
    groupSetId: string,
    academicYearId: string
  ): Promise<void> {
    await this.prisma.studentGroupMembership.upsert({
      where: { studentProfileId_groupSetId_academicYearId: { studentProfileId, groupSetId, academicYearId } },
      create: { id: crypto.randomUUID(), studentProfileId, groupId, groupSetId, academicYearId },
      update: { groupId },
    });
  }

  async remove(studentProfileId: string, groupSetId: string, academicYearId: string): Promise<void> {
    await this.prisma.studentGroupMembership.deleteMany({
      where: { studentProfileId, groupSetId, academicYearId },
    });
  }
}
