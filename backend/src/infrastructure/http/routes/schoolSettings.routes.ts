import { Router } from 'express';
import type { SchoolSettingsController } from '@infrastructure/http/controllers/SchoolSettingsController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerSchoolSettingsRoutes(controller: SchoolSettingsController): Router {
  const router = Router();
  router.get('/', requireAuth, controller.getSettings);
  router.put('/', requireAuth, requireRole('ADMIN'), controller.updateSettings);
  router.post('/reapply-template/propose', requireAuth, requireRole('ADMIN'), controller.proposeReapply);
  router.post('/reapply-template/apply', requireAuth, requireRole('ADMIN'), controller.applyReapply);
  return router;
}
