import type {
  EnrollmentDocument,
  EnrollmentDocumentRequirement,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateTemporaryPassword } from '@domain/services/PasswordGenerator';
import { formatNumeroInterne } from '@domain/services/NumeroInterneGenerator';
import type {
  DocumentRecord,
  DocumentRequirementRecord,
  ValiderOnboardingCompteResultat,
  ValiderOnboardingInput,
} from '@domain/ports/repositories/EleveOnboardingRepository';

export function toDocumentRequirementRecord(r: EnrollmentDocumentRequirement): DocumentRequirementRecord {
  return {
    id: r.id,
    schoolId: r.schoolId,
    code: r.code,
    libelle: r.libelle,
    obligatoire: r.obligatoire,
    applicableCase: r.applicableCase,
  };
}

export function toDocumentRecord(r: EnrollmentDocument): DocumentRecord {
  return {
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
  };
}

export async function rejeterOnboardingOp(
  prisma: PrismaClient,
  id: string,
  data: { rejectionReason: string; rejectedById: string; rejectedAt: Date },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
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

export async function soumettreOnboardingOp(
  prisma: PrismaClient,
  id: string,
  data: {
    submittedData?: Record<string, unknown>;
    classId?: string;
    nomProvisoire?: string;
    submittedById: string;
    submitterRole: string;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
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

export async function renvoyerOnboardingOp(
  prisma: PrismaClient,
  id: string,
  data: { commentaire: string; adminId: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
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

async function creerEleveEtInscriptionTx(tx: Prisma.TransactionClient, input: ValiderOnboardingInput) {
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
  const studentCount = await tx.studentProfile.count({
    where: { user: { schoolId: input.schoolId } },
  });
  const numeroInterne = formatNumeroInterne(schoolCode, new Date().getFullYear(), studentCount + 1);

  const studentProfile = await tx.studentProfile.create({
    data: {
      userId: studentUser.id,
      schoolId: input.schoolId,
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
      _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
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

  return {
    studentProfile,
    numeroInterne,
    studentCompte: {
      role: 'STUDENT' as const,
      userId: studentUser.id,
      temporaryPassword: studentTemporaryPassword,
      dispositifOS: input.eleveDispositifOS,
      contactEmail: input.eleveContactEmail,
      contactTelephone: input.eleveContactTelephone,
      compteExistant: false,
      accessMode: input.eleveAccessMode,
    },
  };
}

async function resoudreOuCreerParentTx(
  tx: Prisma.TransactionClient,
  input: ValiderOnboardingInput,
  studentProfileId: string,
): Promise<ValiderOnboardingCompteResultat> {
  const contactFilters: Array<{ email: string } | { phone: string }> = [];
  if (input.parentContactEmail) contactFilters.push({ email: input.parentContactEmail });
  if (input.parentContactTelephone) contactFilters.push({ phone: input.parentContactTelephone });

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
    data: { parentProfileId, studentProfileId },
  });

  return {
    role: 'PARENT',
    userId: parentUserId,
    temporaryPassword: parentTemporaryPassword,
    dispositifOS: input.parentDispositifOS,
    contactEmail: input.parentContactEmail,
    contactTelephone: input.parentContactTelephone,
    compteExistant,
    accessMode: input.parentAccessMode,
  };
}

export async function validerOnboardingOp(
  prisma: PrismaClient,
  input: ValiderOnboardingInput,
): Promise<{ studentProfileId: string; comptesCrees: ValiderOnboardingCompteResultat[] }> {
  const { studentProfile, comptesCrees } = await prisma.$transaction(async (tx) => {
    const { studentProfile, numeroInterne, studentCompte } = await creerEleveEtInscriptionTx(tx, input);
    const comptesCrees: ValiderOnboardingCompteResultat[] = [studentCompte];

    if (input.parentRecoitContact) {
      comptesCrees.push(await resoudreOuCreerParentTx(tx, input, studentProfile.id));
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
