import { Router } from 'express';
import type { AttendanceController } from '@infrastructure/http/controllers/AttendanceController';
import { requireAuth } from '../middlewares/auth.ts';

export function creerAttendanceRoutes(controller: AttendanceController): Router {
  const router = Router();

  router.get('/', requireAuth, controller.lister);
  router.get('/stats', requireAuth, controller.statistiques);
  router.get('/daily-status', requireAuth, controller.statutJourClasses);
  router.get('/repeated-absences', requireAuth, controller.absencesRepetees);
  router.post('/', requireAuth, controller.enregistrer);
  router.patch('/:id/justify', requireAuth, controller.justifierAbsence);
  router.patch('/:id/correct', requireAuth, controller.corrigerStatut);
  router.post('/:id/parent-justify', requireAuth, controller.soumettreJustificationParent);

  return router;
}
