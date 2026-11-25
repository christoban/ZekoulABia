import { Router } from 'express';
import type { PlatformSettingsController } from '@infrastructure/http/controllers/PlatformSettingsController';
import { authorizeMaster, protectMaster } from '../middlewares/authMultiTenant';

const MODE_TEST_ROLES = ['super_admin', 'platform_admin', 'school_manager'] as const;

export function creerPlatformSettingsRoutes(controller: PlatformSettingsController): Router {
  const router = Router();
  router.get('/', protectMaster, authorizeMaster([...MODE_TEST_ROLES]), controller.get);
  router.patch('/', protectMaster, authorizeMaster([...MODE_TEST_ROLES]), controller.update);
  router.get('/messages-supprimes', protectMaster, authorizeMaster([...MODE_TEST_ROLES]), controller.listerMessagesSupprimes);
  return router;
}

export function creerPublicPlatformSettingsRoutes(controller: PlatformSettingsController): Router {
  const router = Router();
  router.get('/', controller.getPublicStatus);
  return router;
}
