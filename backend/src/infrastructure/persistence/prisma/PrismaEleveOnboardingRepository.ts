import type { PrismaClient, Prisma, OnboardingStatus, UserRole } from '@prisma/client';
import type {
  EleveOnboardingRepository,
  OnboardingSettings,
  OnboardingRecord,
  OnboardingProfileMatch,
  ValiderOnboardingInput,
  ValiderOnboardingCompteResultat,
  DocumentRequirementRecord,
  DocumentRecord,
} from '@domain/ports/repositories/EleveOnboardingRepository';
import type { OnboardingRecipient, OnboardingSource } from '@domain/types/enums';
import {
  rejeterOnboardingOp,
  renvoyerOnboardingOp,
  soumettreOnboardingOp,
  toDocumentRecord,
  toDocumentRequirementRecord,
  validerOnboardingOp,
} from './helpers/eleveOnboardingHelpers';

export class PrismaEleveOnboardingRepository implements EleveOnboardingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSettings(schoolId: string): Promise<OnboardingSettings | null> {
    return this.prisma.schoolOnboardingSettings.findUnique({ where: { schoolId } });
  }

  async upsertSettings(schoolId: string, data: Partial<OnboardingSettings>): Promise<OnboardingSettings> {
    return this.prisma.schoolOnboardingSettings.upsert({
      where: { schoolId },
      create: {
        schoolId,
        selfServiceEnabled: data.selfServiceEnabled ?? false,
        defaultRecipient: data.defaultRecipient ?? 'ELEVE',
        ageThresholdForParent: data.ageThresholdForParent ?? 15,
        tokenExpiryDays: data.tokenExpiryDays ?? 14,
        reminderDelayDays: data.reminderDelayDays ?? [3, 7],
        escalationDelayDays: data.escalationDelayDays ?? 10,
        responsableRole: (data.responsableRole ?? 'ADMIN') as UserRole,
        directAdmissionWithoutExam: data.directAdmissionWithoutExam ?? false,
        capacityBufferPercent: data.capacityBufferPercent ?? 0,
      },
      update: data as unknown as Prisma.SchoolOnboardingSettingsUpdateInput,
    });
  }

  async findOnboardingById(id: string, schoolId: string): Promise<OnboardingRecord | null> {
    return (await this.prisma.studentOnboarding.findFirst({ where: { id, schoolId } })) as unknown as OnboardingRecord | null;
  }

  async findOnboardingByToken(token: string): Promise<OnboardingRecord | null> {
    return (await this.prisma.studentOnboarding.findUnique({ where: { token } })) as unknown as OnboardingRecord | null;
  }

  async findOnboardingByTokenWithClasse(token: string): Promise<(OnboardingRecord & { classe?: { name: string; level: string } | null }) | null> {
    return (await this.prisma.studentOnboarding.findUnique({ where: { token }, include: { classe: { select: { name: true, level: true } } } })) as unknown as (OnboardingRecord & { classe?: { name: string; level: string } | null }) | null;
  }

  async listOnboardings(schoolId: string, status?: string): Promise<OnboardingRecord[]> {
    return (await this.prisma.studentOnboarding.findMany({
      where: { schoolId, ...(status ? { status: status as OnboardingStatus } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })) as unknown as OnboardingRecord[];
  }

  async findOnboardingForPdf(id: string, schoolId: string): Promise<(OnboardingRecord & { classe?: { name: string } | null; school?: { name: string } | null }) | null> {
    return (await this.prisma.studentOnboarding.findFirst({
      where: { id, schoolId },
      include: { classe: { select: { name: true } }, school: { select: { name: true } } },
    })) as unknown as (OnboardingRecord & { classe?: { name: string } | null; school?: { name: string } | null }) | null;
  }

  async findClassOnboardingInfo(classId: string): Promise<{ level: string; templateCode: string | null } | null> {
    const classe = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { level: true, school: { select: { templateCode: true } } },
    });
    if (!classe?.school) return null;
    return { level: classe.level, templateCode: classe.school.templateCode };
  }

  async findProfilesParDateNaissance(schoolId: string, dateOfBirth: Date): Promise<OnboardingProfileMatch[]> {
    const profiles = await this.prisma.studentProfile.findMany({
      where: { user: { schoolId }, dateOfBirth },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    return profiles.map((p) => ({
      id: p.id,
      lastName: p.user.lastName ?? '',
      firstName: p.user.firstName ?? '',
    }));
  }

  async findGroupTransferRequestByOnboarding(onboardingId: string): Promise<{ sourceUserId: string } | null> {
    const demande = await this.prisma.groupTransferRequest.findFirst({ where: { onboardingId } });
    return demande ? { sourceUserId: demande.sourceUserId } : null;
  }

  async createSquelette(data: {
    schoolId: string; nomProvisoire: string; classId: string | null;
    contactEmail: string | null; contactTelephone: string | null;
    parentContactEmail: string | null; parentContactTelephone: string | null;
    recipientType: OnboardingRecipient; sourceType: OnboardingSource; examCandidateId: string | null;
    eleveADispositif: boolean | null; eleveDispositifOS: string | null;
    parentADispositif: boolean | null; parentDispositifOS: string | null;
    token: string; tokenExpiresAt: Date;
  }): Promise<OnboardingRecord> {
    return (await this.prisma.studentOnboarding.create({
      data: {
        schoolId: data.schoolId,
        nomProvisoire: data.nomProvisoire,
        classId: data.classId,
        contactEmail: data.contactEmail,
        contactTelephone: data.contactTelephone,
        parentContactEmail: data.parentContactEmail,
        parentContactTelephone: data.parentContactTelephone,
        recipientType: data.recipientType,
        sourceType: data.sourceType,
        examCandidateId: data.examCandidateId,
        eleveADispositif: data.eleveADispositif,
        eleveDispositifOS: data.eleveDispositifOS,
        parentADispositif: data.parentADispositif,
        parentDispositifOS: data.parentDispositifOS,
        token: data.token,
        tokenExpiresAt: data.tokenExpiresAt,
        status: 'LINK_SENT',
      },
    })) as unknown as OnboardingRecord;
  }

  async marquerOnboardingExpire(id: string): Promise<void> {
    await this.prisma.studentOnboarding.update({ where: { id }, data: { status: 'EXPIRED' } });
  }

  async soumettreFormulaire(id: string, data: {
    submittedData: Record<string, unknown>; submittedAt: Date; tokenUsedAt: Date;
    matchScore: number | null; matchedStudentId: string | null;
    eleveADispositif?: boolean; parentADispositif?: boolean;
  }): Promise<void> {
    await this.prisma.studentOnboarding.update({
      where: { id },
      data: {
        submittedData: data.submittedData as Prisma.InputJsonValue,
        submittedAt: data.submittedAt,
        tokenUsedAt: data.tokenUsedAt,
        status: 'SUBMITTED',
        matchScore: data.matchScore,
        matchedStudentId: data.matchedStudentId,
        ...(data.eleveADispositif !== undefined && { eleveADispositif: data.eleveADispositif }),
        ...(data.parentADispositif !== undefined && { parentADispositif: data.parentADispositif }),
      },
    });
  }

  async rejeterOnboarding(id: string, data: { rejectionReason: string; rejectedById: string; rejectedAt: Date }): Promise<void> {
    return rejeterOnboardingOp(this.prisma, id, data);
  }

  async reactiverStudentProfilesTransferes(sourceUserId: string): Promise<void> {
    await this.prisma.studentProfile.updateMany({
      where: { userId: sourceUserId, studentStatus: 'TRANSFERRED' },
      data: { studentStatus: 'ACTIVE' },
    });
  }

  async soumettreOnboarding(id: string, data: {
    submittedData?: Record<string, unknown>;
    classId?: string;
    nomProvisoire?: string;
    submittedById: string;
    submitterRole: string;
  }): Promise<void> {
    return soumettreOnboardingOp(this.prisma, id, data);
  }

  async renvoyerOnboarding(id: string, data: { commentaire: string; adminId: string }): Promise<void> {
    return renvoyerOnboardingOp(this.prisma, id, data);
  }

  async validerOnboarding(input: ValiderOnboardingInput): Promise<{ studentProfileId: string; comptesCrees: ValiderOnboardingCompteResultat[] }> {
    return validerOnboardingOp(this.prisma, input);
  }

  // ── Pièces justificatives ──────────────────────────────────────────────

  async listDocumentRequirements(schoolId: string): Promise<DocumentRequirementRecord[]> {
    const rows = await this.prisma.enrollmentDocumentRequirement.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDocumentRequirementRecord);
  }

  async upsertDocumentRequirement(schoolId: string, data: {
    code: string;
    libelle: string;
    obligatoire?: boolean;
    applicableCase?: string;
  }): Promise<DocumentRequirementRecord> {
    const row = await this.prisma.enrollmentDocumentRequirement.upsert({
      where: { schoolId_code: { schoolId, code: data.code } },
      create: {
        schoolId,
        code: data.code,
        libelle: data.libelle,
        obligatoire: data.obligatoire ?? true,
        applicableCase: data.applicableCase ?? 'TOUS',
      },
      update: {
        libelle: data.libelle,
        ...(data.obligatoire !== undefined ? { obligatoire: data.obligatoire } : {}),
        ...(data.applicableCase !== undefined ? { applicableCase: data.applicableCase } : {}),
      },
    });
    return toDocumentRequirementRecord(row);
  }

  async deleteDocumentRequirement(schoolId: string, code: string): Promise<void> {
    await this.prisma.enrollmentDocumentRequirement.deleteMany({
      where: { schoolId, code },
    });
  }

  async listDocuments(onboardingId: string): Promise<DocumentRecord[]> {
    const rows = await this.prisma.enrollmentDocument.findMany({
      where: { onboardingId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDocumentRecord);
  }

  async initialiserDocuments(onboardingId: string, requirements: DocumentRequirementRecord[]): Promise<DocumentRecord[]> {
    const created: DocumentRecord[] = [];
    for (const req of requirements) {
      const row = await this.prisma.enrollmentDocument.upsert({
        where: { onboardingId_code: { onboardingId, code: req.code } },
        create: {
          onboardingId,
          requirementId: req.id,
          code: req.code,
          libelle: req.libelle,
          received: false,
        },
        update: {},
      });
      created.push(toDocumentRecord(row));
    }
    return created;
  }

  async marquerDocumentRecu(onboardingId: string, code: string, data: {
    received: boolean;
    receivedById: string;
    note?: string | null;
    fileKey?: string | null;
  }): Promise<DocumentRecord> {
    const row = await this.prisma.enrollmentDocument.update({
      where: { onboardingId_code: { onboardingId, code } },
      data: {
        received: data.received,
        receivedAt: data.received ? new Date() : null,
        receivedById: data.receivedById,
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.fileKey !== undefined ? { fileKey: data.fileKey } : {}),
      },
    });
    return toDocumentRecord(row);
  }

  async updateCompletenessScore(onboardingId: string, score: number, validableSousReserve: boolean): Promise<void> {
    await this.prisma.studentOnboarding.update({
      where: { id: onboardingId },
      data: { completenessScore: score, validableSousReserve },
    });
  }
}
