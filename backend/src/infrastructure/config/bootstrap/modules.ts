import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { PrismaDisciplineRepository } from '@infrastructure/persistence/prisma/PrismaDisciplineRepository';
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { PrismaLibraryRepository } from '@infrastructure/persistence/prisma/PrismaLibraryRepository';
import { PrismaParentRepository } from '@infrastructure/persistence/prisma/PrismaParentRepository';
import { PrismaParentFinancePortalRepository } from '@infrastructure/persistence/prisma/PrismaParentFinancePortalRepository';
import { creerContainer } from '@infrastructure/config/container';
import { DisciplineController } from '@infrastructure/http/controllers/DisciplineController';
import { LibraryController } from '@infrastructure/http/controllers/LibraryController';
import { ParentFinancePortalController } from '@infrastructure/http/controllers/ParentFinancePortalController';
import { SchoolOnboardingController as SchoolOnboardingControllerForMaster } from '@infrastructure/http/controllers/SchoolOnboardingController';
import { creerDisciplineRoutes } from '@infrastructure/http/routes/discipline.routes';
import { creerLibraryRoutes } from '@infrastructure/http/routes/library.routes';
import { creerParentFinancePortalRoutes } from '@infrastructure/http/routes/parentFinancePortal.routes';
import {
  creerMasterApprovalsV1Routes,
  creerMasterApprovalsV2Routes,
} from '@infrastructure/http/routes/masterApprovals.routes';
import { registerElectifsRoutes } from './electifs';

type Container = ReturnType<typeof creerContainer>;

export function registerModulesRoutes(app: Application, p: typeof prisma = prisma, c: Container): void {
  const auditAdapter = new AIActionAuditAdapter(p);
  const parentRepository = new PrismaParentRepository(p);

  // ── Discipline ───────────────────────────────────────────────────────────────
  // Extraits de bootstrap.ts vers DisciplineController (déviation architecturale corrigée)
  const disciplineController = new DisciplineController(
    new PrismaDisciplineRepository(p),
    new PrismaUserRepository(p),
    auditAdapter,
  );
  app.use('/api/v2/discipline', creerDisciplineRoutes(disciplineController));

  // ── Bibliothèque ─────────────────────────────────────────────────────────────
  const libraryController = new LibraryController(
    new PrismaLibraryRepository(p),
    parentRepository,
    auditAdapter,
  );
  app.use('/api/v2/library', creerLibraryRoutes(libraryController));

  // ── Factures parent (portail parent) ─────────────────────────────────────────
  const parentFinancePortalController = new ParentFinancePortalController(
    new PrismaParentFinancePortalRepository(p),
    parentRepository,
    c.finance.factureRepository,
    c.finance.initierPaiement,
    c.finance.verifierStatutPaiement,
  );
  app.use('/api/v2/parent', creerParentFinancePortalRoutes(parentFinancePortalController));

  // ── Master admin — approbation d'une école (hexagonale) ──────────────────────
  const onboardingControllerForMaster2 = new SchoolOnboardingControllerForMaster(
    c.school.onboarder,
    c.school.approuver,
  );
  app.use('/api/master', creerMasterApprovalsV1Routes(onboardingControllerForMaster2));
  app.use('/api/v2/master', creerMasterApprovalsV2Routes(onboardingControllerForMaster2));

  registerElectifsRoutes(app, p, c);
}
