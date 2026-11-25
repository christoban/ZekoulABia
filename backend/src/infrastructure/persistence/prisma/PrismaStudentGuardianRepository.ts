import type { PrismaClient } from '@prisma/client';
import type {
  GuardianCandidate,
  StudentGuardianRepository,
} from '@domain/ports/repositories/StudentGuardianRepository';

export class PrismaStudentGuardianRepository implements StudentGuardianRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findGuardiansByStudent(
    studentProfileId: string,
    schoolId: string,
  ): Promise<GuardianCandidate[]> {
    const links = await this.prisma.parentStudent.findMany({
      where: {
        studentProfileId,
        studentProfile: { schoolId },
        parentProfile: { user: { schoolId } },
      },
      include: {
        parentProfile: {
          include: {
            user: { select: { phone: true } },
          },
        },
      },
    });

    return links.map(link => ({
      studentProfileId: link.studentProfileId,
      schoolId,
      parentProfileId: link.parentProfileId,
      phone: link.parentProfile.user.phone,
      phoneVerified: link.phoneVerified,
    }));
  }

  async setPrimaryGuardian(command: {
    studentProfileId: string;
    schoolId: string;
    parentProfileId: string;
  }): Promise<void> {
    await this.prisma.$transaction(async transaction => {
      const target = await transaction.parentStudent.findFirst({
        where: {
          studentProfileId: command.studentProfileId,
          parentProfileId: command.parentProfileId,
          studentProfile: { schoolId: command.schoolId },
          parentProfile: { user: { schoolId: command.schoolId } },
        },
        select: { parentProfileId: true, studentProfileId: true },
      });

      if (!target) {
        throw new Error('Le tuteur enregistré doit appartenir à la même école que l’élève.');
      }

      await transaction.parentStudent.updateMany({
        where: {
          studentProfileId: command.studentProfileId,
          studentProfile: { schoolId: command.schoolId },
          parentProfile: { user: { schoolId: command.schoolId } },
        },
        data: { contactPrincipal: false },
      });

      await transaction.parentStudent.update({
        where: {
          parentProfileId_studentProfileId: {
            parentProfileId: target.parentProfileId,
            studentProfileId: target.studentProfileId,
          },
        },
        data: { contactPrincipal: true },
      });
    });
  }
}
