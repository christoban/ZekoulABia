import type { PrismaClient } from '@prisma/client';
import type { StudentTransferLifecycleRepository } from '@domain/ports/repositories/StudentTransferLifecycleRepository';

/**
 * Décrit l'impact du transfert sur l'école source (Phase 1F) :
 * - Enrollment -> TRANSFERRED (avec motif et date de sortie) ;
 * - InscriptionMinesec -> TRANSFERRED_OUT (transferOrigin = demande de transfert) ;
 * - studentStatus -> TRANSFERRED (compte conservé, lecture seule dans l'app) ;
 * - adhésions aux groupes courantes retirées ;
 * - notes/présences/paiements passés : jamais touchés.
 */
export class PrismaStudentTransferLifecycleRepository implements StudentTransferLifecycleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async markSourceTransferred(command: {
    transferRequestId: string;
    sourceStudentProfileId: string;
    sourceSchoolId: string;
    targetSchoolId: string;
    completedAt: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async tx => {
      await tx.enrollment.updateMany({
        where: { studentId: command.sourceStudentProfileId, schoolId: command.sourceSchoolId, status: 'ACTIVE' },
        data: { status: 'TRANSFERRED', exitedAt: command.completedAt, exitReason: 'TRANSFERRED_OUT' },
      });
      await tx.inscriptionMinesec.updateMany({
        where: { studentId: command.sourceStudentProfileId, schoolId: command.sourceSchoolId, status: 'ACTIVE' },
        data: {
          status: 'TRANSFERRED_OUT',
          transferDate: command.completedAt,
          transferOrigin: command.transferRequestId,
        },
      });
      await tx.studentProfile.updateMany({
        where: { id: command.sourceStudentProfileId, schoolId: command.sourceSchoolId },
        data: { studentStatus: 'TRANSFERRED' },
      });
      await tx.studentGroupMembership.deleteMany({
        where: { studentProfileId: command.sourceStudentProfileId },
      });
    });
  }

  async markTargetReceived(command: {
    transferRequestId: string;
    targetStudentProfileId: string;
    targetSchoolId: string;
    academicYearTarget: string;
    completedAt: Date;
  }): Promise<boolean> {
    return this.prisma.$transaction(async tx => {
      const linked = await tx.transferRequest.updateMany({
        where: { id: command.transferRequestId, targetStudentProfileId: null, status: 'COMPLETED' },
        data: { targetStudentProfileId: command.targetStudentProfileId },
      });
      if (linked.count !== 1) return false;

      const enrollment = await tx.enrollment.findFirst({
        where: { studentId: command.targetStudentProfileId, schoolId: command.targetSchoolId, status: 'ACTIVE' },
        select: { class: { select: { name: true } } },
      });

      const existing = await tx.inscriptionMinesec.findUnique({
        where: {
          studentId_schoolId_anneeScolaire: {
            studentId: command.targetStudentProfileId,
            schoolId: command.targetSchoolId,
            anneeScolaire: command.academicYearTarget,
          },
        },
      });
      if (existing) {
        if (existing.status === 'ACTIVE') {
          await tx.inscriptionMinesec.update({
            where: { id: existing.id },
            data: {
              status: 'TRANSFERRED_IN',
              transferDate: command.completedAt,
              transferOrigin: command.transferRequestId,
            },
          });
        }
        return true;
      }

      await tx.inscriptionMinesec.create({
        data: {
          studentId: command.targetStudentProfileId,
          schoolId: command.targetSchoolId,
          anneeScolaire: command.academicYearTarget,
          classe: enrollment?.class?.name ?? '',
          status: 'TRANSFERRED_IN',
          transferDate: command.completedAt,
          transferOrigin: command.transferRequestId,
        },
      });
      return true;
    });
  }
}
