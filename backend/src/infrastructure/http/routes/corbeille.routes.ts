import { Router } from 'express';
import type { CorbeilleController } from '@infrastructure/http/controllers/CorbeilleController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerCorbeilleRoutes(controller: CorbeilleController): Router {
  const router = Router();

  router.get('/', requireAuth, requireRole('ADMIN'), controller.lister);
  router.post('/:type/:id/restore', requireAuth, requireRole('ADMIN'), controller.restaurer);

  return router;
}
