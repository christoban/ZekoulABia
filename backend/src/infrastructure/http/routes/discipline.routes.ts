import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { DisciplineController } from '@infrastructure/http/controllers/DisciplineController';

export function creerDisciplineRoutes(controller: DisciplineController): Router {
  const router = Router();
  const gestionnaires = ['ADMIN', 'STAFF'] as const;

  router.get('/', requireAuth, requireRole(...gestionnaires), controller.lister);
  router.post('/', requireAuth, requireRole(...gestionnaires), controller.creer);
  router.patch('/:id/lift', requireAuth, requireRole(...gestionnaires), controller.lever);

  return router;
}