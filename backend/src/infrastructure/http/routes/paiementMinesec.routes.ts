import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { PaiementMinesecController } from '../controllers/PaiementMinesecController';

export function creerPaiementMinesecRoutes(controller: PaiementMinesecController): Router {
  const router = Router();

  // Génération des frais attendus (crée l'Enrollment si besoin — voir GenererPaiementsMinesecUseCase)
  router.post('/generate/:studentProfileId', requireAuth, requireRole('ADMIN'), controller.generer);
  router.post('/generate-school', requireAuth, requireRole('ADMIN'), controller.genererEcole);

  // Alertes retards de paiement
  router.get('/payment-alerts', requireAuth, requireRole('ADMIN', 'STAFF'), controller.paymentAlerts);

  // Dashboard consolidé élève
  router.get('/dashboard/student/:studentId', requireAuth, requireRole('ADMIN', 'STAFF', 'PARENT'), controller.dashboard);

  // Dashboard global école
  router.get('/dashboard/school', requireAuth, requireRole('ADMIN', 'STAFF'), controller.dashboardEcole);

  // Liste paiements MINESEC d'un élève — enregistrée APRÈS les routes /dashboard/* : ce motif à 2
  // segments (:studentId/:anneeScolaire) capturait sinon "dashboard/school" et "dashboard/student"
  // avant qu'ils n'atteignent leurs vrais handlers (bug de routage réel, découvert en testant le
  // flux GetSchoolPaymentOverviewUseCase de bout en bout — /dashboard/school levait "Élève
  // introuvable" en traitant "dashboard" comme studentId et "school" comme anneeScolaire).
  router.get('/:studentId/:anneeScolaire', requireAuth, requireRole('ADMIN', 'STAFF', 'PARENT'), controller.lister);

  return router;
}
