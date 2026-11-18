import { Router } from 'express';
import type { AIActionAuditController } from '@infrastructure/http/controllers/AIActionAuditController';
import { requireAuth, requireRole } from '../middlewares/auth';

export function creerAIActionAuditRoutes(controller: AIActionAuditController): Router {
  const router = Router();

  router.get('/audit-log', requireAuth, requireRole('ADMIN'), controller.journalEtablissement);

  return router;
}
