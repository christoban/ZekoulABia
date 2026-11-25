import { Router } from 'express';
import type { StudentFollowUpController } from '@infrastructure/http/controllers/StudentFollowUpController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

// Outil interne au personnel de suivi d'un élève signalé — jamais exposé aux parents/élèves
// (PLAN_VERIFICATION_ET_ACTIONS_SUIVI.md, B.7 : même garde-fou de confidentialité que les
// alertes elles-mêmes). ADMIN volontairement absent — cohérent avec le reste du système
// (routage A.4), l'Admin n'intervient jamais sur un cas individuel.
export function creerStudentFollowUpRoutes(controller: StudentFollowUpController): Router {
  const router = Router();
  router.use(requireAuth, requireRole('STAFF', 'TEACHER'));
  router.post('/', controller.creer);
  router.get('/mine', controller.mesActionsEnCours);
  router.get('/conseillers', controller.conseillersDisponibles);
  router.get('/student/:studentId', controller.historiqueEleve);
  router.patch('/:actionId/close', controller.clore);
  router.patch('/:actionId/reassign', controller.reassigner);
  return router;
}
