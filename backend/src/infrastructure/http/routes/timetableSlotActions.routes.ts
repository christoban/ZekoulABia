import { Router } from 'express';
import type { TimetableSlotActionsController } from '@infrastructure/http/controllers/TimetableSlotActionsController';
import { requireAuth, requirePermission, requireRole } from '../middlewares/auth.ts';

export function creerTimetableSlotActionsRoutes(controller: TimetableSlotActionsController): Router {
  const router = Router();

  router.post(
    '/generate-skeleton',
    requireAuth,
    requireRole('STAFF'),
    requirePermission('MANAGE_TIMETABLE'),
    controller.generateSkeleton,
  );
  router.get('/check-conflict', requireAuth, controller.checkConflict);
  router.patch('/slots/:slotId', requireAuth, requirePermission('MANAGE_TIMETABLE'), controller.updateSlot);

  return router;
}
