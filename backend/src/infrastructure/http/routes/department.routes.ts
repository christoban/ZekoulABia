import { Router } from 'express';
import type { DepartmentController } from '@infrastructure/http/controllers/DepartmentController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerDepartmentRoutes(controller: DepartmentController): Router {
  const router = Router();

  router.get('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.list);
  router.get('/:id/performance', requireAuth, controller.performance);
  router.post('/', requireAuth, requireRole('ADMIN'), controller.create);
  router.patch('/:id', requireAuth, requireRole('ADMIN'), controller.update);
  router.delete('/:id', requireAuth, requireRole('ADMIN'), controller.delete);

  return router;
}
