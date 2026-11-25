import { Router } from 'express';
import type { EmailLogController } from '@infrastructure/http/controllers/EmailLogController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerEmailLogRoutes(controller: EmailLogController): Router {
  const router = Router();
  router.get('/', requireAuth, requireRole('ADMIN'), controller.getLogs);
  return router;
}
