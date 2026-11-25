import { Router } from 'express';
import type { ActivitiesLogController } from '@infrastructure/http/controllers/ActivitiesLogController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerActivitiesRoutes(controller: ActivitiesLogController): Router {
  const router = Router();
  router.get('/timeline', requireAuth, requireRole('ADMIN'), controller.getTimeline);
  router.get('/', requireAuth, requireRole('ADMIN', 'TEACHER'), controller.getAll);
  return router;
}
