import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { ExamenController } from '../controllers/ExamenController';

export function creerExamenRoutes(controller: ExamenController): Router {
  const router = Router();

  router.post('/register', requireAuth, requireRole('ADMIN', 'STAFF'), controller.register);
  router.get('/:studentId', requireAuth, requireRole('ADMIN', 'STAFF', 'PARENT'), controller.listByStudent);
  router.patch('/:id/set-candidate-number', requireAuth, requireRole('ADMIN'), controller.setCandidateNumber);
  router.patch('/:id/result', requireAuth, requireRole('ADMIN'), controller.setResult);

  return router;
}
