import type { PrismaClient } from '@prisma/client';
import type { CorbeilleRepository } from '@domain/ports/repositories/CorbeilleRepository';
import { messageErreur } from '@application/shared/messageErreur';

export class PrismaCorbeilleRepository implements CorbeilleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async purgerUtilisateurs(cutoff: Date): Promise<{ count: number }> {
    const db = this.prisma;
    const users = await db.user.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      select: {
        id: true, schoolId: true, role: true, firstName: true, lastName: true,
        email: true, phone: true, deletedAt: true, deletedById: true,
      },
    });

    let count = 0;
    for (const u of users) {
      try {
        const [
          studentProfile, parentProfile, teacherProfile, staffProfile,
          grades, attendances, reportCards,
          parentLinksAsStudent, parentLinksAsParent, teacherSubjects, staffPermissions,
        ] = await Promise.all([
          db.studentProfile.findUnique({ where: { userId: u.id } }),
          db.parentProfile.findUnique({ where: { userId: u.id } }),
          db.teacherProfile.findUnique({ where: { userId: u.id } }),
          db.staffProfile.findUnique({ where: { userId: u.id }, include: { permissions: true } }),
          db.grade.findMany({ where: { studentId: u.id } }),
          db.attendance.findMany({ where: { studentId: u.id } }),
          db.reportCard.findMany({ where: { studentId: u.id } }),
          db.parentStudent.findMany({ where: { studentProfile: { userId: u.id } } }),
          db.parentStudent.findMany({ where: { parentProfile: { userId: u.id } } }),
          db.teacherSubject.findMany({ where: { teacherProfile: { userId: u.id } } }),
          db.staffPermission.findMany({ where: { staffProfile: { userId: u.id } } }),
        ]);

        const snapshot = JSON.parse(JSON.stringify({
          user: u, studentProfile, parentProfile, teacherProfile, staffProfile,
          grades, attendances, reportCards,
          parentLinksAsStudent, parentLinksAsParent, teacherSubjects, staffPermissions,
        }));

        await db.userArchive.create({
          data: {
            originalUserId: u.id, schoolId: u.schoolId, role: u.role,
            firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone,
            deletedAt: u.deletedAt!, deletedById: u.deletedById, snapshot,
          },
        });

        await db.$transaction([
          db.attendance.deleteMany({ where: { studentId: u.id } }),
          db.grade.deleteMany({ where: { studentId: u.id } }),
          db.reportCard.deleteMany({ where: { studentId: u.id } }),
          db.parentStudent.deleteMany({
            where: { OR: [{ studentProfile: { userId: u.id } }, { parentProfile: { userId: u.id } }] },
          }),
          db.teacherSubject.deleteMany({ where: { teacherProfile: { userId: u.id } } }),
          db.staffPermission.deleteMany({ where: { staffProfile: { userId: u.id } } }),
          db.user.delete({ where: { id: u.id } }),
        ]);
        count++;
      } catch (err) {
        console.error(`[PurgeCorbeille] utilisateur ${u.id}:`, messageErreur(err));
      }
    }
    return { count };
  }

  async purgerClasses(cutoff: Date): Promise<{ count: number }> {
    const db = this.prisma;
    const classes = await db.class.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      select: { id: true, schoolId: true },
    });
    let count = 0;
    for (const c of classes) {
      try {
        await db.$transaction(async (tx) => {
          await tx.attendance.deleteMany({ where: { schoolId: c.schoolId, classId: c.id } });
          await tx.grade.deleteMany({ where: { schoolId: c.schoolId, classId: c.id } });
          await tx.classCouncilSession.deleteMany({ where: { schoolId: c.schoolId, classId: c.id } });
          await tx.timetable.deleteMany({ where: { schoolId: c.schoolId, classId: c.id } });
          await tx.classPromotion.deleteMany({ where: { schoolId: c.schoolId, OR: [{ fromClassId: c.id }, { toClassId: c.id }] } });
          await tx.studentPromotion.deleteMany({ where: { schoolId: c.schoolId, OR: [{ fromClassId: c.id }, { toClassId: c.id }] } });
          await tx.enrollment.updateMany({
            where: { classId: c.id, schoolId: c.schoolId },
            data: { status: 'TRANSFERRED', exitedAt: new Date(), exitReason: 'PURGE_CLASSE' },
          });
          await tx.class.delete({ where: { id: c.id } });
        });
        count++;
      } catch (err) {
        console.error(`[PurgeCorbeille] classe ${c.id}:`, messageErreur(err));
      }
    }
    return { count };
  }

  async purgerMatieres(cutoff: Date): Promise<{ count: number }> {
    const db = this.prisma;
    const subjects = await db.subject.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      select: { id: true },
    });
    let count = 0;
    for (const s of subjects) {
      try {
        await db.$transaction([
          db.classSubjectOverride.deleteMany({ where: { subjectId: s.id } }),
          db.subjectCoefficient.deleteMany({ where: { subjectId: s.id } }),
          db.teacherSubject.deleteMany({ where: { subjectId: s.id } }),
          db.teachingAssignment.deleteMany({ where: { subjectId: s.id } }),
          db.timetableSlot.deleteMany({ where: { subjectId: s.id } }),
          db.exam.deleteMany({ where: { subjectId: s.id } }),
          db.grade.deleteMany({ where: { subjectId: s.id } }),
          db.reportCardSubjectLine.deleteMany({ where: { subjectId: s.id } }),
          db.attendance.updateMany({ where: { subjectId: s.id }, data: { subjectId: null } }),
          db.subject.delete({ where: { id: s.id } }),
        ]);
        count++;
      } catch (err) {
        console.error(`[PurgeCorbeille] matière ${s.id}:`, messageErreur(err));
      }
    }
    return { count };
  }

  async purgerTout(cutoff: Date): Promise<void> {
    await this.purgerUtilisateurs(cutoff);
    await this.purgerClasses(cutoff);
    await this.purgerMatieres(cutoff);
  }
}
