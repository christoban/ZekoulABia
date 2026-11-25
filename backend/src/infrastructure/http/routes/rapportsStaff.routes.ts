import { Router } from 'express';
import type { RapportsStaffController } from '@infrastructure/http/controllers/RapportsStaffController';
import { requireAuth } from '../middlewares/auth.ts';

export function creerRapportsStaffRoutes(controller: RapportsStaffController): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/global', controller.getRapportGlobal);
  router.get('/effectifs', controller.getEffectifs);
  router.get('/dossiers-incomplets', controller.getDossiersIncomplets);
  router.get('/concours', controller.getStatistiquesConcours);
  router.get('/export-excel', controller.exporterExcel);

  return router;
}
