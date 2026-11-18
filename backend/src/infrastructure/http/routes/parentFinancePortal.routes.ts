import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { ParentFinancePortalController } from '@infrastructure/http/controllers/ParentFinancePortalController';

export function creerParentFinancePortalRoutes(controller: ParentFinancePortalController): Router {
  const router = Router();

  router.get('/invoices', requireAuth, requireRole('PARENT'), controller.listInvoices);
  router.post('/pay', requireAuth, requireRole('PARENT'), controller.initiatePayment);
  router.post('/payments/verify', requireAuth, requireRole('PARENT'), controller.verifyPayment);
  router.post('/invoices/:id/promise', requireAuth, requireRole('PARENT'), controller.recordPaymentPromise);

  return router;
}
