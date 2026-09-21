import { Router } from 'express';
import type { FinanceController } from '@infrastructure/http/controllers/FinanceController';
import type { StudentFeesStatusController } from '@infrastructure/http/controllers/StudentFeesStatusController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerFinanceRoutes(
  controller: FinanceController,
  studentFeesStatusController?: StudentFeesStatusController,
): Router {
  const router = Router();

  // Plans de frais
  router.post('/fee-plans', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerPlan);
  router.post('/fee-plans/copy-from-previous-year', requireAuth, requireRole('ADMIN', 'STAFF'), controller.copierPlansAnneePrecedente);
  // Workflow de publication V1.11 : DRAFT → PENDING_VALIDATION → APPROVED → PUBLISHED
  router.patch('/fee-plans/:id/status', requireAuth, requireRole('ADMIN', 'STAFF'), controller.changerStatutPlan);

  // Factures
  router.post('/invoices', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerFacture);
  router.post('/invoices/bulk', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerFacturesEnMasse);

  // Paiements Mobile Money (initié par Admin/Staff au guichet à la place du parent)
  router.post('/payments/mobile', requireAuth, requireRole('ADMIN', 'STAFF'), controller.initierPaiementMobile);

  // Paiement en espèces (guichet) — enregistré directement comme SUCCESS sans Campay
  router.post('/payments/cash', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerPaiementCash);

  router.post('/payments/caution/:id/rembourser', requireAuth, requireRole('ADMIN', 'STAFF'), controller.rembourserCautionEleve);

  // Reçu de paiement PDF
  router.get('/payments/:paymentId/receipt', requireAuth, controller.genererRecu);

  // Webhook Campay — pas d'auth (appelé par Campay directement)
  router.post('/payments/webhook/campay', controller.webhookCampay);

  // Dépenses
  router.post('/expenses', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerDepense);

  // Consultation état des frais pour secrétariat / admin / élève
  if (studentFeesStatusController) {
    router.get('/students/:id/fees-status', requireAuth, studentFeesStatusController.consulterStatutFrais);
  }

  return router;
}
