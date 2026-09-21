import type { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateTemporaryPassword } from '@domain/services/PasswordGenerator';
import { formatNumeroInterne } from '@domain/services/NumeroInterneGenerator';
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
        responsableRole: (data.responsableRole ?? 'ADMIN') as any,
      },
      update: data as any,
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
      where: { schoolId, ...(status ? { status: status as any } : {}) },
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
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.studentOnboarding.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: data.rejectionReason,
          validatedById: data.rejectedById,
          validatedAt: data.rejectedAt,
        },
      });

      await tx.activitiesLog.create({
        data: {
          userId: data.rejectedById,
          action: 'ONBOARDING_REJECTED',
          description: `Dossier d'inscription rejeté (${updated.nomProvisoire}) : ${data.rejectionReason}`,
          schoolId: updated.schoolId,
          metadata: {
            onboardingId: id,
            nomProvisoire: updated.nomProvisoire,
            rejectionReason: data.rejectionReason,
          },
        },
      });
    });
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
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.studentOnboarding.findUnique({ where: { id } });
      if (!current) throw new Error('Dossier introuvable');
      if (current.status !== 'DRAFT' && current.status !== 'RETURNED') {
        throw new Error(`Seul un dossier au statut DRAFT ou RETURNED peut être soumis (statut actuel : ${current.status})`);
      }

      const updated = await tx.studentOnboarding.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          ...(data.classId ? { classId: data.classId } : {}),
          ...(data.nomProvisoire ? { nomProvisoire: data.nomProvisoire } : {}),
          ...(data.submittedData ? { submittedData: data.submittedData as Prisma.InputJsonValue } : {}),
        },
      });

      await tx.activitiesLog.create({
        data: {
          userId: data.submittedById,
          action: 'ONBOARDING_SUBMITTED',
          description: `Dossier soumis pour validation (${updated.nomProvisoire})`,
          schoolId: current.schoolId,
          metadata: {
            onboardingId: id,
            statutAvant: current.status,
            statutApres: 'SUBMITTED',
            roleActeur: data.submitterRole,
          },
        },
      });
    });
  }

  async renvoyerOnboarding(id: string, data: {
    commentaire: string;
    adminId: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.studentOnboarding.findUnique({ where: { id } });
      if (!current) throw new Error('Dossier introuvable');
      if (current.status !== 'SUBMITTED') {
        throw new Error(`Seul un dossier SUBMITTED peut être renvoyé (statut actuel : ${current.status})`);
      }

      const existingData = (current.submittedData && typeof current.submittedData === 'object' && !Array.isArray(current.submittedData))
        ? (current.submittedData as Record<string, unknown>)
        : {};
      const newSubmittedData: Record<string, unknown> = {
        ...existingData,
        commentaireAdmin: data.commentaire,
        renvoyeLe: new Date().toISOString(),
      };

      await tx.studentOnboarding.update({
        where: { id },
        data: {
          status: 'RETURNED',
          submittedData: newSubmittedData as Prisma.InputJsonValue,
        },
      });

      await tx.activitiesLog.create({
        data: {
          userId: data.adminId,
          action: 'ONBOARDING_RETURNED',
          description: `Dossier renvoyé au secrétariat (${current.nomProvisoire}) : ${data.commentaire}`,
          schoolId: current.schoolId,
          metadata: {
            onboardingId: id,
            statutAvant: 'SUBMITTED',
            statutApres: 'RETURNED',
            roleActeur: 'ADMIN',
            commentaire: data.commentaire,
          },
        },
      });
    });
  }

  async validerOnboarding(input: ValiderOnboardingInput): Promise<{ studentProfileId: string; comptesCrees: ValiderOnboardingCompteResultat[] }> {
    const { studentProfile, comptesCrees } = await this.prisma.$transaction(async (tx) => {
      const studentTemporaryPassword = generateTemporaryPassword();
      const studentUser = await tx.user.create({
        data: {
          schoolId: input.schoolId,
          role: 'STUDENT',
          firstName: input.prenom,
          lastName: input.nom,
          email: input.eleveContactEmail,
          phone: input.eleveContactTelephone,
          passwordHash: await bcrypt.hash(studentTemporaryPassword, 10),
          mustChangePassword: true,
          accessMode: input.eleveAccessMode,
          isActive: true,
        },
      });

      // Génération du numéro interne d'élève standardisé : CODE-ANNEE-SEQ
      const school = await tx.school.findUnique({
        where: { id: input.schoolId },
        select: { subdomain: true, name: true },
      });
      const schoolCode = school?.subdomain || school?.name?.slice(0, 4) || 'SCH';
      const currentYear = new Date().getFullYear();
      const studentCount = await tx.studentProfile.count({
        where: { user: { schoolId: input.schoolId } },
      });
      const numeroInterne = formatNumeroInterne(schoolCode, currentYear, studentCount + 1);

      const studentProfile = await tx.studentProfile.create({
        data: {
          userId: studentUser.id,
          studentStatus: 'ACTIVE',
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          numeroInterne,
        },
      });

      // Verrou pessimiste pour éliminer les race conditions de capacité
      await tx.$queryRaw`SELECT id, capacity FROM "Class" WHERE id = ${input.classId} FOR UPDATE`;

      const classeCible = await tx.class.findUniqueOrThrow({
        where: { id: input.classId },
        select: {
          name: true,
          schoolId: true,
          academicYearId: true,
          capacity: true,
          _count: {
            select: {
              enrollments: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
      });

      const effectifActuel = classeCible._count.enrollments;
      if (classeCible.capacity > 0 && effectifActuel >= classeCible.capacity && !input.derogationCapacite) {
        throw new Error(
          `La classe "${classeCible.name}" a atteint sa capacité maximale (${classeCible.capacity} élèves). Une dérogation est requise pour finaliser cette inscription.`,
        );
      }

      await tx.enrollment.create({
        data: {
          studentId: studentProfile.id,
          classId: input.classId,
          academicYearId: classeCible.academicYearId,
          schoolId: classeCible.schoolId,
          enrolledById: input.validatedById,
          status: 'ACTIVE',
        },
      });

      const comptesCrees: ValiderOnboardingCompteResultat[] = [{
        role: 'STUDENT',
        userId: studentUser.id,
        temporaryPassword: studentTemporaryPassword,
        dispositifOS: input.eleveDispositifOS,
        contactEmail: input.eleveContactEmail,
        contactTelephone: input.eleveContactTelephone,
        compteExistant: false,
        accessMode: input.eleveAccessMode,
      }];

      if (input.parentRecoitContact) {
        const contactFilters = [
          input.parentContactEmail ? { email: input.parentContactEmail } : null,
          input.parentContactTelephone ? { phone: input.parentContactTelephone } : null,
        ].filter(Boolean) as Record<string, string>[];

        const existingParentUser = contactFilters.length > 0
          ? await tx.user.findFirst({ where: { schoolId: input.schoolId, role: 'PARENT', OR: contactFilters } })
          : null;

        let parentProfileId: string;
        let parentUserId: string;
        let parentTemporaryPassword: string | null = null;
        let compteExistant: boolean;

        if (existingParentUser) {
          const existingProfile = await tx.parentProfile.findUnique({ where: { userId: existingParentUser.id } });
          parentProfileId = existingProfile!.id;
          parentUserId = existingParentUser.id;
          parentTemporaryPassword = null;
          compteExistant = true;
        } else {
          parentTemporaryPassword = generateTemporaryPassword();
          const parentPassword = await bcrypt.hash(parentTemporaryPassword, 10);
          const parentUser = await tx.user.create({
            data: {
              schoolId: input.schoolId,
              role: 'PARENT',
              firstName: 'Parent de',
              lastName: input.nom,
              email: input.parentContactEmail,
              phone: input.parentContactTelephone,
              passwordHash: parentPassword,
              mustChangePassword: true,
              accessMode: input.parentAccessMode,
              isActive: true,
            },
          });
          const parentProfile = await tx.parentProfile.create({ data: { userId: parentUser.id } });
          parentProfileId = parentProfile.id;
          parentUserId = parentUser.id;
          compteExistant = false;
        }

        await tx.parentStudent.create({
          data: { parentProfileId, studentProfileId: studentProfile.id },
        });

        comptesCrees.push({
          role: 'PARENT',
          userId: parentUserId,
          temporaryPassword: parentTemporaryPassword,
          dispositifOS: input.parentDispositifOS,
          contactEmail: input.parentContactEmail,
          contactTelephone: input.parentContactTelephone,
          compteExistant,
          accessMode: input.parentAccessMode,
        });
      }

      await tx.studentOnboarding.update({
        where: { id: input.onboardingId },
        data: {
          status: 'ACTIVATED',
          validatedById: input.validatedById,
          validatedAt: new Date(),
          createdStudentId: studentProfile.id,
          classId: input.classId,
          numeroInterne,
          ...(input.derogationCapacite && input.motifDerogation ? { overrideCapacityReason: input.motifDerogation } : {}),
        },
      });

      if (input.examCandidateId) {
        await tx.entranceExamCandidate.update({
          where: { id: input.examCandidateId },
          data: { studentProfileId: studentProfile.id },
        });
      }

      await tx.activitiesLog.create({
        data: {
          userId: input.validatedById,
          action: 'ONBOARDING_ACTIVATED',
          description: `Inscription validée pour ${input.prenom} ${input.nom}`,
          schoolId: input.schoolId,
          metadata: {
            onboardingId: input.onboardingId,
            studentProfileId: studentProfile.id,
            classId: input.classId,
            statutAvant: 'SUBMITTED',
            statutApres: 'ACTIVATED',
            roleActeur: input.roleActeur ?? 'STAFF',
            ...(input.derogationCapacite ? { derogationCapacite: true, motifDerogation: input.motifDerogation } : {}),
          },
        },
      });

      return { studentProfile, comptesCrees };
    });

    return { studentProfileId: studentProfile.id, comptesCrees };
  }

  // ── Pièces justificatives ──────────────────────────────────────────────

  async listDocumentRequirements(schoolId: string): Promise<DocumentRequirementRecord[]> {
    const rows = await this.prisma.enrollmentDocumentRequirement.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(r => ({
      id: r.id,
      schoolId: r.schoolId,
      code: r.code,
      libelle: r.libelle,
      obligatoire: r.obligatoire,
      applicableCase: r.applicableCase,
    }));
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
    return {
      id: row.id,
      schoolId: row.schoolId,
      code: row.code,
      libelle: row.libelle,
      obligatoire: row.obligatoire,
      applicableCase: row.applicableCase,
    };
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
    return rows.map(r => ({
      id: r.id,
      onboardingId: r.onboardingId,
      requirementId: r.requirementId,
      code: r.code,
      libelle: r.libelle,
      received: r.received,
      receivedAt: r.receivedAt,
      receivedById: r.receivedById,
      note: r.note,
      fileKey: r.fileKey,
    }));
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
      created.push({
        id: row.id,
        onboardingId: row.onboardingId,
        requirementId: row.requirementId,
        code: row.code,
        libelle: row.libelle,
        received: row.received,
        receivedAt: row.receivedAt,
        receivedById: row.receivedById,
        note: row.note,
        fileKey: row.fileKey,
      });
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
    return {
      id: row.id,
      onboardingId: row.onboardingId,
      requirementId: row.requirementId,
      code: row.code,
      libelle: row.libelle,
      received: row.received,
      receivedAt: row.receivedAt,
      receivedById: row.receivedById,
      note: row.note,
      fileKey: row.fileKey,
    };
  }

  async updateCompletenessScore(onboardingId: string, score: number, validableSousReserve: boolean): Promise<void> {
    await this.prisma.studentOnboarding.update({
      where: { id: onboardingId },
      data: { completenessScore: score, validableSousReserve },
    });
  }
}
