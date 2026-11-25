import { Router } from 'express';
import type { AttendanceController } from '@infrastructure/http/controllers/AttendanceController';
import type { SequenceAbsenceController } from '@infrastructure/http/controllers/SequenceAbsenceController';
import { requireAuth, requirePermission } from '../middlewares/auth.ts';

export function creerAttendanceRoutes(
  controller: AttendanceController,
  sequenceAbsenceController?: SequenceAbsenceController,
): Router {
  const router = Router();

  router.get('/', requireAuth, controller.lister);
  router.get('/stats', requireAuth, controller.statistiques);
  router.get('/daily-status', requireAuth, controller.statutJourClasses);
  router.get('/repeated-absences', requireAuth, controller.absencesRepetees);
  if (sequenceAbsenceController) {
    router.get('/sequence-hours', requireAuth, requirePermission('MANAGE_ATTENDANCE'), sequenceAbsenceController.listSequenceHours);
    router.post('/sequence-hours', requireAuth, requirePermission('MANAGE_ATTENDANCE'), sequenceAbsenceController.upsertSequenceHours);
  }
  router.post('/', requireAuth, controller.enregistrer);
  router.patch('/:id/justify', requireAuth, controller.justifierAbsence);
  router.patch('/:id/correct', requireAuth, controller.corrigerStatut);
  router.post('/:id/parent-justify', requireAuth, controller.soumettreJustificationParent);

  return router;
}
