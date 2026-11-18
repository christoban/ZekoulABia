import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AssistantController } from '../controllers/AssistantController';
import type { AIController } from '../controllers/AIController';

const ASSISTANT_ROLES = ['ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'] as const;

/**
 * Routes de l'assistant IA exécutant (copilot) et du chat contextuel.
 */
export function creerAssistantRoutes(
  assistantController: AssistantController,
  aiController: AIController,
): Router {
  const router = Router();
  router.post('/chat', requireAuth, aiController.assistantChat);
  router.post('/execute', requireAuth, requireRole(...ASSISTANT_ROLES), assistantController.execute);
  router.post('/confirm-action', requireAuth, requireRole(...ASSISTANT_ROLES), assistantController.confirmAction);
  router.post('/undo-action', requireAuth, requireRole(...ASSISTANT_ROLES), assistantController.undoAction);
  return router;
}

