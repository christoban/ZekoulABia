import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { StatisticalCampaignMinedubController } from '../controllers/StatisticalCampaignMinedubController';

export function creerStatisticalCampaignMinedubRoutes(controller: StatisticalCampaignMinedubController): Router {
  const router = Router();

  router.get('/supplement', requireAuth, requireRole('ADMIN', 'STAFF'), controller.getSupplement);
  router.put('/supplement', requireAuth, requireRole('ADMIN'), controller.updateSupplement);
  router.post('/generer', requireAuth, requireRole('ADMIN'), controller.genererRapport);
  router.get('/reports', requireAuth, requireRole('ADMIN', 'STAFF'), controller.listReports);
  router.get('/reports/:id/download', requireAuth, requireRole('ADMIN', 'STAFF'), controller.downloadReport);

  return router;
}
