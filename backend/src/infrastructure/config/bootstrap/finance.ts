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
import { PrismaTeachingAssignmentGeneratorRepository } from '@infrastructure/persistence/prisma/PrismaTeachingAssignmentGeneratorRepository';
import { GenererAffectationsUseCase } from '@application/teachingAssignment/GenererAffectationsUseCase';
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';
import { PrismaStudentProfileRepository } from '@infrastructure/persistence/prisma/PrismaStudentProfileRepository';
import { PrismaFactureRepository } from '@infrastructure/persistence/prisma/PrismaFactureRepository';
import { ConsulterStatutFraisEleveUseCase } from '@application/finance/ConsulterStatutFraisEleveUseCase';
import { StudentFeesStatusController } from '@infrastructure/http/controllers/StudentFeesStatusController';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';

type Container = ReturnType<typeof creerContainer>;

export function registerFinance(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerFinanceRoutes(app, _prisma, container);
}

export function registerFinanceRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  const paiementRepositoryForFinance = new PrismaPaiementRepository(p);
  const schoolRepositoryForFinance = new PrismaSchoolRepository(p);
  const userRepositoryForFinance = new PrismaUserRepository(p);
  const factureRepositoryForFinance = new PrismaFactureRepository(p);
  const auditForFinance = new AIActionAuditAdapter(p);
  const notifForFinance = new SocketNotificationService();

  const financeController = new FinanceController(
    c.finance.creerPlanFrais,
    c.finance.modifierPlanFrais,
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

  const studentProfileRepositoryForFinance = new PrismaStudentProfileRepository(p);
  const consulterStatutFraisUseCase = new ConsulterStatutFraisEleveUseCase(
    factureRepositoryForFinance,
    userRepositoryForFinance,
    studentProfileRepositoryForFinance,
  );
  const studentFeesStatusController = new StudentFeesStatusController(consulterStatutFraisUseCase);

  app.use('/api/v2/finance', creerFinanceRoutes(financeController, studentFeesStatusController));

  const departmentController = new DepartmentController(
    new PrismaDepartmentRepository(p),
    new PrismaStaffProfileRepository(p),
    userRepositoryForFinance,
  );
  app.use('/api/v2/departments', creerDepartmentRoutes(departmentController));

  const statisticsController = new StatisticsController(
    new PrismaStatisticsQueryRepository(p),
    auditForFinance,
    c.metric.getMetric,
  );
  app.use('/api/v2/statistics', creerStatisticsRoutes(statisticsController));

  const broadcastService = new BroadcastService(p);
  const communicationsController = new CommunicationsController(broadcastService, auditForFinance);
  app.use('/api/v2/communications', creerCommunicationsRoutes(communicationsController));

  const teachingAssignmentGeneratorRepository = new PrismaTeachingAssignmentGeneratorRepository(p);
  const genererAffectationsUseCase = new GenererAffectationsUseCase(teachingAssignmentGeneratorRepository);
  const teachingAssignmentController = new TeachingAssignmentController(
    new PrismaRattachementEnseignantRepository(p),
    genererAffectationsUseCase,
    auditForFinance,
    c.activityLog,
    c.notificationService,
  );
  app.use('/api/v2/teaching-assignments', creerTeachingAssignmentRoutes(teachingAssignmentController));

  const timetableGridConfigController = new TimetableGridConfigController(
    new PrismaTimetableRepository(p),
    c.events.publisher,
  );
  app.use('/api/v2/timetable-grid-config', creerTimetableGridConfigRoutes(timetableGridConfigController));
}
