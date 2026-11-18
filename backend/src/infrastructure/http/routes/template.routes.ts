import { Router } from 'express';
import type { TemplateController } from '@infrastructure/http/controllers/TemplateController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerTemplateRoutes(controller: TemplateController): Router {
  const router = Router();

  router.get('/import-eleves', requireAuth, requireRole('ADMIN'), controller.importEleves);
  router.get('/import-enseignants', requireAuth, requireRole('ADMIN'), controller.importEnseignants);
  router.get('/import-staff', requireAuth, requireRole('ADMIN'), controller.importStaff);
  router.get('/import-parents', requireAuth, requireRole('ADMIN'), controller.importParents);
  router.get('/import-classes', requireAuth, requireRole('ADMIN'), controller.importClasses);

  return router;
}
