import { inngest } from "../client/index.ts";
import { prisma } from "../../../config/prisma";
import { PrismaAnnouncementRepository } from "../../persistence/prisma/PrismaAnnouncementRepository";
import { PrismaJournalMaintenanceRepository } from "../../persistence/prisma/PrismaJournalMaintenanceRepository";
import { PrismaCorbeilleRepository } from "../../persistence/prisma/PrismaCorbeilleRepository";
import { PrismaSauvegardeRepository } from "../../persistence/prisma/PrismaSauvegardeRepository";
import { PurgerLogsEcoleUseCase } from "@application/maintenance/PurgerLogsEcoleUseCase";
import { PurgerAnnoncesExpireesUseCase } from "@application/maintenance/PurgerAnnoncesExpireesUseCase";
import { PurgerCorbeilleUseCase } from "@application/maintenance/PurgerCorbeilleUseCase";
import { SauvegarderEcoleUseCase } from "@application/maintenance/SauvegarderEcoleUseCase";

export const purgeSchoolLogs = inngest.createFunction(
  { id: "purge-school-logs", name: "Purge hebdomadaire des journaux", triggers: [{ cron: "0 0 * * 0" }] },
  async ({ step }) => {
    return await step.run("purge-school-logs-by-retention", async () => {
      const useCase = new PurgerLogsEcoleUseCase(new PrismaJournalMaintenanceRepository(prisma));
      return await useCase.execute();
    });
  }
);

export const purgeAnnoncesExpirees = inngest.createFunction(
  { id: "purge-annonces-expirees", name: "Purge quotidienne babillard", triggers: [{ cron: "0 1 * * *" }] },
  async ({ step }) => {
    return await step.run("purge-annonces-expirees", async () => {
      const useCase = new PurgerAnnoncesExpireesUseCase(
        new PrismaAnnouncementRepository(prisma),
      );
      return await useCase.execute();
    });
  }
);

export const purgerCorbeille = inngest.createFunction(
  { id: "purge-corbeille", name: "Purge planifiée de la corbeille (Couche 1)", triggers: [{ cron: "0 4 * * *" }] },
  async ({ step }) => {
    await step.run("purge-users-vers-archive", async () => {
      const useCase = new PurgerCorbeilleUseCase(new PrismaCorbeilleRepository(prisma));
      const cutoff = new Date(Date.now() - parseInt(process.env.PURGE_GRACE_PERIOD_DAYS || "30", 10) * 24 * 60 * 60 * 1000);
      await useCase.purgerUtilisateurs(cutoff);
    });

    await step.run("purge-classes", async () => {
      const useCase = new PurgerCorbeilleUseCase(new PrismaCorbeilleRepository(prisma));
      const cutoff = new Date(Date.now() - parseInt(process.env.PURGE_GRACE_PERIOD_DAYS || "30", 10) * 24 * 60 * 60 * 1000);
      await useCase.purgerClasses(cutoff);
    });

    await step.run("purge-subjects", async () => {
      const useCase = new PurgerCorbeilleUseCase(new PrismaCorbeilleRepository(prisma));
      const cutoff = new Date(Date.now() - parseInt(process.env.PURGE_GRACE_PERIOD_DAYS || "30", 10) * 24 * 60 * 60 * 1000);
      await useCase.purgerMatieres(cutoff);
    });

    return { purged: true };
  },
);

export const BackupSchoolDataJob = inngest.createFunction(
  {
    id: "Backup-School-Data",
    name: "Sauvegarde des données établissement",
    triggers: [{ event: "backup/school.requested" }, { cron: "0 3 * * *" }],
  },
  async ({ event, step }) => {
    const payload = (event.data ?? {}) as {
      schoolId?: string;
      requestedByMasterId?: string | null;
      source?: "cron" | "manual";
    };

    const result = await step.run("create-school-backups", async () => {
      const useCase = new SauvegarderEcoleUseCase(new PrismaSauvegardeRepository(prisma));
      return await useCase.execute({
        schoolId: payload.schoolId,
        requestedByMasterId: payload.requestedByMasterId ?? null,
        source: payload.source ?? (payload.schoolId ? "manual" : "cron"),
      });
    });

    return result;
  }
);
