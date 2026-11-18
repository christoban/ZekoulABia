import { Router } from 'express';
import type { TimetableAutoController } from '@infrastructure/http/controllers/TimetableAutoController';
import { requireAuth, requirePermission, requireRole } from '../middlewares/auth.ts';

export function creerTimetableAutoRoutes(controller: TimetableAutoController): Router {
  const router = Router();

  router.post('/:id/adjust', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.adjust);

  return router;
}
