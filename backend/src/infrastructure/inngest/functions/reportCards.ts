import { inngest } from "../client/index.ts";
import { prisma } from "../../../config/prisma.ts";
import { SocketNotificationService } from '../../services/notification/SocketNotificationService.ts';
import { PrismaSanteEleveRepository } from "../../persistence/prisma/PrismaSanteEleveRepository";
import { CalculerIndiceSanteUseCase } from "@application/ai/CalculerIndiceSanteUseCase";
import { GroqIAService } from '../../services/ai/GroqIAService.ts';
import { PrismaAnneeAcademiqueRepository } from "../../persistence/prisma/PrismaAnneeAcademiqueRepository";
import { PrismaNoteRepository } from "../../persistence/prisma/PrismaNoteRepository";
import { PrismaPresenceRepository } from "../../persistence/prisma/PrismaPresenceRepository";
import { PrismaBulletinRepository } from "../../persistence/prisma/PrismaBulletinRepository";
import { PrismaSchoolRepository } from "../../persistence/prisma/PrismaSchoolRepository";
import { PrismaMatiereRepository } from "../../persistence/prisma/PrismaMatiereRepository";
import { PrismaUserRepository } from "../../persistence/prisma/PrismaUserRepository";
import { PrismaStudentRecommendationRepository } from "../../persistence/prisma/PrismaStudentRecommendationRepository";
import { PrismaSchoolConfigRepository } from "../../persistence/prisma/PrismaSchoolConfigRepository";
import { PrismaTeachingAssignmentRepository } from "../../persistence/prisma/PrismaTeachingAssignmentRepository";
import { PrismaStudentProfileRepository } from "../../persistence/prisma/PrismaStudentProfileRepository";
import { DetecterChuteMoyenneUseCase, trouverSequencePrecedente } from "@application/grade/DetecterChuteMoyenneUseCase";
import { GenererBulletinsInngestUseCase } from "@application/reportCard/GenererBulletinsInngestUseCase";
import { ErreurNonRetriable } from "@application/shared/ErreurNonRetriable";
import { NonRetriableError } from "inngest";

import { NodemailerEmailService } from "@infrastructure/services/email/NodemailerEmailService";

// Re-export for backward compat (anciennement défini ici)
export { trouverSequencePrecedente };

const iaService = new GroqIAService();
const calculerIndiceSanteUseCase = new CalculerIndiceSanteUseCase(
  new PrismaSanteEleveRepository(prisma),
  iaService,
);

const creerDetecterChuteUseCase = () =>
  new DetecterChuteMoyenneUseCase(
    new PrismaNoteRepository(prisma),
    new SocketNotificationService(),
    iaService,
    new PrismaAnneeAcademiqueRepository(prisma),
    new PrismaStudentRecommendationRepository(prisma),
    new PrismaMatiereRepository(prisma),
    new PrismaSchoolConfigRepository(prisma),
    new PrismaTeachingAssignmentRepository(prisma),
    new PrismaStudentProfileRepository(prisma),
  );

export const generateReportCards = inngest.createFunction(
  { id: "Generate-Report-Cards", triggers: [{ event: "reportcard/generate" }] },
  async ({ event, step }) => {
    const { yearId, periodId, classId, studentId } = event.data as {
      yearId: string;
      period?: string;
      periodId?: string | null;
      classId?: string | null;
      studentId?: string | null;
    };

    const genererUseCase = new GenererBulletinsInngestUseCase(
      new PrismaAnneeAcademiqueRepository(prisma),
      new PrismaUserRepository(prisma),
      new PrismaNoteRepository(prisma),
      new PrismaPresenceRepository(prisma),
      new PrismaBulletinRepository(prisma),
      new PrismaSchoolRepository(prisma),
      new PrismaMatiereRepository(prisma),
      new NodemailerEmailService(),
    );

    const { academicYear, academicPeriod, generatedStudents } = await step.run("generate-report-cards", async () => {
      try {
        const result = await genererUseCase.generer({ yearId, periodId, classId, studentId });
        if (!result.generatedStudents.length) return { academicYear: result.academicYear, academicPeriod: result.academicPeriod, generatedStudents: [] as string[] };
        return { academicYear: result.academicYear, academicPeriod: result.academicPeriod, generatedStudents: result.generatedStudents };
      } catch (err) {
        if (err instanceof ErreurNonRetriable) throw new NonRetriableError(err.message);
        throw err;
      }
    });

    if (!generatedStudents.length) {
      return { message: "No students found", generated: 0 };
    }

    return { message: "Report cards generated", generated: generatedStudents.length };
  }
);

export const handleGradeLockedDropDetection = inngest.createFunction(
  { id: "handle-grade-locked-drop-detection", name: "Détection chute par matière", triggers: [{ event: "grade/locked" }] },
  async ({ event }) => {
    const { studentId, subjectId, schoolId, sequenceId } = event.data as {
      gradeId: string; studentId: string; subjectId: string; schoolId: string; sequenceId: string;
    };
    const useCase = creerDetecterChuteUseCase();
    const resultat = await useCase.execute({ studentId, subjectId, schoolId, sequenceId });
    if (!resultat) return { skipped: true };
    return { notified: !!resultat.teacherId };
  },
);

export const handleGradeLockedBatchDropDetection = inngest.createFunction(
  { id: "handle-grade-locked-batch-drop-detection", name: "Détection chute par matière (validation en bloc)", triggers: [{ event: "grade/locked-batch" }] },
  async ({ event }) => {
    const { schoolId, grades } = event.data as {
      schoolId: string;
      grades: Array<{ studentId: string; subjectId: string; sequenceId: string }>;
    };
    const useCase = creerDetecterChuteUseCase();
    const { enseignantsNotifies } = await useCase.executeBatch({ schoolId, grades });
    return { enseignantsNotifies };
  },
);


