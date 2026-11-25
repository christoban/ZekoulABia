import { Router } from 'express';
import type { StaffAttendanceController } from '../controllers/StaffAttendanceController';
import { requireAuth, requireRole } from '../middlewares/auth';

export function creerStaffAttendanceRoutes(ctrl: StaffAttendanceController): Router {
  const router = Router();

  // Consultation du statut de présence du jour et des modes disponibles (Enseignant/Personnel)
  router.get('/status', requireAuth, ctrl.monStatut);

  // L'enseignant pointe sa présence (QR / GPS / manuel) — tout rôle connecté de l'école peut pointer
  router.post('/pointer', requireAuth, ctrl.pointer);

  // L'enseignant récupère le QR de sa salle courante
  router.get('/scan-info', requireAuth, ctrl.scanInfo);

  // Administration des réglages de pointage (GPS, QR, rayons)
  router.get('/settings', requireAuth, requireRole('ADMIN', 'STAFF'), ctrl.getSettings);
  router.put('/settings', requireAuth, requireRole('ADMIN'), ctrl.updateSettings);

  // RH : lister et requalifier les pointages A_VERIFIER
  router.get('/a-verifier', requireAuth, requireRole('ADMIN', 'STAFF'), ctrl.listerAVerifier);
  router.patch('/:id/requalifier', requireAuth, requireRole('ADMIN', 'STAFF'), ctrl.requalifier);

  return router;
}