import { Router } from 'express';
import type { PlatformSettingsController } from '@infrastructure/http/controllers/PlatformSettingsController';
import { authorizeMaster, protectMaster } from '../middlewares/authMultiTenant';

export function creerPlatformSettingsRoutes(controller: PlatformSettingsController): Router {
  const router = Router();
  router.get('/', protectMaster, authorizeMaster(['super_admin', 'platform_admin']), controller.get);
  router.patch('/', protectMaster, authorizeMaster(['super_admin']), controller.update);
  router.get('/messages-supprimes', protectMaster, authorizeMaster(['super_admin']), controller.listerMessagesSupprimes);
  return router;
}

export function creerPublicPlatformSettingsRoutes(controller: PlatformSettingsController): Router {
  const router = Router();
  router.get('/', controller.getPublicStatus);
  return router;
}
