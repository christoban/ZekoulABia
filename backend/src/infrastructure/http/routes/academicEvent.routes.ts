import { Router } from 'express';
import type { AcademicEventController } from '@infrastructure/http/controllers/AcademicEventController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerAcademicEventRoutes(controller: AcademicEventController): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/active', controller.actifs);
  router.get('/', requireRole('ADMIN'), controller.lister);
  router.post('/', requireRole('ADMIN'), controller.creer);
  router.post('/:id/trigger', requireRole('ADMIN'), controller.declencher);
  router.patch('/:id/window', requireRole('ADMIN'), controller.ajusterCloture);
  router.post('/:id/close', requireRole('ADMIN'), controller.cloturer);
  return router;
}
