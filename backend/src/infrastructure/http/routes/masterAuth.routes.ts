import { Router } from 'express';
import type { MasterAuthController } from '../controllers/MasterAuthController';
import { protectMaster } from '../middlewares/authMultiTenant.ts';
import { restrictMasterLoginByIp } from '../middlewares/masterAuthSecurity.ts';
import { masterAuthLimiter, masterEmailOtpLimiter, masterMfaLimiter } from '../middlewares/rateLimit.ts';
import { requireMasterSensitiveAuth } from '../middlewares/masterSensitiveAuth.ts';

export function creerMasterAuthRoutes(controller: MasterAuthController): Router {
  const router = Router();

  router.post('/login',      masterAuthLimiter,      restrictMasterLoginByIp, controller.login);
  router.post('/verify-otp', masterEmailOtpLimiter,                              controller.verifyOtp);
  router.post('/verify-mfa', masterMfaLimiter,                                   controller.verifyMfa);
  router.post('/resend-otp', masterEmailOtpLimiter,                              controller.resendOtp);
  // Récupération de mot de passe oublié — OTP email, sans authentification préalable
  router.post('/forgot-password',         masterEmailOtpLimiter, controller.forgotPassword);
  router.post('/forgot-password/confirm', masterEmailOtpLimiter, controller.forgotPasswordConfirm);
  // Changement de mot de passe — 2 étapes : vérification identité → OTP email → nouveau mdp
  router.post('/password-change/initiate', protectMaster, requireMasterSensitiveAuth, controller.initiatePasswordChange);
  router.post('/change-password',          protectMaster,                             controller.changePassword);
  router.get('/me',                  protectMaster,                              controller.me);
  router.get('/mfa-status',          protectMaster,                              controller.mfaStatus);
  // MFA management
  router.post('/mfa/setup',          protectMaster,                              controller.mfaSetup);
  router.post('/mfa/enable',         protectMaster, requireMasterSensitiveAuth,  controller.mfaEnable);
  router.post('/mfa/disable',        protectMaster, requireMasterSensitiveAuth,  controller.mfaDisable);
  router.post('/mfa/regen-codes',    protectMaster, requireMasterSensitiveAuth,  controller.mfaRegenCodes);
  router.post('/logout',     protectMaster,                                       controller.logout);

  return router;
}
