import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { CorbeilleController } from '@infrastructure/http/controllers/CorbeilleController';
import { ParentController } from '@infrastructure/http/controllers/ParentController';
import { SchoolSettingsController } from '@infrastructure/http/controllers/SchoolSettingsController';
import { OnboardingPEBSController } from '@infrastructure/http/controllers/OnboardingPEBSController';
import { OnboardingTimetableController } from '@infrastructure/http/controllers/OnboardingTimetableController';
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaMatiereRepository } from '@infrastructure/persistence/prisma/PrismaMatiereRepository';
import { PrismaSchoolActivationRepository } from '@infrastructure/persistence/prisma/PrismaSchoolActivationRepository';
import { PrismaOnboardingTimetableRepository } from '@infrastructure/persistence/prisma/PrismaOnboardingTimetableRepository';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { ActiverEtablissementUseCase } from '@application/school/ActiverEtablissementUseCase';
import { ConfigurerEtablissementUseCase } from '@application/school/ConfigurerEtablissementUseCase';
import { ListerTemplatesCatalogUseCase } from '@application/school/ListerTemplatesCatalogUseCase';
import { creerCorbeilleRoutes } from '@infrastructure/http/routes/corbeille.routes';
import { creerOnboardingTimetableRoutes } from '@infrastructure/http/routes/onboardingTimetable.routes';
import { creerOnboardingPebsRoutes } from '@infrastructure/http/routes/onboardingPebs.routes';
import { creerParentRoutes } from '@infrastructure/http/routes/parent.routes';
import { creerSchoolSettingsRoutes } from '@infrastructure/http/routes/schoolSettings.routes';

type Container = ReturnType<typeof creerContainer>;

export function registerAuthOnboardingRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  // ── Couche 1 — Écran Corbeille ───────────────────────────────────────────
  const corbeilleController = new CorbeilleController(
    new PrismaUserRepository(p),
    new PrismaClasseRepository(p),
    new PrismaMatiereRepository(p),
    new AIActionAuditAdapter(p),
  );
  app.use('/api/v2/corbeille', creerCorbeilleRoutes(corbeilleController));

  const parentController = new ParentController(
    c.parent.obtenirEnfants,
    c.parent.verifierAcces,
    c.finance.initierPaiement,
    c.finance.factureRepository,
    c.parent.obtenirAlertesSolde,
  );

  const schoolSettingsController = new SchoolSettingsController(
    c.schoolSettings.obtenir,
    c.schoolSettings.mettreAJour,
    c.schoolSettings.proposerReapplication,
    c.schoolSettings.appliquerReapplication,
  );

  app.use('/api/v2/parent', creerParentRoutes(parentController));
  app.use('/api/v2/school-settings', creerSchoolSettingsRoutes(schoolSettingsController));

  // ── Activation de l'établissement (Admin, après configuration) ─────
  const schoolActivationRepository = new PrismaSchoolActivationRepository(p);
  const activerEtablissementUseCase = new ActiverEtablissementUseCase(schoolActivationRepository);

  // ── Catalogue templates + Onboarding conversationnel Phase 2 ───────
  const listerTemplatesCatalogUseCase = new ListerTemplatesCatalogUseCase();
  const configurerEtablissementUseCase = new ConfigurerEtablissementUseCase(
    schoolActivationRepository,
    activerEtablissementUseCase,
    c.eleveOnboarding.repository,
    c.eleveOnboarding.changerGestionAdmin,
  );
  const onboardingTimetableController = new OnboardingTimetableController(
    listerTemplatesCatalogUseCase,
    configurerEtablissementUseCase,
    new PrismaOnboardingTimetableRepository(p),
    c.events.publisher,
  );
  const onboardingPEBSController = new OnboardingPEBSController();

  app.use('/api/v2/onboarding', creerOnboardingTimetableRoutes(onboardingTimetableController));
  app.use('/api/v2/onboarding', creerOnboardingPebsRoutes(onboardingPEBSController));
}
