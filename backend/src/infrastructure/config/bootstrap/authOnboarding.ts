import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { CorbeilleController } from '@infrastructure/http/controllers/CorbeilleController';
import { ParentController } from '@infrastructure/http/controllers/ParentController';
import { SchoolSettingsController } from '@infrastructure/http/controllers/SchoolSettingsController';
import { OnboardingPEBSController } from '@infrastructure/http/controllers/OnboardingPEBSController';
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaMatiereRepository } from '@infrastructure/persistence/prisma/PrismaMatiereRepository';
import { PrismaSchoolActivationRepository } from '@infrastructure/persistence/prisma/PrismaSchoolActivationRepository';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { ActiverEtablissementUseCase } from '@application/school/ActiverEtablissementUseCase';
import { ConfigurerEtablissementUseCase } from '@application/school/ConfigurerEtablissementUseCase';
import { ListerTemplatesCatalogUseCase } from '@application/school/ListerTemplatesCatalogUseCase';
import { creerParentRoutes } from '@infrastructure/http/routes/parent.routes';
import { creerSchoolSettingsRoutes } from '@infrastructure/http/routes/schoolSettings.routes';
import { requireAuth, requireRole } from '../../http/middlewares/auth';

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
  app.get('/api/v2/corbeille', requireAuth, requireRole('ADMIN'), corbeilleController.lister);
  app.post('/api/v2/corbeille/:type/:id/restore', requireAuth, requireRole('ADMIN'), corbeilleController.restaurer);

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

  // ── Catalogue templates (public, lecture seule) ──
  const listerTemplatesCatalogUseCase = new ListerTemplatesCatalogUseCase();
  app.get('/api/v2/onboarding/template-catalog', async (_req, res) => {
    const result = listerTemplatesCatalogUseCase.execute();
    res.json({ success: true, data: result });
  });

  // ── Onboarding conversationnel Phase 2 : exécution déterministe ────
  const configurerEtablissementUseCase = new ConfigurerEtablissementUseCase(
    schoolActivationRepository,
    activerEtablissementUseCase,
    c.eleveOnboarding.repository,
    c.eleveOnboarding.changerGestionAdmin,
  );
  const onboardingPEBSController = new OnboardingPEBSController();
  app.post('/api/v2/onboarding/execute', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId; // schoolId forcé depuis la session (sécurité)
      const bodySchoolId = (req.body ?? {}).schoolId;
      // Garantie d'isolation multi-tenant : refuser explicitement si le body tente de cibler une autre école.
      if (bodySchoolId && bodySchoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const state = { ...(req.body ?? {}), schoolId, adminUserId: req.user!.userId };
      const result = await configurerEtablissementUseCase.execute(state);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('introuvable')) { res.status(404).json({ success: false, message: error.message }); return; }
        if (error.message.includes('Template inconnu')) { res.status(400).json({ success: false, message: error.message }); return; }
        if (error.message.includes('déjà') || error.message.includes('approuvé') || error.message.includes('requis')) {
          res.status(422).json({ success: false, message: error.message }); return;
        }
      }
      next(error);
    }
  });
  app.post('/api/v2/onboarding/analyze-pebs', requireAuth, requireRole('ADMIN'), onboardingPEBSController.analyze);
}
