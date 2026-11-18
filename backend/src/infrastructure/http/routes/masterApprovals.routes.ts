import { Router } from 'express';
import type { SchoolOnboardingController } from '@infrastructure/http/controllers/SchoolOnboardingController';
import { protectMaster, authorizeMaster } from '../middlewares/authMultiTenant.ts';
import { requireMasterSensitiveAuth } from '../middlewares/masterSensitiveAuth.ts';

/**
 * /api/master/ (v1) ne passe PAS par le router /api/v2/master, donc protectMaster est requis ici.
 */
export function creerMasterApprovalsV1Routes(controller: SchoolOnboardingController): Router {
  const router = Router();

  router.post(
    '/schools/:id/approve',
    protectMaster,
    authorizeMaster(['super_admin']),
    requireMasterSensitiveAuth,
    controller.approuverEcole,
  );

  return router;
}

/**
 * /api/v2/master/ passe déjà par router.use(protectMaster) dans creerMasterAdminHexRoutes
 * — ne pas répéter protectMaster ici pour éviter la double requête MasterUser.
 */
export function creerMasterApprovalsV2Routes(controller: SchoolOnboardingController): Router {
  const router = Router();

  router.post(
    '/schools/:id/approve',
    authorizeMaster(['super_admin', 'platform_admin', 'school_manager']),
    requireMasterSensitiveAuth,
    controller.approuverEcole,
  );

  return router;
}
