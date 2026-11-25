import { Router } from 'express';
import type { CommunicationsController } from '@infrastructure/http/controllers/CommunicationsController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerCommunicationsRoutes(controller: CommunicationsController): Router {
  const router = Router();

  router.get(
    '/broadcasts/preview',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    controller.preview,
  );

  router.post(
    '/broadcast',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    controller.broadcast,
  );

  router.get(
    '/broadcasts',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    controller.history,
  );

  return router;
}
