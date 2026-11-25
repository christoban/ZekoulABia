import { Router } from 'express';
import type { GroupAuthController } from '../controllers/GroupAuthController';
import { protectGroupOwner } from '../middlewares/authMultiTenant.ts';
import { groupAuthLimiter, groupEmailOtpLimiter, groupMfaLimiter } from '../middlewares/rateLimit.ts';

export function creerGroupAuthRoutes(controller: GroupAuthController): Router {
  const router = Router();

  router.post('/login',      groupAuthLimiter,      controller.login);
  router.post('/verify-otp', groupEmailOtpLimiter,   controller.verifyOtp);
  router.post('/verify-mfa', groupMfaLimiter,        controller.verifyMfa);
  router.post('/resend-otp', groupEmailOtpLimiter,   controller.resendOtp);
  router.get('/me',                  protectGroupOwner, controller.me);
  router.get('/mfa-status',          protectGroupOwner, controller.mfaStatus);
  router.post('/mfa/setup',          protectGroupOwner, controller.mfaSetup);
  router.post('/mfa/enable',         protectGroupOwner, controller.mfaEnable);
  router.post('/mfa/disable',        protectGroupOwner, controller.mfaDisable);
  router.post('/mfa/regen-codes',    protectGroupOwner, controller.mfaRegenCodes);
  router.post('/logout',             protectGroupOwner, controller.logout);

  return router;
}
