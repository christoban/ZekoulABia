import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { AIActionAuditController } from '@infrastructure/http/controllers/AIActionAuditController';
import { SchoolAdminQueriesController } from '@infrastructure/http/controllers/SchoolAdminQueriesController';
import { SchoolAuditConfigController } from '@infrastructure/http/controllers/SchoolAuditConfigController';
import { SchoolStructureSyncController } from '@infrastructure/http/controllers/SchoolStructureSyncController';
import { PrismaAIActionAuditLogQueryRepository } from '@infrastructure/persistence/prisma/PrismaAIActionAuditLogQueryRepository';
import { PrismaSchoolAdminQueriesRepository } from '@infrastructure/persistence/prisma/PrismaSchoolAdminQueriesRepository';
import { PrismaSchoolStructureSyncRepository } from '@infrastructure/persistence/prisma/PrismaSchoolStructureSyncRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';
import { PrismaClassCouncilRepository } from '@infrastructure/persistence/prisma/PrismaClassCouncilRepository';
import { PrismaSubjectAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaSubjectAssignmentRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { ObtenirAnomaliesEtablissementUseCase } from '@application/school/ObtenirAnomaliesEtablissementUseCase';
import { creerSchoolAdminQueriesRoutes } from '@infrastructure/http/routes/schoolAdminQueries.routes';
import { creerSchoolAuditConfigRoutes } from '@infrastructure/http/routes/schoolAuditConfig.routes';
import { creerAIActionAuditRoutes } from '@infrastructure/http/routes/aiActionAudit.routes';
import { registerAuthOnboardingRoutes } from './authOnboarding';

type Container = ReturnType<typeof creerContainer>;

export function registerSchoolRoutes(
  app: Application,
  prismaParam: typeof prisma = prisma,
  container: Container = creerContainer() as Container,
): void {
  const p = prismaParam ?? prisma;
  const c = container;

  const schoolAdminQueriesRepository = new PrismaSchoolAdminQueriesRepository(p);
  const schoolStructureSyncRepository = new PrismaSchoolStructureSyncRepository(p);
  const subjectAssignmentRepository = new PrismaSubjectAssignmentRepository(p);

  const obtenirAnomaliesEtablissementUseCase = new ObtenirAnomaliesEtablissementUseCase(
    new PrismaAnneeAcademiqueRepository(p),
    new PrismaClasseRepository(p),
    new PrismaTimetableRepository(p),
    new PrismaClassCouncilRepository(p),
  );

  const schoolAdminQueriesController = new SchoolAdminQueriesController(
    schoolAdminQueriesRepository,
    obtenirAnomaliesEtablissementUseCase,
  );
  const schoolAuditConfigController = new SchoolAuditConfigController(schoolAdminQueriesRepository);
  const schoolStructureSyncController = new SchoolStructureSyncController(
    schoolStructureSyncRepository,
    subjectAssignmentRepository,
  );
  const aiActionAuditController = new AIActionAuditController(new PrismaAIActionAuditLogQueryRepository(p));

  app.use('/api/v2/school', creerSchoolAdminQueriesRoutes(schoolAdminQueriesController));
  app.use(
    '/api/v2/schools',
    creerSchoolAuditConfigRoutes(schoolAuditConfigController, schoolStructureSyncController),
  );
  app.use('/api/v2/security', creerAIActionAuditRoutes(aiActionAuditController));

  registerAuthOnboardingRoutes(app, p, c);
}
