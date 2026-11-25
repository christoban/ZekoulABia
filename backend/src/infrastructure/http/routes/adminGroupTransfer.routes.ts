import { Router } from 'express';
import type { AdminGroupTransferController } from '../controllers/AdminGroupTransferController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerAdminGroupTransferRoutes(controller: AdminGroupTransferController): Router {
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN'));

  router.get('/incoming', controller.listerEntrantes);
  router.post('/:id/accept', controller.accepter);
  router.post('/:id/reject', controller.rejeter);

  return router;
}
