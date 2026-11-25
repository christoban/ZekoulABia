import { Router } from 'express';
import type { SchoolOnboardingController } from '@infrastructure/http/controllers/SchoolOnboardingController';

export function creerOnboardingRoutes(controller: SchoolOnboardingController): Router {
  const router = Router();
  router.post('/register', controller.inscrire);
  return router;
}
