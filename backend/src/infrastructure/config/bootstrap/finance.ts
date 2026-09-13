import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { FinanceController } from '@infrastructure/http/controllers/FinanceController';
import { creerFinanceRoutes } from '@infrastructure/http/routes/finance.routes';
import { DepartmentController } from '@infrastructure/http/controllers/DepartmentController';
import { creerDepartmentRoutes } from '@infrastructure/http/routes/department.routes';
import { StatisticsController } from '@infrastructure/http/controllers/StatisticsController';
import { creerStatisticsRoutes } from '@infrastructure/http/routes/statistics.routes';
import { CommunicationsController } from '@infrastructure/http/controllers/CommunicationsController';
import { BroadcastService } from '@infrastructure/services/communication/BroadcastService';
import { creerCommunicationsRoutes } from '@infrastructure/http/routes/communications.routes';
import { TeachingAssignmentController } from '@infrastructure/http/controllers/TeachingAssignmentController';
import { creerTeachingAssignmentRoutes } from '@infrastructure/http/routes/teaching-assignment.routes';
import { TimetableGridConfigController } from '@infrastructure/http/controllers/TimetableGridConfigController';
import { creerTimetableGridConfigRoutes } from '@infrastructure/http/routes/timetable-grid-config.routes';
import { PrismaPaiementRepository } from '@infrastructure/persistence/prisma/PrismaPaiementRepository';
import { PrismaSchoolRepository } from '@infrastructure/persistence/prisma/PrismaSchoolRepository';
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { PrismaDepartmentRepository } from '@infrastructure/persistence/prisma/PrismaDepartmentRepository';
import { PrismaStaffProfileRepository } from '@infrastructure/persistence/prisma/PrismaStaffProfileRepository';
import { PrismaStatisticsQueryRepository } from '@infrastructure/persistence/prisma/PrismaStatisticsQueryRepository';
import { PrismaRattachementEnseignantRepository } from '@infrastructure/persistence/prisma/PrismaRattachementEnseignantRepository';
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';

type Container = ReturnType<typeof creerContainer>;

export function registerFinance(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerFinanceRoutes(app, _prisma, container);
}

export function registerFinanceRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  const paiementRepositoryForFinance = new PrismaPaiementRepository(p as any);
  const schoolRepositoryForFinance = new PrismaSchoolRepository(p as any);
  const userRepositoryForFinance = new PrismaUserRepository(p as any);
  const auditForFinance = new AIActionAuditAdapter(p as any);
  const notifForFinance = new SocketNotificationService();

  const financeController = new FinanceController(
    c.finance.creerPlanFrais,
    c.finance.genererFacture,
    c.finance.genererFacturesEnMasse,
    c.finance.initierPaiement,
    c.finance.traiterWebhook,
    c.finance.rembourserCaution,
    c.finance.enregistrerDepense,
    c.finance.enregistrerPaiementCash,
    c.finance.copierPlansFraisAnneePrecedente,
    c.finance.changerStatutPlanFrais,
    paiementRepositoryForFinance,
    schoolRepositoryForFinance,
    userRepositoryForFinance,
    auditForFinance,
    notifForFinance,
  );

  app.use('/api/v2/finance', creerFinanceRoutes(financeController));

  const departmentController = new DepartmentController(
    new PrismaDepartmentRepository(p as any),
    new PrismaStaffProfileRepository(p as any),
    userRepositoryForFinance,
  );
  app.use('/api/v2/departments', creerDepartmentRoutes(departmentController));

  const statisticsController = new StatisticsController(
    new PrismaStatisticsQueryRepository(p as any),
    auditForFinance,
    (c as any).metric?.getMetric,
  );
  app.use('/api/v2/statistics', creerStatisticsRoutes(statisticsController));

  const broadcastService = new BroadcastService(p as any);
  const communicationsController = new CommunicationsController(broadcastService, auditForFinance);
  app.use('/api/v2/communications', creerCommunicationsRoutes(communicationsController));

  const teachingAssignmentController = new TeachingAssignmentController(
    new PrismaRattachementEnseignantRepository(p as any),
    auditForFinance,
    c.activityLog,
  );
  app.use('/api/v2/teaching-assignments', creerTeachingAssignmentRoutes(teachingAssignmentController));

  const timetableGridConfigController = new TimetableGridConfigController(
    new PrismaTimetableRepository(p as any),
  );
  app.use('/api/v2/timetable-grid-config', creerTimetableGridConfigRoutes(timetableGridConfigController));
}
