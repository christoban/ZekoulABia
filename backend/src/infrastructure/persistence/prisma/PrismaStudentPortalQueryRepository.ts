import type { PrismaClient, Prisma } from '@prisma/client';
import type { PebsFiliere } from '@domain/types/enums';
import type {
  CurrentUserPortalRaw,
  Lv2StudentGroupMatch,
  ParentStudentLinkRecord,
  StudentCompletenessRaw,
  StudentCycleContext,
  StudentPortalQueryRepository,
  StudentProfilePatchData,
} from '@domain/ports/repositories/StudentPortalQueryRepository';

export class PrismaStudentPortalQueryRepository implements StudentPortalQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCurrentUserPortalInfo(userId: string): Promise<CurrentUserPortalRaw | null> {
    const rawUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        school: {
          select: { id: true, name: true, subdomain: true, type: true, ownership: true },
        },
        teacherProfile: {
          select: {
            id: true,
            specialization: true,
            teacherSubjects: { select: { subject: { select: { id: true, name: true } } } },
          },
        },
        studentProfile: {
          select: {
            id: true,
            matricule: true,
            numeroInterne: true,
            dateOfBirth: true,
            gender: true,
            photoUrl: true,
            healthScore: true,
            pebsFiliere: true,
            lv2Subject: { select: { id: true, name: true } },
            enrollmentsYearScoped: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              select: { class: { select: { id: true, name: true, level: true, serie: true, filiere: true } } },
              take: 1,
            },
            groupMemberships: {
              where: { academicYear: { isCurrent: true } },
              select: { groupId: true },
            },
          },
        },
        staffProfile: { select: { id: true, title: true } },
        classesProfessorPrincipal: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                enrollments: {
                  where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                },
              },
            },
          },
        },
        headedDepartments: {
          select: { id: true, name: true, color: true, subjects: { select: { id: true, name: true } } },
        },
      },
    });
    return rawUser as unknown as CurrentUserPortalRaw | null;
  }

  async findLv2StudentGroup(lv2SubjectId: string, schoolId: string): Promise<Lv2StudentGroupMatch | null> {
    return this.prisma.studentGroup.findFirst({
      where: { subjectId: lv2SubjectId, groupSet: { schoolId } },
      select: { id: true, groupSetId: true },
    });
  }

  async syncLv2GroupMembershipAsync(
    studentProfileId: string,
    groupId: string,
    groupSetId: string,
    schoolId: string,
  ): Promise<void> {
    const anneeCourante = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    if (anneeCourante) {
      this.prisma.studentGroupMembership
        .upsert({
          where: {
            studentProfileId_groupSetId_academicYearId: {
              studentProfileId,
              groupSetId,
              academicYearId: anneeCourante.id,
            },
          },
          create: {
            studentProfileId,
            groupId,
            groupSetId,
            academicYearId: anneeCourante.id,
          },
          update: { groupId },
        })
        .catch(() => {});
    }
  }

  async findPebsStudentGroupId(pebsFiliere: PebsFiliere, schoolId: string): Promise<string | null> {
    const pebsGroup = await this.prisma.studentGroup.findFirst({
      where: { name: pebsFiliere, groupSet: { schoolId, code: 'PROGRAMME' } },
      select: { id: true },
    });
    return pebsGroup?.id ?? null;
  }

  async updateUserAvatar(
    userId: string,
    avatarUrl: string | null,
  ): Promise<{ id: string; avatarUrl: string | null }> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
  }

  async findStudentCompletenessData(userId: string): Promise<StudentCompletenessRaw | null> {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          select: { class: { select: { id: true, name: true, level: true, serie: true, filiere: true } } },
          take: 1,
        },
        parents: {
          include: {
            parentProfile: {
              include: { user: { select: { firstName: true, lastName: true, phone: true } } },
            },
          },
        },
        lv2Subject: { select: { id: true, name: true } },
      },
    });
    return student as unknown as StudentCompletenessRaw | null;
  }

  async countLv2Subjects(schoolId: string): Promise<number> {
    return this.prisma.subject.count({ where: { schoolId, isLV2: true } });
  }

  async findStudentCycleContextByUserId(userId: string): Promise<StudentCycleContext | null> {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { class: { select: { name: true, level: true } } },
          take: 1,
        },
      },
    });
    if (!student) return null;
    return {
      id: student.id,
      activeClass: student.enrollmentsYearScoped?.[0]?.class ?? null,
    };
  }

  async findParentProfileByUserId(userId: string): Promise<{ id: string } | null> {
    return this.prisma.parentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  async findParentStudentLink(
    parentProfileId: string,
    studentId: string,
  ): Promise<ParentStudentLinkRecord | null> {
    const link = await this.prisma.parentStudent.findFirst({
      where: {
        parentProfileId,
        OR: [{ studentProfileId: studentId }, { studentProfile: { userId: studentId } }],
      },
      include: { studentProfile: { select: { userId: true } } },
    });
    if (!link) return null;
    return {
      studentProfileId: link.studentProfileId,
      studentUserId: link.studentProfile.userId,
    };
  }

  async updateStudentContactAndProfile(params: {
    userId: string;
    studentProfileId: string;
    phone?: string;
    profileData: StudentProfilePatchData;
  }): Promise<void> {
    if (params.phone !== undefined) {
      await this.prisma.user.update({
        where: { id: params.userId },
        data: { phone: params.phone || null },
      });
    }

    const prismaProfileData: Prisma.StudentProfileUpdateInput = {};
    if (params.profileData.dateOfBirth !== undefined) {
      prismaProfileData.dateOfBirth = params.profileData.dateOfBirth;
    }
    if (params.profileData.gender !== undefined) {
      prismaProfileData.gender = params.profileData.gender;
    }
    if (params.profileData.photoUrl !== undefined) {
      prismaProfileData.photoUrl = params.profileData.photoUrl;
    }

    if (Object.keys(prismaProfileData).length > 0) {
      await this.prisma.studentProfile.update({
        where: { id: params.studentProfileId },
        data: prismaProfileData,
      });
    }
  }
}
