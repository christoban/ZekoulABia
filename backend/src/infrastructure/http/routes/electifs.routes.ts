import { Router } from 'express';
import type { ElectifsLv2PebsController } from '@infrastructure/http/controllers/ElectifsLv2PebsController';
import type { ElectifsALevelRosterController } from '@infrastructure/http/controllers/ElectifsALevelRosterController';
import { requireAuth, requireRole } from '../middlewares/auth';

export function creerElectifsRoutes(
  lv2PebsController: ElectifsLv2PebsController,
  aLevelRosterController: ElectifsALevelRosterController,
): Router {
  const router = Router();

  // Module LV2 — gestion langue vivante 2 par élève
  router.patch('/students/:id/lv2', requireAuth, requireRole('ADMIN', 'STAFF'), lv2PebsController.affecterLV2);
  router.post('/students/lv2/bulk', requireAuth, requireRole('ADMIN', 'STAFF'), lv2PebsController.affecterLV2EnMasse);
  router.get('/classes/:id/lv2-overview', requireAuth, lv2PebsController.getLv2Overview);

  // Module PEBS — gestion Programme d'Éducation Bilingue Spécial par élève
  router.patch('/students/:id/pebs', requireAuth, requireRole('ADMIN', 'STAFF'), lv2PebsController.affecterPEBS);
  router.post('/students/pebs/bulk', requireAuth, requireRole('ADMIN', 'STAFF'), lv2PebsController.affecterPEBSEnMasse);
  router.get('/classes/:id/pebs-overview', requireAuth, lv2PebsController.getPebsOverview);

  // Participants résolus d'un créneau d'emploi du temps
  router.get('/timetable-slots/:id/students', requireAuth, aLevelRosterController.getTimetableSlotStudents);

  // Module A-Level — choix individuel des matières par élève (3 à 5)
  router.put('/students/:id/alevel-subjects', requireAuth, requireRole('ADMIN', 'STAFF'), aLevelRosterController.remplacerALevelSubjects);
  router.post('/students/:id/alevel-subjects/from-combination', requireAuth, requireRole('ADMIN', 'STAFF'), aLevelRosterController.preremplirALevelDepuisCombinaison);
  router.get('/students/:id/alevel-subjects', requireAuth, aLevelRosterController.getStudentALevelSubjects);
  router.get('/classes/:id/alevel-overview', requireAuth, aLevelRosterController.getClassALevelOverview);
  router.get('/subjects/:id/alevel-students', requireAuth, aLevelRosterController.getALevelStudentsBySubject);
  router.post('/classes/:id/alevel-subjects/bulk-from-combination', requireAuth, requireRole('ADMIN', 'STAFF'), aLevelRosterController.bulkALevelFromCombination);

  // Roster enseignant pour la saisie présences/notes (filtré si matière élective LV2 / A-Level)
  router.get('/teacher/roster', requireAuth, aLevelRosterController.getTeacherRoster);

  return router;
}
