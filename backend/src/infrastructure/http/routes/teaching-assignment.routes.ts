import { Router } from 'express';
import type { TeachingAssignmentController } from '../controllers/TeachingAssignmentController';
import { requireAuth, requirePermission, requireRole } from '../middlewares/auth.ts';

export function creerTeachingAssignmentRoutes(controller: TeachingAssignmentController): Router {
  const router = Router();

  // Lecture : authentifié (inchangé)
  router.get('/', requireAuth, controller.getByClass);

  // Affectation enseignant ↔ classe/matière — Censeur ou ADMIN
  // (avant : tout STAFF sans perm précise → trop large)
  router.post('/', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TEACHING_ASSIGNMENTS'), controller.assign);

  router.get('/issues', requireAuth, requirePermission('MANAGE_TEACHING_ASSIGNMENTS'), controller.getIssues);
  router.post('/clear-class', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TEACHING_ASSIGNMENTS'), controller.clearClass);
  router.post('/clear-all', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TEACHING_ASSIGNMENTS'), controller.clearAll);

  // Génération automatique des affectations (algorithme glouton)
  router.post('/generate', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TEACHING_ASSIGNMENTS'), controller.genererAffectations);

  return router;
}
