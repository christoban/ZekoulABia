import { Router } from 'express';
import type { HRController } from '@infrastructure/http/controllers/HRController';

export function creerHrRoutes(ctrl: HRController): Router {
  const router = Router();

  router.get('/employees', ctrl.listEmployees);
  router.get('/export/liste-nominale-minesec', ctrl.exportListeNominaleMinesec);
  router.get('/employees/:id', ctrl.getEmployee);
  router.get('/employees/:id/file', ctrl.getEmployeeFile);
  router.post('/employees/:id/file', ctrl.saveEmployeeFile);
  router.patch('/employees/:id/file', ctrl.saveEmployeeFile);
  router.post('/employees/:id/career-events', ctrl.addCareerEvent);
  router.get('/employees/:id/career-events', ctrl.listCareerEvents);
  router.post('/attendance', ctrl.recordAttendance);
  router.get('/attendance', ctrl.listAttendance);
  router.post('/leave-requests', ctrl.createLeaveRequest);
  router.patch('/leave-requests/:id', ctrl.updateLeaveRequest);
  router.get('/leave-requests', ctrl.listLeaveRequests);
  router.get('/leave-balance/:userId', ctrl.getLeaveBalance);
  router.get('/employees/:id/attestation-travail', ctrl.getAttestationTravail);
  router.get('/employees/:id/certificat-travail', ctrl.getCertificatTravail);
  router.post('/mission-orders', ctrl.createMissionOrder);
  router.get('/mission-orders/:id/pdf', ctrl.getMissionOrderPdf);

  return router;
}
