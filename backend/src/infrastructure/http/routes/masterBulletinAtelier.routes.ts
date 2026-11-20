import { Router } from 'express';
import type { MasterBulletinAtelierController } from '@infrastructure/http/controllers/MasterBulletinAtelierController';
import { protectMaster, authorizeMaster } from '../middlewares/authMultiTenant.ts';
import { heavyPdfExportLimiter } from '../middlewares/rateLimit.ts';

const ALL_MASTER_ROLES = ['super_admin', 'platform_admin', 'school_manager', 'support'] as const;
const SCHOOL_OPS_ROLES = ['super_admin', 'platform_admin', 'school_manager'] as const;

export function creerMasterBulletinAtelierRoutes(controller: MasterBulletinAtelierController): Router {
  const router = Router();

  router.use(protectMaster);
  router.use(authorizeMaster([...ALL_MASTER_ROLES]));

  router.get('/schools/:schoolId', controller.getAtelierState);
  router.post('/schools/:schoolId/preview-pdf', heavyPdfExportLimiter, controller.previewPdf);

  router.put('/schools/:schoolId/identity-kit', authorizeMaster([...SCHOOL_OPS_ROLES]), controller.saveIdentityKitAndConfig);
  router.post('/schools/:schoolId/identity-kit/assets/:assetType', authorizeMaster([...SCHOOL_OPS_ROLES]), controller.uploadIdentityAsset);
  router.post('/schools/:schoolId/specs/version', authorizeMaster([...SCHOOL_OPS_ROLES]), controller.createSpecVersion);
  router.post('/schools/:schoolId/assignments', authorizeMaster([...SCHOOL_OPS_ROLES]), controller.saveAssignment);
  router.delete('/schools/:schoolId/assignments/:assignmentId', authorizeMaster([...SCHOOL_OPS_ROLES]), controller.deleteAssignment);

  return router;
}

