import { inngest } from "../client/index.ts";
import { prisma } from "../../../config/prisma.ts";
import { PrismaHealthJobsRepository } from "../../persistence/prisma/PrismaHealthJobsRepository";
import { PrismaSanteEleveRepository } from "../../persistence/prisma/PrismaSanteEleveRepository";
import { GroqIAService } from '../../services/ai/GroqIAService.ts';
import { CalculerScoresSanteUseCase } from "@application/sante/CalculerScoresSanteUseCase";
import { GererAlertesSanteUseCase } from "@application/sante/GererAlertesSanteUseCase";
import { EnvoyerDigestProfPrincipalUseCase } from "@application/sante/EnvoyerDigestProfPrincipalUseCase";
import { SocketNotificationService } from '../../services/notification/SocketNotificationService';

const healthJobsRepository = new PrismaHealthJobsRepository(prisma);
const santeRepository = new PrismaSanteEleveRepository(prisma);
const iaService = new GroqIAService();

export const computeStudentHealthScores = inngest.createFunction(
  { id: "compute-student-health-scores", name: "Calcul indice santé scolaire", triggers: [{ cron: "0 2 * * *" }] },
  async ({ step }) => {
    const { events } = await step.run("compute-all-schools", async () => {
      const useCase = new CalculerScoresSanteUseCase(healthJobsRepository, santeRepository, iaService);
      return useCase.execute();
    });
    for (const ev of events) await inngest.send(ev as { name: string; data: Record<string, unknown> });
    return { computed: true };
  }
);

export const handleCriticalHealthAlert = inngest.createFunction(
  { id: "handle-critical-health-alert", name: "Alerte élève — risque critique", triggers: [{ event: "ai/alert.critical" }] },
  async ({ event }) => {
    const { studentId, schoolId, healthScore } = event.data as { studentId: string; schoolId: string; healthScore: number };
    const useCase = new GererAlertesSanteUseCase(healthJobsRepository, iaService, new SocketNotificationService());
    return useCase.handleCritical({ studentId, schoolId, healthScore });
  },
);

export const handleWarningHealthAlert = inngest.createFunction(
  { id: "handle-warning-health-alert", name: "Alerte élève — vigilance", triggers: [{ event: "ai/alert.warning" }] },
  async ({ event }) => {
    const { studentId, schoolId, healthScore } = event.data as { studentId: string; schoolId: string; healthScore: number };
    const useCase = new GererAlertesSanteUseCase(healthJobsRepository, iaService, new SocketNotificationService());
    return useCase.handleWarning({ studentId, schoolId, healthScore });
  },
);

export const handlePositiveHealthAlert = inngest.createFunction(
  { id: "handle-positive-health-alert", name: "Alerte élève — progression positive", triggers: [{ event: "ai/alert.positive" }] },
  async ({ event }) => {
    const { studentId, schoolId, healthScore } = event.data as { studentId: string; schoolId: string; healthScore: number };
    const useCase = new GererAlertesSanteUseCase(healthJobsRepository, iaService, new SocketNotificationService());
    return useCase.handlePositive({ studentId, schoolId, healthScore });
  },
);

export const sendProfessorPrincipalDigest = inngest.createFunction(
  { id: "send-professor-principal-digest", name: "Digest quotidien — professeur principal", triggers: [{ cron: "30 2 * * *" }] },
  async ({ step }) => {
    await step.run("digest-all-schools", async () => {
      const notificationService = new SocketNotificationService();
      const useCase = new EnvoyerDigestProfPrincipalUseCase(healthJobsRepository, notificationService);
      return useCase.execute();
    });
    return { digestSent: true };
  },
);
