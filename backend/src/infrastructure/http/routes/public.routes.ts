import { Router } from 'express';
import type { PublicController } from '@infrastructure/http/controllers/PublicController';

export function creerPublicRoutes(controller: PublicController): Router {
  const router = Router();
  router.get('/schools', controller.listSchools);
  router.post('/contact-request', controller.contactRequest);
  router.post('/demo-request', controller.demoRequest);
  return router;
}
