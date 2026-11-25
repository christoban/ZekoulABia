import { Router } from 'express';
import type { DashboardController } from '@infrastructure/http/controllers/DashboardController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerDashboardRoutes(controller: DashboardController): Router {
  const router = Router();
  router.get('/stats', requireAuth, controller.getStats);
  router.get('/admin-badges', requireAuth, requireRole('ADMIN'), controller.getAdminBadges);
  return router;
}
