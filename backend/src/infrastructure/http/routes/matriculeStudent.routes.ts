import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { MatriculeController } from '../controllers/MatriculeController';

/**
 * Route complémentaire de mise à jour du matricule sous `/api/v2/students/:id/matricule`.
 */
export function creerMatriculeStudentRoutes(controller: MatriculeController): Router {
  const router = Router();
  router.patch('/:id/matricule', requireAuth, requireRole('ADMIN', 'STAFF'), controller.updateMatricule);
  return router;
}

