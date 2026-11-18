import type { PrismaClient } from '@prisma/client';
import type {
  StudentBulletinOptions,
  StudentProfileRepository,
  StudentDocumentProfile,
} from '@domain/ports/repositories/StudentProfileRepository';

export class PrismaStudentProfileRepository implements StudentProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBulletinOptionsByStudentIds(
    studentIds: string[],
  ): Promise<StudentBulletinOptions[]> {
    if (studentIds.length === 0) return [];

    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        userId: { in: studentIds },
      },
      select: {
        userId: true,
        lv2SubjectId: true,
        matricule: true,
        dateOfBirth: true,
        placeOfBirth: true,
        gender: true,
        isRepeater: true,
        photoUrl: true,
        alevelSubjects: {
          select: {
            subjectId: true,
          },
        },
      },
    });

    return profiles.map((profile) => ({
      studentId: profile.userId,
      lv2SubjectId: profile.lv2SubjectId,
      alevelSubjectIds: profile.alevelSubjects.map(
        (subject) => subject.subjectId,
      ),
      matricule: profile.matricule,
      dateOfBirth: profile.dateOfBirth,
      placeOfBirth: profile.placeOfBirth,
      gender: profile.gender,
      isRepeater: profile.isRepeater,
      photoUrl: profile.photoUrl,
    }));
  }

  async findForDocument(userId: string, schoolId: string): Promise<StudentDocumentProfile | null> {
    return this.prisma.studentProfile.findFirst({
      where: { userId, user: { schoolId } },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true, schoolId: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
          take: 1,
          select: { class: { select: { name: true, section: { select: { code: true } } } } },
        },
        parents: {
          include: { parentProfile: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } } },
          take: 1,
        },
      },
    });
  }

  async findByIdAndSchool(profileId: string, schoolId: string): Promise<{ id: string; userId: string } | null> {
    return this.prisma.studentProfile.findFirst({
      where: { id: profileId, user: { schoolId } },
      select: { id: true, userId: true },
    });
  }
}