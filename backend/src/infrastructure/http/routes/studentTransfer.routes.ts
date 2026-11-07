import { Router } from 'express';
import type { StudentTransferController } from '../controllers/StudentTransferController';
import { authLimiter, sensitiveWriteLimiter } from '../middlewares/rateLimit';
import { requireAuth, requirePermission } from '../middlewares/auth';

export function creerStudentTransferRoutes(controller: StudentTransferController): Router {
  const router = Router();

  router.post('/detect', requireAuth, requirePermission('TRANSFER_REQUEST'), sensitiveWriteLimiter, controller.detect);
  router.post('/requests', requireAuth, requirePermission('TRANSFER_REQUEST'), sensitiveWriteLimiter, controller.create);
  router.get('/requests', requireAuth, requirePermission('TRANSFER_REQUEST'), controller.listSent);
  router.get('/source/requests', requireAuth, requirePermission('TRANSFER_APPROVE'), controller.listReceived);
  router.post('/requests/:requestId/consent', authLimiter, controller.consent);
  router.post('/requests/:requestId/decide', requireAuth, requirePermission('TRANSFER_APPROVE'), sensitiveWriteLimiter, controller.decide);
  router.post('/requests/:requestId/revoke', authLimiter, controller.revoke);
  router.post('/requests/:requestId/cancel', requireAuth, requirePermission('TRANSFER_REQUEST'), sensitiveWriteLimiter, controller.cancel);
  router.post('/requests/:requestId/link-target', requireAuth, requirePermission('TRANSFER_REQUEST'), sensitiveWriteLimiter, controller.linkTarget);
  router.get('/requests/:requestId/snapshots/:snapshotId', requireAuth, requirePermission('TRANSFER_DOSSIER_VIEW'), controller.read);

  // Phase 1C : tuteur principal et vérification de son téléphone par OTP (mode assisté au guichet inclus).
  router.post('/students/:studentProfileId/guardian', requireAuth, requirePermission('TRANSFER_REQUEST'), sensitiveWriteLimiter, controller.configureGuardian);
  router.post('/students/:studentProfileId/guardian/phone-otp', requireAuth, requirePermission('TRANSFER_REQUEST'), sensitiveWriteLimiter, controller.sendGuardianPhoneOtp);
  router.post('/students/:studentProfileId/guardian/phone-verify', requireAuth, requirePermission('TRANSFER_REQUEST'), sensitiveWriteLimiter, controller.verifyGuardianPhoneOtp);

  return router;
}
