import { Router } from 'express';
import type { TimetableGridConfigController } from '../controllers/TimetableGridConfigController';
import { requireAuth, requirePermission } from '../middlewares/auth.ts';

export function creerTimetableGridConfigRoutes(controller: TimetableGridConfigController): Router {
  const router = Router();

  router.get('/', requireAuth, controller.get);
  router.post('/', requireAuth, requirePermission('MANAGE_TIMETABLE'), controller.save);

  return router;
}
