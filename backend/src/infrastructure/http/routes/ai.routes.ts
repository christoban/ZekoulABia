import { Router } from 'express';
import type { AIController } from '@infrastructure/http/controllers/AIController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import { sensitiveWriteLimiter } from '../middlewares/rateLimit.ts';

export function creerAIRoutes(controller: AIController): Router {
  const router = Router();
  router.use(requireAuth);
  router.post('/generate-insight', sensitiveWriteLimiter, controller.generateInsight);
  router.get('/students-health', requireRole('ADMIN', 'STAFF'), controller.getStudentsHealth);
  router.get('/at-risk-students', controller.getAtRiskStudentsForTeacher);
  router.get('/health-tracking', controller.getHealthTracking);
  router.post('/bulletin-comment', sensitiveWriteLimiter, controller.generateBulletinComment);
  router.post('/chat', sensitiveWriteLimiter, controller.chat);
  router.get('/risk-detection/:studentId', controller.detectRisk);
  router.get('/compare-risk-predictions/:studentId', requireRole('ADMIN'), controller.comparerRisquePredictions);
  return router;
}
