import { Router } from 'express';
import type { MasterReferentielsController } from '../controllers/MasterReferentielsController.ts';
import { protectMaster, authorizeMaster } from '../middlewares/authMultiTenant.ts';

export function creerMasterReferentielsRoutes(controller: MasterReferentielsController): Router {
  const router = Router();

  router.use(protectMaster);
  router.use(authorizeMaster(['super_admin', 'platform_admin']));

  // 1. Synthèse globale & Alerte Proactive
  router.get('/summary', controller.getSummary);

  // 2. Calendrier Scolaire Officiel
  router.get('/calendar',             controller.getCalendars);
  router.post('/calendar',            controller.saveCalendar);
  router.patch('/calendar/:id/toggle', controller.toggleCalendarActive);

  // 3. Coefficients Bac
  router.get('/bac-coefficients',     controller.getBacCoefficients);
  router.post('/bac-coefficients',    controller.saveBacCoefficient);
  router.delete('/bac-coefficients/:id', controller.deleteBacCoefficient);

  // 4. Matières & Volumes Horaires par Template
  router.get('/template-subjects',     controller.getTemplateSubjects);
  router.post('/template-subjects',    controller.saveTemplateSubject);
  router.delete('/template-subjects/:id', controller.deleteTemplateSubject);

  // 5. Programmes Officiels & Progressions Types
  router.get('/progressions',         controller.getProgressions);
  router.post('/progressions',        controller.saveProgression);
  router.delete('/progressions/:id',   controller.deleteProgression);

  // 6. Tarifs MINESEC Réglementaires
  router.get('/tarifs-minesec',        controller.getTarifsMinesec);
  router.post('/tarifs-minesec',       controller.saveTarifMinesec);
  router.patch('/tarifs-minesec/:id/toggle', controller.toggleTarifActive);

  return router;
}
