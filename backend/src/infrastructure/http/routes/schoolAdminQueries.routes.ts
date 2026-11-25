import { Router } from 'express';
import type { SchoolAdminQueriesController } from '@infrastructure/http/controllers/SchoolAdminQueriesController';
import { requireAuth, requireRole } from '../middlewares/auth';

export function creerSchoolAdminQueriesRoutes(controller: SchoolAdminQueriesController): Router {
  const router = Router();

  router.get('/me', requireAuth, controller.getMe);
  router.get('/anomalies', requireAuth, requireRole('ADMIN'), controller.getAnomalies);
  router.get('/last-backup', requireAuth, controller.getLastBackup);
  router.get('/export', requireAuth, requireRole('ADMIN'), controller.exportData);
  router.get('/staff-titles', requireAuth, controller.getStaffTitles);
  router.patch('/logo', requireAuth, requireRole('ADMIN'), controller.updateLogo);
  router.patch('/profile', requireAuth, requireRole('ADMIN'), controller.updateProfile);

  return router;
}
