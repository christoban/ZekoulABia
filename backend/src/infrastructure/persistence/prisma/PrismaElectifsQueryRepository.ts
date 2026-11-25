import type { PrismaClient } from '@prisma/client';
import type { PebsFiliere } from '@domain/types/enums';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';
import type {
  ClassStudentALevelRecord,
  ClassStudentLV2Record,
  ClassStudentPEBSRecord,
  ClassStudentRosterRecord,
  ElectifClassRef,
  ElectifsQueryRepository,
  ElectifSubjectRef,
  RosterSubjectRef,
} from '@domain/ports/repositories/ElectifsQueryRepository';

export class PrismaElectifsQueryRepository implements ElectifsQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findClassById(classId: string, schoolId: string): Promise<ElectifClassRef | null> {
    return this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true },
    });
  }

  async listClassStudentsLV2(classId: string, schoolId: string): Promise<ClassStudentLV2Record[]> {
    const students = await this.prisma.user.findMany({
      where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentProfile: {
          select: {
            lv2SubjectId: true,
            lv2Subject: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      lv2SubjectId: s.studentProfile?.lv2SubjectId ?? null,
      lv2SubjectName: s.studentProfile?.lv2Subject?.name ?? null,
    }));
  }

  async listClassStudentsPEBS(classId: string, schoolId: string): Promise<ClassStudentPEBSRecord[]> {
    const students = await this.prisma.user.findMany({
      where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentProfile: { select: { pebsFiliere: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      pebsFiliere: (s.studentProfile?.pebsFiliere as PebsFiliere | null | undefined) ?? null,
    }));
  }

  async findStudentProfileIdByUserId(studentUserId: string, schoolId: string): Promise<string | null> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: studentUserId, user: { schoolId } },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async listStudentALevelSubjects(studentProfileId: string): Promise<ElectifSubjectRef[]> {
    const links = await this.prisma.studentALevelSubject.findMany({
      where: { studentId: studentProfileId },
      select: { subject: { select: { id: true, name: true } } },
      orderBy: { subject: { name: 'asc' } },
    });
    return links.map((l) => ({ id: l.subject.id, name: l.subject.name }));
  }

  async listAvailableALevelSubjects(schoolId: string): Promise<ElectifSubjectRef[]> {
    const officialALevel = await this.prisma.aLevelSubject.findMany({
      select: { subjectName: true },
    });
    const officialNames: string[] = officialALevel.map((a) => a.subjectName);
    return this.prisma.subject.findMany({
      where: { schoolId, name: { in: officialNames } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async listClassStudentsALevel(classId: string, schoolId: string): Promise<ClassStudentALevelRecord[]> {
    const students = await this.prisma.user.findMany({
      where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentProfile: {
          select: {
            alevelSubjects: { select: { subject: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      subjects: (s.studentProfile?.alevelSubjects ?? []).map((a) => ({
        id: a.subject.id,
        name: a.subject.name,
      })),
    }));
  }

  async listActiveClassStudentIds(classId: string, schoolId: string): Promise<string[]> {
    const students = await this.prisma.user.findMany({
      where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
      select: { id: true },
    });
    return students.map((s) => s.id);
  }

  async listClassStudentsRoster(classId: string, schoolId: string): Promise<ClassStudentRosterRecord[]> {
    const allStudents = await this.prisma.user.findMany({
      where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentProfile: {
          select: {
            lv2SubjectId: true,
            alevelSubjects: { select: { subjectId: true } },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return allStudents.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      lv2SubjectId: s.studentProfile?.lv2SubjectId ?? null,
      alevelSubjectIds: (s.studentProfile?.alevelSubjects ?? []).map((a) => a.subjectId),
    }));
  }

  async findSubjectForRoster(subjectId: string, schoolId: string): Promise<RosterSubjectRef | null> {
    return this.prisma.subject.findFirst({
      where: { id: subjectId, schoolId },
      select: { id: true, name: true, isLV2: true },
    });
  }

  async isOfficialALevelSubject(subjectName: string): Promise<boolean> {
    const row = await this.prisma.aLevelSubject.findUnique({
      where: { subjectName },
      select: { subjectName: true },
    });
    return Boolean(row);
  }
}
