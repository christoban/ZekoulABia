import { Router } from 'express';
import type { TimetableController } from '@infrastructure/http/controllers/TimetableController';
import { requireAuth, requirePermission, requireRole } from '../middlewares/auth.ts';

export function creerTimetableRoutes(controller: TimetableController): Router {
  const router = Router();

  router.post('/manual', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.creerManuel);
  router.post('/catchup-requests', requireAuth, requireRole('TEACHER'), controller.demanderCours);
  router.post('/:id/slots', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.ajouterSlot);
  router.put('/:id/slots/:slotId', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.modifierSlot);
  router.delete('/slots/:slotId', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.supprimerSlot);
  router.delete('/:id/slots', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.viderCreneauxEDT);
  router.post('/:id/generate-group-sessions', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.genererSeancesGroupe);
  // Scheduling Engine V2.5 — le solveur propose, le staff applique après validation.
  router.post('/:id/propose-schedule', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.proposerEDT);
  router.post('/:id/apply-schedule', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.appliquerPropositionEDT);
  // What-if (V2.5) — simule sans écrire.
  router.post('/:id/what-if', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.simulerEDT);
  router.post('/:id/submit', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), controller.soumettreEDT);
  router.put('/publish-all', requireAuth, requireRole('ADMIN'), controller.publierTousEDT);
  router.put('/:id/publish', requireAuth, requireRole('ADMIN'), controller.publierEDT);
  router.put('/:id/reopen', requireAuth, requireRole('ADMIN'), controller.rouvrirEDT);

  return router;
}
