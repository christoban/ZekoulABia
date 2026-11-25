import { Router } from 'express';
import type { StudentGroupController } from '@infrastructure/http/controllers/StudentGroupController';
import { requireAuth, requirePermission } from '../middlewares/auth.ts';

export function creerStudentGroupRoutes(controller: StudentGroupController): Router {
  const router = Router();

  router.post('/', requireAuth, requirePermission('MANAGE_CLASSES'), controller.creerStudentGroupSet);
  router.put('/:id', requireAuth, requirePermission('MANAGE_CLASSES'), controller.modifierStudentGroupSet);
  router.delete('/:id', requireAuth, requirePermission('MANAGE_CLASSES'), controller.supprimerStudentGroupSet);

  router.post('/:groupSetId/groups', requireAuth, requirePermission('MANAGE_CLASSES'), controller.creerStudentGroup);
  router.put('/groups/:id', requireAuth, requirePermission('MANAGE_CLASSES'), controller.modifierStudentGroup);
  router.delete('/groups/:id', requireAuth, requirePermission('MANAGE_CLASSES'), controller.supprimerStudentGroup);

  return router;
}
