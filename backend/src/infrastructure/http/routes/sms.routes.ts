import { Router } from 'express';
import type { SMSController } from '@infrastructure/http/controllers/SMSController';

export function creerSMSRoutes(controller: SMSController): Router {
  const router = Router();
  router.get('/incoming', controller.incoming);
  return router;
}
