import { Router } from 'express';
import type { StatisticsController } from '@infrastructure/http/controllers/StatisticsController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerStatisticsRoutes(controller: StatisticsController): Router {
  const router = Router();

  router.get('/grades-evolution', requireAuth, requireRole('ADMIN', 'STAFF'), controller.gradesEvolution);
  router.get('/classes-comparison', requireAuth, requireRole('ADMIN', 'STAFF'), controller.classesComparison);
  router.get('/students-distribution', requireAuth, requireRole('ADMIN', 'STAFF'), controller.studentsDistribution);
  router.get('/teacher-performance/:teacherId', requireAuth, requireRole('ADMIN', 'STAFF'), controller.teacherPerformance);

  return router;
}
