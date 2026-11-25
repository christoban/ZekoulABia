import { Router } from 'express';
import type { AcademicProfileController } from '@infrastructure/http/controllers/AcademicProfileController';
import { requireAuth } from '../middlewares/auth';

export function creerAcademicProfileRoutes(controller: AcademicProfileController): Router {
  const router = Router();
  router.get('/students/:studentId/academic-profile', requireAuth, controller.obtenirProfilAcademique);
  return router;
}
