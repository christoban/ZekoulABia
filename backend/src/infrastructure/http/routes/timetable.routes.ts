import { Router } from 'express';
import type { TimetableController } from '@infrastructure/http/controllers/TimetableController';
import { requireAuth, requirePermission, requireRole } from '../middlewares/auth.ts';

export function creerTimetableRoutes(controller: TimetableController): Router {
  const router = Router();

  router.post('/manual', requireAuth, requirePermission('MANAGE_TIMETABLE'), controller.creerManuel);
  router.post('/catchup-requests', requireAuth, requireRole('TEACHER'), controller.demanderCours);
  router.post('/:id/slots', requireAuth, requirePermission('MANAGE_TIMETABLE'), controller.ajouterSlot);
  router.put('/:id/slots/:slotId', requireAuth, requirePermission('MANAGE_TIMETABLE'), controller.modifierSlot);
  router.post('/:id/generate-group-sessions', requireAuth, requirePermission('MANAGE_TIMETABLE'), controller.genererSeancesGroupe);
  // Scheduling Engine V2.5 — le solveur propose, l'admin confirme, puis on écrit (tout ou rien).
  router.post('/:id/propose-schedule', requireAuth, requirePermission('MANAGE_TIMETABLE'), controller.proposerEDT);
  router.post('/:id/apply-schedule', requireAuth, requirePermission('MANAGE_TIMETABLE'), controller.appliquerPropositionEDT);
  // What-if (V2.5) — simule sans écrire.
  router.post('/:id/what-if', requireAuth, requirePermission('MANAGE_TIMETABLE'), controller.simulerEDT);
  router.put('/:id/publish', requireAuth, requirePermission('MANAGE_TIMETABLE'), controller.publierEDT);

  return router;
}
