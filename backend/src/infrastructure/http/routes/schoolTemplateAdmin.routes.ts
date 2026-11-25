import { Router } from 'express';
import type { SchoolTemplateAdminController } from '@infrastructure/http/controllers/SchoolTemplateAdminController';
import { requireMasterSensitiveAuth } from '../middlewares/masterSensitiveAuth.ts';

export function creerSchoolTemplateAdminRoutes(controller: SchoolTemplateAdminController): Router {
  const router = Router();

  router.get('/school-templates/:code/versions', controller.listerVersions);
  router.post('/school-templates/:code/versions', requireMasterSensitiveAuth, controller.publierVersion);
  router.post('/school-templates/:code/reapply/propose', requireMasterSensitiveAuth, controller.proposerReapplyToutes);
  router.post('/school-templates/:code/reapply/apply', requireMasterSensitiveAuth, controller.appliquerReapplyToutes);

  return router;
}
