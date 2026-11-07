import type { PrismaClient } from '@prisma/client';
import type { TransferSnapshotBuilderPort, TransferSnapshotBuildResult } from '@domain/ports/services/TransferSnapshotBuilderPort';
import type { TransferSnapshotEncryptionPort } from '@domain/ports/services/TransferSnapshotEncryptionPort';
import { construireSnapshotTransfert } from '@application/studentTransfer/snapshotContract';

export class PrismaTransferSnapshotBuilder implements TransferSnapshotBuilderPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly encryption: TransferSnapshotEncryptionPort,
  ) {}

  async buildApprovedSnapshot(input: {
    transferRequestId: string;
    sourceSchoolId: string;
    targetSchoolId: string;
    sourceStudentProfileId: string;
  }): Promise<TransferSnapshotBuildResult> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { id: input.sourceStudentProfileId, schoolId: input.sourceSchoolId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        identity: { select: { nationalId: true } },
        parents: {
          where: { contactPrincipal: true, phoneVerified: true },
          include: { parentProfile: { include: { user: { select: { firstName: true, phone: true } } } } },
          take: 1,
        },
      },
    });
    if (!profile || !profile.identity) throw new Error('Profil source ou identité introuvable.');

    const grades = await this.prisma.grade.findMany({
      where: { schoolId: input.sourceSchoolId, studentId: profile.userId, validationStatus: 'LOCKED' },
      include: { subject: { select: { code: true } }, academicYear: { select: { name: true } } },
    });
    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        schoolId: input.sourceSchoolId,
        studentId: profile.userId,
        classWorkflowStatus: { in: ['VALIDATED', 'PUBLISHED'] },
      },
      select: { academicYear: { select: { name: true } }, id: true },
    });
    const attendances = await this.prisma.attendance.findMany({
      where: { schoolId: input.sourceSchoolId, studentId: profile.userId },
      select: { status: true, justification: true, date: true },
    });
    const academicYears = await this.prisma.academicYear.findMany({
      where: { schoolId: input.sourceSchoolId },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    const orientation = await this.prisma.ficheOrientation.findMany({
      where: { schoolId: input.sourceSchoolId, studentId: profile.userId },
      select: { academicYearId: true, status: true, riskLevel: true },
    });
    const guardian = profile.parents[0]?.parentProfile.user;
    if (!guardian?.phone) throw new Error('Tuteur principal vérifié introuvable.');

    // Totaux justifiées / non justifiées par ANNÉE SCOLAIRE (calendrier scolaire des années déclarées).
    const yearNameById = new Map(academicYears.map(y => [y.id, y.name]));
    const attendanceByYear = new Map<string, { academicYear: string; justified: number; unjustified: number }>();
    for (const attendance of attendances) {
      const englobante = academicYears.find(
        year => attendance.date >= year.startDate && attendance.date <= year.endDate,
      );
      const key = englobante?.name ?? `${attendance.date.getUTCFullYear()}`;
      const current = attendanceByYear.get(key)
        ?? { academicYear: key, justified: 0, unjustified: 0 };
      if (attendance.justification) current.justified += 1;
      else current.unjustified += 1;
      attendanceByYear.set(key, current);
    }

    const source = {
      identity: {
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        nationalId: profile.identity.nationalId,
        dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
      },
      lockedGrades: grades.map(grade => ({ subjectCode: grade.subject.code, academicYear: grade.academicYear.name, value: grade.sequenceAverage ?? grade.sequenceScore ?? 0 })),
      validatedReportCards: reportCards.map(reportCard => ({ academicYear: reportCard.academicYear.name, reference: reportCard.id })),
      attendanceSummary: [...attendanceByYear.values()],
      orientationDecisions: orientation.map(item => ({
        academicYear: yearNameById.get(item.academicYearId) ?? item.academicYearId,
        decision: `${item.status}:${item.riskLevel}`,
      })),
      guardianContact: { firstName: guardian.firstName, phone: guardian.phone },
    };
    const envelope = construireSnapshotTransfert(source);
    const payloadEncrypted = await this.encryption.encrypt(JSON.stringify(envelope.payload));
    return {
      snapshotId: `snapshot-${input.transferRequestId}`,
      payloadEncrypted,
      schemaVersion: envelope.payload.schemaVersion,
      categories: [...envelope.payload.categories],
      checksum: envelope.checksum,
      generatedAt: new Date(envelope.payload.generatedAt),
      deleteAfter: new Date(envelope.payload.deleteAfter),
    };
  }

  async readForTargetSchool(input: { snapshotId: string; transferRequestId: string; targetSchoolId: string }): Promise<TransferSnapshotBuildResult> {
    const snapshot = await this.prisma.transferDossierSnapshot.findFirst({
      where: { id: input.snapshotId, transferRequestId: input.transferRequestId, transferRequest: { targetSchoolId: input.targetSchoolId, status: 'COMPLETED' } },
    });
    if (!snapshot) throw new Error('Dossier introuvable ou inaccessible.');
    return {
      snapshotId: snapshot.id,
      payloadEncrypted: snapshot.payloadEncrypted,
      schemaVersion: snapshot.schemaVersion,
      categories: snapshot.categories,
      checksum: snapshot.checksum,
      generatedAt: snapshot.generatedAt,
      deleteAfter: snapshot.deleteAfter,
    };
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.prisma.transferDossierSnapshot.deleteMany({ where: { deleteAfter: { lte: now } } });
    return result.count;
  }
}
