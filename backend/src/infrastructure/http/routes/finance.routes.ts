import { Router } from 'express';
import type { FinanceController } from '@infrastructure/http/controllers/FinanceController';
import type { FinanceOperationsController } from '@infrastructure/http/controllers/FinanceOperationsController';
import type { StudentFeesStatusController } from '@infrastructure/http/controllers/StudentFeesStatusController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerFinanceRoutes(
  controller: FinanceController,
  studentFeesStatusController?: StudentFeesStatusController,
  operationsController?: FinanceOperationsController,
): Router {
  const router = Router();

  // Plans de frais
  router.post('/fee-plans', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerPlan);
  router.post('/fee-plans/copy-from-previous-year', requireAuth, requireRole('ADMIN', 'STAFF'), controller.copierPlansAnneePrecedente);
  router.patch('/fee-plans/:id', requireAuth, requireRole('ADMIN', 'STAFF'), controller.modifierPlan);
  router.patch('/fee-plans/:id/status', requireAuth, requireRole('ADMIN', 'STAFF'), controller.changerStatutPlan);

  // Factures
  router.post('/invoices', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerFacture);
  router.post('/invoices/bulk', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerFacturesEnMasse);

  // Paiements Mobile Money & Cash
  router.post('/payments/mobile', requireAuth, requireRole('ADMIN', 'STAFF'), controller.initierPaiementMobile);
  router.post('/payments/mobile/verify', requireAuth, requireRole('ADMIN', 'STAFF'), controller.verifierStatutPaiementMobile);
  router.post('/payments/cash', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerPaiementCash);
  router.post('/payments/caution/:id/rembourser', requireAuth, requireRole('ADMIN', 'STAFF'), controller.rembourserCautionEleve);

  // Reçu de paiement PDF
  router.get('/payments/:paymentId/receipt', requireAuth, controller.genererRecu);

  // Webhook Campay — signature vérifiée par verifyCampayWebhookSignature
  router.post('/payments/webhook/campay', controller.webhookCampay);

  // Dépenses
  router.post('/expenses', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerDepense);

  if (operationsController) {
    // Tranches, remises, promesses & relances sur facture
    router.get('/invoices/:invoiceId/details', requireAuth, operationsController.obtenirDetailsFacture);
    router.put('/invoices/:invoiceId/installments', requireAuth, requireRole('ADMIN', 'STAFF'), operationsController.configurerEcheancierHandler);
    router.post('/invoices/:invoiceId/discounts', requireAuth, requireRole('ADMIN', 'STAFF'), operationsController.accorderRemiseHandler);
    router.post('/invoices/:invoiceId/promise', requireAuth, requireRole('ADMIN', 'STAFF'), operationsController.enregistrerPromesseHandler);
    router.post('/invoices/:invoiceId/remind', requireAuth, requireRole('ADMIN', 'STAFF'), operationsController.relancerFactureHandler);

    // Annulation (reversal) + Rapprochement Mobile Money + Clôture de caisse
    router.post('/payments/:paymentId/cancel', requireAuth, requireRole('ADMIN', 'STAFF'), operationsController.annulerPaiementHandler);
    router.get('/payments/unmatched', requireAuth, requireRole('ADMIN', 'STAFF'), operationsController.listerPaiementsNonRapprochesHandler);
    router.post('/payments/:paymentId/reconcile', requireAuth, requireRole('ADMIN', 'STAFF'), operationsController.rapprocherPaiementHandler);
    router.get('/cash-closures', requireAuth, requireRole('ADMIN', 'STAFF'), operationsController.listerCloturesCaisseHandler);
    router.post('/cash-closures', requireAuth, requireRole('ADMIN', 'STAFF'), operationsController.cloturerCaisseHandler);
  }

  // Consultation état des frais pour secrétariat / admin / élève
  if (studentFeesStatusController) {
    router.get('/students/:id/fees-status', requireAuth, studentFeesStatusController.consulterStatutFrais);
  }

  return router;
}
