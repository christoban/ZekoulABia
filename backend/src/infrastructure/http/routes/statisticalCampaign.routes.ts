import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { StatisticalCampaignController } from '../controllers/StatisticalCampaignController';

export function creerStatisticalCampaignRoutes(controller: StatisticalCampaignController): Router {
  const router = Router();

  router.get('/supplement', requireAuth, requireRole('ADMIN', 'STAFF'), controller.getSupplement);
  router.put('/supplement', requireAuth, requireRole('ADMIN'), controller.updateSupplement);
  router.get('/completude', requireAuth, requireRole('ADMIN', 'STAFF'), controller.getCompletude);
  router.get('/specialites-techniques', requireAuth, requireRole('ADMIN', 'STAFF'), controller.getSpecialitesTechniques);
  router.get('/meta', requireAuth, requireRole('ADMIN', 'STAFF'), controller.getMeta);
  router.post('/generer', requireAuth, requireRole('ADMIN'), controller.genererDeclaration);
  router.get('/submissions', requireAuth, requireRole('ADMIN', 'STAFF'), controller.listSubmissions);
  router.get('/submissions/:id/download', requireAuth, requireRole('ADMIN', 'STAFF'), controller.downloadSubmission);

  return router;
}
