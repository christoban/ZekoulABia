import { Router } from 'express';
import type { TeacherUnavailabilityController } from '@infrastructure/http/controllers/TeacherUnavailabilityController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerTeacherUnavailabilityRoutes(controller: TeacherUnavailabilityController): Router {
  const router = Router();

  router.get('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.listerIndisponibilites);
  router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerIndisponibilite);
  router.put('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), controller.modifierIndisponibilite);
  router.delete('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), controller.supprimerIndisponibilite);

  return router;
}