import { Router } from 'express';
import type { SchoolAuditConfigController } from '@infrastructure/http/controllers/SchoolAuditConfigController';
import type { SchoolStructureSyncController } from '@infrastructure/http/controllers/SchoolStructureSyncController';
import { requireAuth, requireRole } from '../middlewares/auth';

export function creerSchoolAuditConfigRoutes(
  auditConfigController: SchoolAuditConfigController,
  structureSyncController: SchoolStructureSyncController,
): Router {
  const router = Router();

  router.get('/check-subdomain', requireAuth, requireRole('ADMIN'), auditConfigController.checkSubdomain);
  router.get('/:id/configuration/preview', requireAuth, auditConfigController.getConfigurationPreview);
  router.patch('/:id/subdomain', requireAuth, requireRole('ADMIN'), auditConfigController.updateSubdomain);

  router.post('/:id/sync-subjects', requireAuth, requireRole('ADMIN'), structureSyncController.syncSubjects);
  router.patch('/:id/structure', requireAuth, requireRole('ADMIN'), structureSyncController.updateStructure);

  router.get('/:id/notification-settings', requireAuth, requireRole('ADMIN'), auditConfigController.getNotificationSettings);
  router.patch('/:id/notification-settings', requireAuth, requireRole('ADMIN'), auditConfigController.updateNotificationSettings);

  router.get('/:id/security-settings', requireAuth, requireRole('ADMIN'), auditConfigController.getSecuritySettings);
  router.patch('/:id/security-settings', requireAuth, requireRole('ADMIN'), auditConfigController.updateSecuritySettings);

  router.get('/:id/audit-logs', requireAuth, requireRole('ADMIN'), auditConfigController.getAuditLogs);

  return router;
}
