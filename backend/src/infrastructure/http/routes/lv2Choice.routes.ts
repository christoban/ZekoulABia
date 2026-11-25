import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { Lv2ChoiceController } from '../controllers/Lv2ChoiceController';

export function creerLv2ChoiceRoutes(controller: Lv2ChoiceController): Router {
  const router = Router();

  // Admin routes
  router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerFenetre);
  router.get('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.lister);
  router.get('/:id/tracking', requireAuth, requireRole('ADMIN', 'STAFF'), controller.suivi);
  router.post('/:id/manual-submission', requireAuth, requireRole('ADMIN', 'STAFF'), controller.saisieManuelle);
  router.post('/:id/apply', requireAuth, requireRole('ADMIN'), controller.appliquer);

  return router;
}

// Routes séparées pour les élèves (préfixe /students/me)
export function creerLv2ChoiceStudentRoutes(controller: Lv2ChoiceController): Router {
  const router = Router();

  router.get('/lv2-choice-window', requireAuth, requireRole('STUDENT'), controller.fenetreEleve);
  router.post('/lv2-choice', requireAuth, requireRole('STUDENT'), controller.soumettreEleve);

  return router;
}
