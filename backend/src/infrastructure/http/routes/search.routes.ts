import { Router } from 'express';
import type { SearchController } from '@infrastructure/http/controllers/SearchController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerSearchRoutes(controller: SearchController): Router {
  const router = Router();
  router.get('/global', requireAuth, requireRole('ADMIN'), controller.globalSearch);
  return router;
}
