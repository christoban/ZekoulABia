import { Router } from 'express';
import multer from 'multer';
import type { UserController } from '@infrastructure/http/controllers/UserController';
import { requireAuth, requireRole, requirePermission } from '../middlewares/auth.ts';
import { authLimiter, userEmailOtpLimiter, userMfaLimiter } from '../middlewares/rateLimit.ts';
import { requireUserSensitiveAuth } from '../middlewares/requireUserSensitiveAuth.ts';
import { requireReauthToken } from '../middlewares/requireReauthToken.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Utilisez .xlsx ou .xls'));
    }
  },
});

export function creerUserRoutes(controller: UserController): Router {
  const router = Router();

  // Auth — pas de middleware (routes publiques), rate-limitées
  router.post('/auth/login',             authLimiter,          controller.login);
  router.post('/auth/verify-login-otp',  userEmailOtpLimiter,  controller.verifyLoginOtp);
  router.post('/auth/resend-login-otp',  userEmailOtpLimiter,  controller.resendLoginOtp);
  router.post('/auth/verify-login-mfa',  userMfaLimiter,       controller.verifyLoginMfa);
  router.post('/auth/mfa/first-setup',   userMfaLimiter,       controller.firstMfaSetup);
  router.post('/auth/mfa/first-enable',  userMfaLimiter,       controller.firstMfaEnable);
  router.post('/auth/logout', controller.logout);
  router.post('/auth/refresh', controller.refresh);

  // MFA — gestion depuis le dashboard (authentifié)
  router.get('/mfa/status',              requireAuth,                                controller.mfaStatus);
  router.post('/mfa/reconfigure/start',  requireAuth, requireUserSensitiveAuth,       controller.mfaReconfigureStart);
  router.post('/mfa/reconfigure/confirm',requireAuth,                                controller.mfaReconfigureConfirm);
  router.post('/mfa/regen-codes',        requireAuth, requireUserSensitiveAuth,       controller.mfaRegenCodes);

  // Fenêtre de grâce de ré-authentification (Couche 1, PLAN_IMPLEMENTATION_BACKUP.md §1.5) —
  // ouvre un jeton court terme réutilisable par les actions destructives de gravité complète
  // (suppression d'utilisateur), quel que soit le chemin d'exécution (écran ou assistant IA).
  router.post('/auth/reauth', requireAuth, userMfaLimiter, controller.reauth);

  // Récupération de mot de passe — publique
  router.post('/auth/forgot-password', controller.forgotPassword);
  router.post('/auth/reset-password', controller.resetPassword);

  // Changement de mot de passe — authentifié
  router.post('/auth/change-password', requireAuth, controller.changePassword);

  // Invitation utilisateur — publique (pas de session)
  router.get('/auth/invite/validate', controller.validateInvite);
  router.post('/auth/invite/complete', controller.completeInvite);

  // Gestion utilisateurs
  // GET /api/v2/users/my-class — classe du professeur principal connecté
  router.get('/my-class', requireAuth, controller.myClass);
  router.post('/', requireAuth, requireRole('ADMIN'), controller.register);
  router.put('/:id', requireAuth, controller.update);
  // Ré-authentification complète obligatoire (§1.5) — suppression d'un compte élève/parent/
  // enseignant, jamais une simple confirmation classique (contrairement à classe/matière).
  router.delete('/:id', requireAuth, requireRole('ADMIN'), requireReauthToken, controller.delete);

  // Import Excel — Secrétaire (MANAGE_ENROLLMENT), Censeur (MANAGE_STUDENT_ASSIGNMENTS), ADMIN
  router.post(
    '/import',
    requireAuth,
    requirePermission('MANAGE_ENROLLMENT', 'MANAGE_STUDENT_ASSIGNMENTS'),
    upload.single('file'),
    controller.importUsers,
  );

  router.post(
    '/import/preview',
    requireAuth,
    requirePermission('MANAGE_ENROLLMENT', 'MANAGE_STUDENT_ASSIGNMENTS'),
    upload.single('file'),
    controller.previewImport,
  );
  router.post(
    '/import/validate',
    requireAuth,
    requirePermission('MANAGE_ENROLLMENT', 'MANAGE_STUDENT_ASSIGNMENTS'),
    controller.validateImport,
  );
  router.post(
    '/import/confirm',
    requireAuth,
    requirePermission('MANAGE_ENROLLMENT', 'MANAGE_STUDENT_ASSIGNMENTS'),
    controller.confirmImport,
  );

  // Transfert élève — Censeur / VP (MANAGE_STUDENT_ASSIGNMENTS) ou ADMIN — pas le Secrétaire en V1
  router.post(
    '/students/:id/transfer',
    requireAuth,
    requirePermission('MANAGE_STUDENT_ASSIGNMENTS'),
    controller.transfer,
  );

  // Désignation AP (Animateur Pédagogique / HOD)
  router.patch('/:id/ap-designation', requireAuth, requireRole('ADMIN'), controller.apDesignation);

  return router;
}
