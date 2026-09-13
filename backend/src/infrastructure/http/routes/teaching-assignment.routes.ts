import { Router } from 'express';
import type { TeachingAssignmentController } from '../controllers/TeachingAssignmentController';
import { requireAuth, requirePermission } from '../middlewares/auth.ts';

export function creerTeachingAssignmentRoutes(controller: TeachingAssignmentController): Router {
  const router = Router();

  // Lecture : authentifié (inchangé)
  router.get('/', requireAuth, controller.getByClass);

  // Affectation enseignant ↔ classe/matière — Censeur ou ADMIN
  // (avant : tout STAFF sans perm précise → trop large)
  router.post('/', requireAuth, requirePermission('MANAGE_TEACHING_ASSIGNMENTS'), controller.assign);

  return router;
}
