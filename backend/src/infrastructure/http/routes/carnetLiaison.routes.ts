import { Router } from 'express';
import type { CarnetLiaisonController } from '@infrastructure/http/controllers/CarnetLiaisonController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerCarnetLiaisonRoutes(controller: CarnetLiaisonController): Router {
  const router = Router();

  router.get('/templates', requireAuth, controller.templates);
  router.get('/parent/inbox', requireAuth, requireRole('PARENT'), controller.parentInbox);
  router.get('/students/:studentId', requireAuth, controller.listerParEleve);
  router.get('/classes/:classId', requireAuth, requireRole('ADMIN', 'STAFF', 'TEACHER'), controller.listerParClasse);

  router.post('/', requireAuth, requireRole('ADMIN', 'STAFF', 'TEACHER', 'PARENT'), controller.creer);
  router.post('/:id/lu', requireAuth, requireRole('ADMIN', 'STAFF', 'TEACHER', 'PARENT'), controller.marquerLu);
  router.post('/:id/repondre', requireAuth, requireRole('ADMIN', 'STAFF', 'TEACHER', 'PARENT'), controller.repondre);
  router.post('/:id/relancer', requireAuth, requireRole('ADMIN', 'STAFF', 'TEACHER'), controller.relancer);

  return router;
}

