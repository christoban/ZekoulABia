import { inngest } from "../client/index.ts";
import { prisma } from "../../../config/prisma.ts";
import { PrismaFinanceJobsRepository } from "../../persistence/prisma/PrismaFinanceJobsRepository";
import { PrismaFactureRepository } from "../../persistence/prisma/PrismaFactureRepository";
import { PrismaPlanFraisRepository } from "../../persistence/prisma/PrismaPlanFraisRepository";
import { PrismaClasseRepository } from "../../persistence/prisma/PrismaClasseRepository";
import { EnvoyerRappelsPaiementUseCase } from "@application/finance/EnvoyerRappelsPaiementUseCase";
import { VerifierSeuilAbsencesUseCase } from "@application/finance/VerifierSeuilAbsencesUseCase";
import { MarquerRetardsPretUseCase } from "@application/finance/MarquerRetardsPretUseCase";
import { GenererFacturesInscriptionAutomatiqueUseCase } from "@application/finance/GenererFacturesInscriptionAutomatiqueUseCase";
import { NodemailerEmailService } from "../../services/email/NodemailerEmailService";
import { SmsNotificationAdapter } from "../../services/sms/SmsNotificationAdapter";
import { SocketNotificationService } from "../../services/notification/SocketNotificationService";

const financeJobsRepository = new PrismaFinanceJobsRepository(prisma);

export const handleEnrollmentActivated = inngest.createFunction(
  { id: "handle-enrollment-activated", name: "Facturation automatique d'inscription", triggers: [{ event: "enrollment.activated" }] },
  async ({ event, step }) => {
    const { schoolId, studentUserId, classId, academicYearId } = event.data as {
      schoolId: string;
      studentUserId?: string;
      classId: string;
      academicYearId?: string;
    };
    if (!studentUserId || !classId) return { facturesCrees: 0, ignores: 0 };

    return await step.run("generer-factures-inscription", async () => {
      const factureRepo = new PrismaFactureRepository(prisma);
      const planFraisRepo = new PrismaPlanFraisRepository(prisma);
      const classeRepo = new PrismaClasseRepository(prisma);
      const useCase = new GenererFacturesInscriptionAutomatiqueUseCase(factureRepo, planFraisRepo, classeRepo);
      return useCase.execute({ schoolId, studentUserId, classId, academicYearId });
    });
  }
);

export const sendPaymentReminders = inngest.createFunction(
  { id: "send-payment-reminders", name: "Relances paiement automatiques", triggers: [{ cron: "0 8 * * *" }] },
  async ({ step }) => {
    return await step.run("find-and-remind", async () => {
      const useCase = new EnvoyerRappelsPaiementUseCase(financeJobsRepository, new NodemailerEmailService(), new SocketNotificationService(), new SmsNotificationAdapter());
      return useCase.execute();
    });
  }
);

export const checkAbsenceThreshold = inngest.createFunction(
  { id: "check-absence-threshold", name: "Vérification seuil d'absences", triggers: [{ cron: "0 7 * * *" }] },
  async ({ step }) => {
    return await step.run("check-thresholds", async () => {
      const useCase = new VerifierSeuilAbsencesUseCase(financeJobsRepository, new NodemailerEmailService(), new SmsNotificationAdapter());
      return useCase.execute();
    });
  }
);

export const markOverdueLoans = inngest.createFunction(
  { id: "mark-overdue-loans", name: "Marquer emprunts en retard", triggers: [{ cron: "0 1 * * *" }] },
  async ({ step }) => {
    const useCase = new MarquerRetardsPretUseCase(financeJobsRepository, new SocketNotificationService(), new SmsNotificationAdapter());
    const toMark = (await step.run("find-overdue-loans", async () => {
      return useCase.findOverdue();
    })) as unknown as Awaited<ReturnType<typeof useCase.findOverdue>>;

    if (toMark.length === 0) return { updated: 0 };

    await step.run("update-overdue-loans", async () => {
      await useCase.markOverdue(toMark.map((l) => (l as any).id));
    });

    await step.run("notify-overdue-loans", async () => {
      await useCase.notifyOverdue(toMark as any);
    });

    return { updated: toMark.length };
  }
);
